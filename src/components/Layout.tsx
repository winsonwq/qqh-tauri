import { useState, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { setCurrentFeature, setCurrentPage } from "../redux/slices/featureKeysSlice";
import { toggleSidePanel } from "../redux/slices/sidePanelSlice";
import { loadMCPConfigs } from "../redux/slices/mcpSlice";
import { loadAIConfigs } from "../redux/slices/aiConfigSlice";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import AppSideBar from "./AppSideBar";
import AppContent from "./AppContent";
import SidePanel from "./SidePanel";
import { FaBars, FaRobot } from "react-icons/fa";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { useToast } from "./Toast/useToast";
import { TranscriptionResource } from "../models";

// 支持转写的文件扩展名
const SUPPORTED_AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'aac', 'wma'];
const SUPPORTED_VIDEO_EXTENSIONS = ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm', 'm4v', '3gp'];
const SUPPORTED_EXTENSIONS = [...SUPPORTED_AUDIO_EXTENSIONS, ...SUPPORTED_VIDEO_EXTENSIONS];

// 检查文件是否支持转写
const isSupportedFile = (filePath: string): boolean => {
  const extension = filePath.split('.').pop()?.toLowerCase() || '';
  return SUPPORTED_EXTENSIONS.includes(extension);
};

// 规范化路径（统一路径分隔符，便于比较）
const normalizePath = (path: string) => path.replace(/\\/g, '/');

const Layout = () => {
  const dispatch = useAppDispatch();
  const { currentFeature } = useAppSelector((state) => state.featureKeys);
  const { isOpen: sidePanelOpen } = useAppSelector((state) => state.sidePanel);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const toast = useToast();
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  
  // 使用 ref 来跟踪监听器是否已设置，防止重复注册
  const listenerSetupRef = useRef(false);
  // 使用 ref 来跟踪最近处理的 drop 事件，防止重复处理
  const lastDropRef = useRef<{ paths: string[]; timestamp: number } | null>(null);
  // 使用 Set 跟踪正在处理的文件路径，防止并发处理同一文件
  const processingPathsRef = useRef<Set<string>>(new Set());

  // 初始化时，如果当前没有选中的功能，默认设置为首页
  useEffect(() => {
    if (!currentFeature) {
      dispatch(setCurrentFeature('home'));
    }
  }, [currentFeature, dispatch]);

  // 应用启动时加载 MCP 配置和 AI 配置
  useEffect(() => {
    dispatch(loadMCPConfigs());
    dispatch(loadAIConfigs());
  }, [dispatch]);

  // 全局文件拖放监听
  useEffect(() => {
    // 防止在 React StrictMode 下重复注册监听器
    if (listenerSetupRef.current) {
      console.log('文件拖放监听器已存在，跳过重复注册');
      return;
    }
    listenerSetupRef.current = true;

    let unlistenFileDrop: (() => void) | null = null;
    let isSettingUp = false;

    const setupFileDropListeners = async () => {
      // 防止并发设置
      if (isSettingUp) {
        console.log('正在设置监听器，跳过重复设置');
        return;
      }
      isSettingUp = true;

      try {
        const appWindow = getCurrentWindow();
        
        // 使用 onDragDropEvent 监听文件拖放事件
        unlistenFileDrop = await appWindow.onDragDropEvent(async (event) => {
          const { type } = event.payload;
          
          // 处理拖拽进入和悬停事件，显示全屏提示
          if (type === 'enter' || type === 'over') {
            setIsDraggingFile(true);
            return;
          }
          
          // 处理拖拽离开事件，隐藏提示
          if (type === 'leave') {
            setIsDraggingFile(false);
            return;
          }
          
          // 处理 drop 事件
          if (type !== 'drop') {
            return;
          }
          
          // 隐藏拖拽提示
          setIsDraggingFile(false);
          
          const paths = event.payload.paths;
          if (!paths || paths.length === 0) {
            return;
          }
          
          // 防重复处理：检查是否是相同的路径和最近处理过的事件
          // 这个检查必须在所有处理之前，包括不支持的文件
          const currentTime = Date.now();
          const pathsKey = paths.sort().join('|');
          
          if (
            lastDropRef.current &&
            lastDropRef.current.paths.join('|') === pathsKey &&
            currentTime - lastDropRef.current.timestamp < 2000 // 2秒内的重复事件忽略
          ) {
            console.log('检测到重复的 drop 事件，已忽略', {
              paths: paths,
              lastPaths: lastDropRef.current.paths,
              timeDiff: currentTime - lastDropRef.current.timestamp,
            });
            return;
          }
          
          // 立即记录这次处理（在处理开始前就记录，防止并发）
          lastDropRef.current = {
            paths: [...paths], // 复制数组，避免引用问题
            timestamp: currentTime,
          };

          // 过滤出支持转写的文件
          const supportedFiles = paths.filter(isSupportedFile);
          
          if (supportedFiles.length === 0) {
            toast.warning('拖放的文件不支持转写，请拖放音频或视频文件');
            return;
          }

          // 处理每个支持的文件
          for (const filePath of supportedFiles) {
            const normalizedFilePath = normalizePath(filePath);
            
            // 检查文件是否正在处理中
            if (processingPathsRef.current.has(normalizedFilePath)) {
              console.log(`文件正在处理中，跳过: ${filePath}`);
              continue;
            }
            
            // 标记为正在处理
            processingPathsRef.current.add(normalizedFilePath);
            
            try {
              const fileName = filePath.split(/[/\\]/).pop() || '未知文件';
              
              // 检查是否已存在相同路径的资源
              const existingResources = await invoke<TranscriptionResource[]>('get_transcription_resources');
              const existingResource = existingResources.find(
                (r) => normalizePath(r.file_path) === normalizedFilePath
              );

              if (existingResource) {
                // 如果已存在相同路径的资源，直接打开资源详情页
                dispatch(setCurrentPage({ feature: 'home', page: `resource:${existingResource.id}` }));
                toast.info(`文件已存在，已打开资源: ${fileName}`);
              } else {
                // 创建新的转写资源
                const newResource = await invoke<TranscriptionResource>('create_transcription_resource', {
                  name: fileName,
                  filePath: filePath,
                });

                // 创建成功后，跳转到资源详情页
                dispatch(setCurrentPage({ feature: 'home', page: `resource:${newResource.id}` }));
                toast.success(`已创建转写资源: ${fileName}`);
              }
            } catch (err) {
              console.error('处理文件失败:', err);
              const errorMessage = err instanceof Error ? err.message : String(err);
              toast.error(`处理文件失败: ${errorMessage}`);
            } finally {
              // 从处理集合中移除
              processingPathsRef.current.delete(normalizedFilePath);
            }
          }
        });

        console.log('全局文件拖放监听器已设置');
        isSettingUp = false;
      } catch (error) {
        console.error('设置文件拖放事件监听器失败:', error);
        isSettingUp = false;
        listenerSetupRef.current = false; // 设置失败时重置，允许重试
      }
    };

    setupFileDropListeners();

    // 清理函数
    return () => {
      listenerSetupRef.current = false;
      processingPathsRef.current.clear();
      if (unlistenFileDrop) {
        unlistenFileDrop();
        unlistenFileDrop = null;
      }
    };
  }, [dispatch, toast]);

  const handleToggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleToggleSidePanel = () => {
    dispatch(toggleSidePanel());
  };

  return (
    <>
      {/* 全屏拖拽提示特效 */}
      {isDraggingFile && (
        <div 
          className="fixed inset-0 z-[9999] bg-primary/20 backdrop-blur-sm flex flex-col items-center justify-center"
          style={{
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <div className="text-6xl mb-6 animate-bounce">📁</div>
          <p className="text-2xl font-medium text-primary">
            松开以添加转写资源
          </p>
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}</style>
        </div>
      )}
      
    <div className="drawer lg:drawer-open h-full w-full relative">
      <input
        id="sidebar-toggle"
        type="checkbox"
        className="drawer-toggle"
        checked={sidebarOpen}
        onChange={(e) => setSidebarOpen(e.target.checked)}
      />
      <div className="drawer-content flex flex-col h-full w-full overflow-hidden">
        {/* 顶部导航栏 */}
        <div className="navbar bg-base-100 shadow-sm lg:hidden flex-shrink-0">
          <div className="flex-none">
            <label
              htmlFor="sidebar-toggle"
              className="btn btn-square btn-ghost drawer-button"
            >
              <FaBars className="w-3.5 h-3.5" />
            </label>
          </div>
          <div className="flex-1">
            <a className="btn btn-ghost text-xl">应用名称</a>
          </div>
        </div>

        {/* 主内容区域和右侧面板 */}
        <div className="flex-1 overflow-hidden">
          {sidePanelOpen ? (
            <PanelGroup direction="horizontal" className="h-full">
              {/* 主内容区域 */}
              <Panel defaultSize={70} minSize={30} className="overflow-hidden relative">
                <AppContent />
                {/* 主内容区域右下角的按钮 */}
                <button
                  onClick={handleToggleSidePanel}
                  className="absolute bottom-4 right-4 z-50 btn btn-circle btn-primary shadow-lg transition-all"
                  title={sidePanelOpen ? '关闭侧边面板' : '打开侧边面板'}
                >
                  <FaRobot className="w-5 h-5" />
                </button>
              </Panel>
              
              {/* 可拖动的分隔线 */}
              <PanelResizeHandle className="w-1 bg-base-300 hover:bg-primary transition-colors cursor-col-resize" />
              
              {/* 右侧面板 */}
              <Panel defaultSize={30} minSize={20} maxSize={50} className="overflow-hidden">
                <SidePanel />
              </Panel>
            </PanelGroup>
          ) : (
            <div className="h-full overflow-hidden relative">
              <AppContent />
              {/* 主内容区域右下角的按钮 */}
              <button
                onClick={handleToggleSidePanel}
                className="absolute bottom-4 right-4 z-50 btn btn-circle btn-primary shadow-lg transition-all"
                title={sidePanelOpen ? '关闭侧边面板' : '打开侧边面板'}
              >
                <FaRobot className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
      <AppSideBar sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
    </div>
    </>
  );
};

export default Layout;

