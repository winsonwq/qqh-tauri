import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import {
  TranscriptionTask,
  TranscriptionTaskStatus,
} from '../../../models';
import { wait } from '../../../utils';
import { appendLog } from '../../../redux/slices/transcriptionLogsSlice';
import { AppDispatch } from '../../../redux/store';

type UseTranscriptionTaskRuntimeParams = {
  tasks: TranscriptionTask[];
  selectedTaskId: string | null;
  dispatch: AppDispatch;
};

type UseTranscriptionTaskRuntimeResult = {
  resultContent: string | null;
  setResultContent: Dispatch<SetStateAction<string | null>>;
  cleanupTaskListeners: () => void;
};

const useTranscriptionTaskRuntime = ({
  tasks,
  selectedTaskId,
  dispatch,
}: UseTranscriptionTaskRuntimeParams): UseTranscriptionTaskRuntimeResult => {
  const [resultContent, setResultContent] = useState<string | null>(null);

  const unlistenRef = useRef<{
    stdout?: UnlistenFn;
    stderr?: UnlistenFn;
    taskId?: string;
  }>({});
  const isSettingUpRef = useRef<boolean>(false);
  const settingUpTaskIdRef = useRef<string | null>(null);

  const cleanupTaskListeners = useCallback(() => {
    if (unlistenRef.current.stdout) {
      try {
        unlistenRef.current.stdout();
      } catch (err) {
        console.error('清理 stdout 监听器失败:', err);
      }
      unlistenRef.current.stdout = undefined;
    }
    if (unlistenRef.current.stderr) {
      try {
        unlistenRef.current.stderr();
      } catch (err) {
        console.error('清理 stderr 监听器失败:', err);
      }
      unlistenRef.current.stderr = undefined;
    }
    unlistenRef.current.taskId = undefined;
    isSettingUpRef.current = false;
    settingUpTaskIdRef.current = null;
  }, []);

  const setupTaskListeners = useCallback(
    async (taskId: string) => {
      if (unlistenRef.current.taskId === taskId) {
        return;
      }

      if (isSettingUpRef.current && settingUpTaskIdRef.current === taskId) {
        return;
      }

      if (isSettingUpRef.current && settingUpTaskIdRef.current !== taskId) {
        await wait(100);
        if (unlistenRef.current.taskId === taskId) {
          return;
        }
        if (isSettingUpRef.current && settingUpTaskIdRef.current === taskId) {
          return;
        }
      }

      isSettingUpRef.current = true;
      settingUpTaskIdRef.current = taskId;

      try {
        cleanupTaskListeners();

        if (unlistenRef.current.taskId === taskId) {
          isSettingUpRef.current = false;
          settingUpTaskIdRef.current = null;
          return;
        }

        dispatch(appendLog({ taskId, log: '' }));

        const stdoutEventName = `transcription-stdout-${taskId}`;
        try {
          const unlistenStdout = await listen<string>(
            stdoutEventName,
            (event) => {
              if (unlistenRef.current.taskId !== taskId) {
                return;
              }
              if (event.payload.trim()) {
                dispatch(appendLog({ taskId, log: event.payload }));
              }
            }
          );
          unlistenRef.current.stdout = unlistenStdout;
        } catch (err) {
          console.error('设置 stdout 监听器失败:', err);
          isSettingUpRef.current = false;
          settingUpTaskIdRef.current = null;
          return;
        }

        const stderrEventName = `transcription-stderr-${taskId}`;
        try {
          const unlistenStderr = await listen<string>(
            stderrEventName,
            (event) => {
              if (unlistenRef.current.taskId !== taskId) {
                return;
              }
              if (event.payload.trim()) {
                dispatch(appendLog({ taskId, log: event.payload }));
              }
            }
          );
          unlistenRef.current.stderr = unlistenStderr;
          unlistenRef.current.taskId = taskId;
        } catch (err) {
          console.error('设置 stderr 监听器失败:', err);
          isSettingUpRef.current = false;
          settingUpTaskIdRef.current = null;
          return;
        }

        isSettingUpRef.current = false;
        settingUpTaskIdRef.current = null;
      } catch (err) {
        console.error('设置监听器失败:', err);
        isSettingUpRef.current = false;
        settingUpTaskIdRef.current = null;
      }
    },
    [cleanupTaskListeners, dispatch]
  );

  const runningTaskId = useMemo(() => {
    const runningTask = tasks.find(
      (task) => task.status === TranscriptionTaskStatus.RUNNING
    );
    return runningTask?.id ?? null;
  }, [tasks]);

  useEffect(() => {
    if (tasks.length === 0) return;
    if (!runningTaskId && unlistenRef.current.taskId) {
      cleanupTaskListeners();
    }
  }, [runningTaskId, tasks.length, cleanupTaskListeners]);

  useEffect(() => {
    let isCancelled = false;

    const loadResult = async () => {
      if (!selectedTaskId) {
        setResultContent(null);
        if (unlistenRef.current.taskId) {
          cleanupTaskListeners();
        }
        return;
      }

      const task = tasks.find((item) => item.id === selectedTaskId);
      if (!task) {
        setResultContent(null);
        if (unlistenRef.current.taskId) {
          cleanupTaskListeners();
        }
        return;
      }

      if (task.status === TranscriptionTaskStatus.RUNNING) {
        if (isCancelled) return;
        if (
          unlistenRef.current.taskId !== task.id &&
          !(isSettingUpRef.current && settingUpTaskIdRef.current === task.id)
        ) {
          await setupTaskListeners(task.id);
        }
      } else if (unlistenRef.current.taskId) {
        cleanupTaskListeners();
      }

      if (isCancelled) return;

      if (task.status === TranscriptionTaskStatus.COMPLETED) {
        try {
          const content = await invoke<string>('read_transcription_result', {
            taskId: selectedTaskId,
          });
          if (!isCancelled) {
            setResultContent(content);
          }
        } catch (err) {
          console.error('读取结果失败:', err);
          if (!isCancelled) {
            setResultContent(null);
          }
        }
      } else if (!isCancelled) {
        setResultContent(null);
      }
    };

    loadResult();

    return () => {
      isCancelled = true;
    };
  }, [selectedTaskId, tasks, setupTaskListeners, cleanupTaskListeners]);

  useEffect(() => {
    return () => {
      if (unlistenRef.current.stdout) {
        unlistenRef.current.stdout();
      }
      if (unlistenRef.current.stderr) {
        unlistenRef.current.stderr();
      }
      unlistenRef.current.stdout = undefined;
      unlistenRef.current.stderr = undefined;
      unlistenRef.current.taskId = undefined;
      isSettingUpRef.current = false;
      settingUpTaskIdRef.current = null;
    };
  }, []);

  return {
    resultContent,
    setResultContent,
    cleanupTaskListeners,
  };
};

export default useTranscriptionTaskRuntime;


