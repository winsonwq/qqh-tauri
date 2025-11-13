import {
  Dispatch,
  SetStateAction,
  useCallback,
  useState,
} from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  TranscriptionResource,
  TranscriptionTask,
  TranscriptionTaskStatus,
} from '../../../models';
import { MessageApi } from './useResourceMedia';

type UseTranscriptionTasksManagerParams = {
  resourceId: string | null;
  message: MessageApi;
  setResourceData: (resource: TranscriptionResource | null) => Promise<void>;
  refreshSubtitle: (
    tasks: TranscriptionTask[],
    resourceOverride?: TranscriptionResource | null
  ) => Promise<void>;
  resource: TranscriptionResource | null;
};

type UseTranscriptionTasksManagerResult = {
  tasks: TranscriptionTask[];
  selectedTaskId: string | null;
  setSelectedTaskId: Dispatch<SetStateAction<string | null>>;
  loadResourceAndTasks: () => Promise<void>;
  loadTasks: (autoSwitchToRunning?: boolean) => Promise<void>;
  resetTasks: () => void;
};

const useTranscriptionTasksManager = ({
  resourceId,
  message,
  setResourceData,
  refreshSubtitle,
  resource,
}: UseTranscriptionTasksManagerParams): UseTranscriptionTasksManagerResult => {
  const [tasks, setTasks] = useState<TranscriptionTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const applyTasks = useCallback(
    (tasksResult: TranscriptionTask[], selectDefault = false) => {
      const sortedTasks = [...tasksResult].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setTasks(sortedTasks);

      if (selectDefault) {
        if (sortedTasks.length === 0) {
          setSelectedTaskId(null);
          return sortedTasks;
        }
        const runningTask = sortedTasks.find(
          (task) => task.status === TranscriptionTaskStatus.RUNNING
        );
        if (runningTask) {
          setSelectedTaskId(runningTask.id);
          return sortedTasks;
        }
        const completedTask = sortedTasks.find(
          (task) => task.status === TranscriptionTaskStatus.COMPLETED
        );
        if (completedTask) {
          setSelectedTaskId(completedTask.id);
          return sortedTasks;
        }
        setSelectedTaskId(sortedTasks[0].id);
      }

      return sortedTasks;
    },
    []
  );

  const loadResourceAndTasks = useCallback(async () => {
    if (!resourceId) return;

    try {
      const [resources, tasksResult] = await Promise.all([
        invoke<TranscriptionResource[]>('get_transcription_resources'),
        invoke<TranscriptionTask[]>('get_transcription_tasks', { resourceId }),
      ]);

      const found = resources.find((item) => item.id === resourceId) || null;
      await setResourceData(found);

      const sortedTasks = applyTasks(tasksResult, true);
      await refreshSubtitle(sortedTasks, found);
    } catch (err) {
      console.error('加载资源和任务失败:', err);
      message.error(err instanceof Error ? err.message : '加载失败');
      await setResourceData(null);
      applyTasks([], true);
    }
  }, [
    resourceId,
    applyTasks,
    message,
    refreshSubtitle,
    setResourceData,
  ]);

  const loadTasks = useCallback(
    async (autoSwitchToRunning = true) => {
      if (!resourceId) return;
      try {
        const result = await invoke<TranscriptionTask[]>(
          'get_transcription_tasks',
          { resourceId }
        );

        const previousTasks = tasks;

        const sortedTasks = applyTasks(result, true);

        await refreshSubtitle(sortedTasks, resource ?? null);

        if (sortedTasks.length > 0 && autoSwitchToRunning) {
          const runningTask = sortedTasks.find(
            (task) => task.status === TranscriptionTaskStatus.RUNNING
          );
          if (runningTask) {
            const previousRunningTask = previousTasks.find(
              (task) => task.id === runningTask.id
            );
            const isNewRunningTask =
              !previousRunningTask ||
              previousRunningTask.status !== TranscriptionTaskStatus.RUNNING;
            const currentTaskIsNotRunning =
              !selectedTaskId ||
              !previousTasks.find(
                (task) =>
                  task.id === selectedTaskId &&
                  task.status === TranscriptionTaskStatus.RUNNING
              );

            if (isNewRunningTask || currentTaskIsNotRunning) {
              setSelectedTaskId(runningTask.id);
            }
          }
        }
      } catch (err) {
        console.error('加载任务失败:', err);
      }
    },
    [
      resourceId,
      tasks,
      applyTasks,
      refreshSubtitle,
      resource,
      selectedTaskId,
    ]
  );

  const resetTasks = useCallback(() => {
    setTasks([]);
    setSelectedTaskId(null);
  }, []);

  return {
    tasks,
    selectedTaskId,
    setSelectedTaskId,
    loadResourceAndTasks,
    loadTasks,
    resetTasks,
  };
};

export default useTranscriptionTasksManager;


