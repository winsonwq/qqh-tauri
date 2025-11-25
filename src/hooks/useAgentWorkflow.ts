/**
 * Agent 工作流 Hook
 * 
 * 重构版：使用 src/agent-framework 框架
 */

import { AgentWorkflowEngine } from '../agent-framework/workflow/AgentWorkflowEngine';
import { TauriAgentBackend } from '../adapters/TauriAgentBackend';
import { PromptManager } from '../agent-framework/prompts/PromptManager';
import { APP_SYSTEM_CONTEXT } from '../config/agentContext';
import { AIMessage } from '../agent-framework/core/types';
import { MCPServerInfo } from '../models';
import { getAvailableTools } from '../utils/toolUtils';

interface AgentWorkflowOptions {
  configId: string
  chatId: string
  userMessage: string
  messages: AIMessage[]
  updateMessages: (updater: (prev: AIMessage[]) => AIMessage[]) => void
  messagesRef: React.MutableRefObject<AIMessage[]>
  mcpServers: MCPServerInfo[]
  currentResourceId: string | null
  currentTaskId: string | null
  systemMessage: string
}

/**
 * Agent 工作流控制器
 * 用于控制工作流的停止
 */
export interface AgentWorkflowController {
  stop: () => void
}

/**
 * Agent 工作流主函数
 * @returns 返回控制器和 Promise
 */
export function runAgentWorkflow({
  configId,
  chatId,
  userMessage,
  messages,
  updateMessages,
  mcpServers,
  currentResourceId,
  currentTaskId,
  systemMessage,
}: AgentWorkflowOptions): { controller: AgentWorkflowController; promise: Promise<void> } {
  
  // 初始化依赖
  const backend = new TauriAgentBackend();
  const promptManager = new PromptManager();
  
  // 设置应用上下文
  promptManager.setSystemContext(APP_SYSTEM_CONTEXT);
  
  // 初始化引擎
  const engine = new AgentWorkflowEngine(backend, promptManager);
  
  // 创建控制器
  const controller: AgentWorkflowController = {
    stop: () => {
      engine.stop();
    }
  };

  const tools = getAvailableTools(mcpServers);
  
  const promise = engine.run({
      configId,
      chatId,
      userMessage,
      initialMessages: messages,
      systemMessage,
      tools,
      context: {
          currentResourceId,
          currentTaskId
      },
      mcpServers // Pass mcpServers for tool server lookup
  }, {
      onMessageUpdate: (newMessages) => {
          // Framework messages -> App messages
          // The types are compatible (we ensured that)
          // 合并消息而不是完全替换，保留用户消息
          updateMessages((prevMessages) => {
              // 从 prevMessages 中提取用户消息（排除内部消息）
              const userMessages = prevMessages.filter(msg => 
                  msg.role === 'user' && 
                  !msg.id.startsWith('planner-user-') && 
                  !msg.id.startsWith('executor-user-')
              );
              
              // 从 newMessages 中过滤掉内部用户消息
              const frameworkMessages = newMessages.filter(msg => 
                  msg.role !== 'user' || 
                  (!msg.id.startsWith('planner-user-') && !msg.id.startsWith('executor-user-'))
              );
              
              // 合并：保留用户消息，使用框架消息（按 ID 去重）
              const frameworkMessageIds = new Set(frameworkMessages.map(msg => msg.id));
              const allMessages = [
                  ...userMessages.filter(msg => !frameworkMessageIds.has(msg.id)),
                  ...frameworkMessages
              ];
              
              // 按时间戳排序
              return allMessages.sort((a, b) => 
                  a.timestamp.getTime() - b.timestamp.getTime()
              );
          });
      },
      onError: (error) => {
          console.error('Agent Workflow Error:', error);
          throw error; // Re-throw to be caught by outer caller if needed
      },
      onLog: (msg) => {
          console.log(`[Agent] ${msg}`);
      }
  });

  return { controller, promise };
}
