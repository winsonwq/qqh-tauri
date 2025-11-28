import { useState, useRef, useCallback } from 'react'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { AIMessage, convertAIMessagesToChatMessages, generateEventId } from '../utils/aiMessageUtils'
import { ToolCall } from '../componets/AI/ToolCallConfirmModal'
import { useMessage } from '../componets/Toast'
import { findToolServer, getAvailableTools, areAllDefaultMCPTools } from '../utils/toolUtils'
import { MCPServerInfo } from '../models'
import { generateThoughtPrompt, generateActionPrompt, generateObservationPrompt, ToolInfo } from '../utils/aiUtils'
// @ts-ignore - partial-json-parser 可能没有类型定义
import partialParse from 'partial-json-parser'

// ReAct Agent 元数据，用于判断是否需要继续执行
export interface AgentMeta {
  shouldContinue: boolean // 是否需要继续执行
  reason?: string // 选择这个行动的原因
}

// ReAct 循环阶段
export type ReActPhase = 'idle' | 'thought' | 'action' | 'observation'

// 解析 AI 响应中的 agent_meta 标签
export function parseAgentMeta(content: string): AgentMeta | null {
  // 支持完整的标签和不完整的标签（用于流式解析）
  const metaMatch = content.match(/<agent_meta>([\s\S]*?)(?:<\/agent_meta>|$)/)
  if (!metaMatch) {
    console.log('[parseAgentMeta] 未找到 agent_meta 标签')
    return null
  }

  try {
    const metaContent = metaMatch[1].trim()
    console.log('[parseAgentMeta] 提取的 meta 内容:', metaContent)
    
    // 如果没有内容，返回 null
    if (!metaContent) {
      console.log('[parseAgentMeta] meta 内容为空')
      return null
    }
    
    // 尝试解析 JSON 格式（支持部分 JSON）
    if (metaContent.startsWith('{')) {
      // 先尝试标准 JSON 解析
      try {
        const parsed = JSON.parse(metaContent)
        console.log('[parseAgentMeta] 标准 JSON 解析成功:', parsed)
        
        // 验证必要字段
        if (typeof parsed.shouldContinue === 'boolean') {
          return {
            shouldContinue: parsed.shouldContinue,
            reason: parsed.reason || undefined,
          }
        } else {
          console.warn('[parseAgentMeta] 缺少 shouldContinue 字段，使用默认值')
          return {
            shouldContinue: true, // 默认继续执行
            reason: parsed.reason || undefined,
          }
        }
      } catch (parseError) {
        // 如果标准解析失败，尝试部分 JSON 解析
        console.log('[parseAgentMeta] 标准 JSON 解析失败，尝试部分解析:', parseError)
        try {
          const parsed = partialParse(metaContent)
          console.log('[parseAgentMeta] 部分 JSON 解析结果:', parsed)
          
          // 验证必要字段
          if (typeof parsed.shouldContinue === 'boolean') {
            return {
              shouldContinue: parsed.shouldContinue,
              reason: parsed.reason || undefined,
            }
          } else {
            console.warn('[parseAgentMeta] 部分解析结果缺少 shouldContinue 字段，使用默认值')
            return {
              shouldContinue: true, // 默认继续执行
              reason: parsed.reason || undefined,
            }
          }
        } catch (partialError) {
          console.error('[parseAgentMeta] 部分 JSON 解析也失败:', partialError)
          // 如果都失败，返回默认值而不是 null
          console.log('[parseAgentMeta] 返回默认值: shouldContinue=true')
          return {
            shouldContinue: true, // 默认继续执行
            reason: undefined,
          }
        }
      }
    } else {
      console.log('[parseAgentMeta] meta 内容不是 JSON 格式（不以 { 开头）')
      return null
    }
  } catch (e) {
    console.error('[parseAgentMeta] 解析过程中出错:', e)
    // 即使出错，也返回默认值而不是 null
    return {
      shouldContinue: true, // 默认继续执行
      reason: undefined,
    }
  }
}

// 从内容中移除 agent_meta 标签（支持不完整的结束标签）
export function removeAgentMeta(content: string): string {
  // 移除完整的标签：<agent_meta>...</agent_meta>
  let cleaned = content.replace(/<agent_meta>[\s\S]*?<\/agent_meta>/g, '')
  // 移除不完整的标签（用于流式输出）：<agent_meta>...（没有结束标签）
  cleaned = cleaned.replace(/<agent_meta>[\s\S]*$/g, '')
  return cleaned.trim()
}

interface UseReActAgentOptions {
  selectedConfigId: string
  currentChatId: string | undefined
  currentResourceId: string | null
  currentTaskId: string | null
  messagesRef: React.MutableRefObject<AIMessage[]>
  updateMessages: (updater: (prev: AIMessage[]) => AIMessage[]) => void
  mcpServers: MCPServerInfo[]
}

// 从 MCP 服务器获取工具信息列表（只返回 enabled 且已连接的服务器工具）
function getToolInfoList(mcpServers: MCPServerInfo[]): ToolInfo[] {
  const toolInfoList: ToolInfo[] = []
  console.log('[ReAct getToolInfoList] 检查服务器:', mcpServers.map(s => ({
    name: s.name,
    status: s.status,
    enabled: s.config?.enabled,
    toolsCount: s.tools?.length || 0
  })))
  for (const server of mcpServers) {
    const isEnabled = server.config?.enabled ?? true
    console.log(`[ReAct] Server ${server.name}: enabled=${isEnabled}, status=${server.status}, tools=${server.tools?.length || 0}`)
    if (isEnabled && server.status === 'connected' && server.tools) {
      for (const tool of server.tools) {
        toolInfoList.push({
          name: tool.name,
          description: tool.description || '',
        })
      }
    }
  }
  return toolInfoList
}

export function useReActAgent({
  selectedConfigId,
  currentResourceId,
  currentTaskId,
  messagesRef,
  updateMessages,
  mcpServers,
}: UseReActAgentOptions) {
  const message = useMessage()
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentPhase, setCurrentPhase] = useState<ReActPhase>('idle')
  const [currentIteration, setCurrentIteration] = useState(0)
  const [currentStreamEventId, setCurrentStreamEventId] = useState<string | null>(null)
  const unlistenRef = useRef<UnlistenFn | null>(null)
  const isStoppedRef = useRef(false)
  const maxIterations = 10 // 最大循环次数，防止无限循环

  // 执行单个工具调用
  const executeToolCall = useCallback(
    async (toolCall: ToolCall): Promise<string> => {
      const server = findToolServer(toolCall.function.name, mcpServers)
      if (!server) {
        throw new Error(`找不到工具 ${toolCall.function.name} 对应的服务器`)
      }

      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(toolCall.function.arguments)
      } catch {
        args = {}
      }

      const result = await invoke<unknown>('execute_mcp_tool_call', {
        serverName: server.key || server.name,
        toolName: toolCall.function.name,
        arguments: args,
        currentResourceId: currentResourceId || null,
        currentTaskId: currentTaskId || null,
      })

      return JSON.stringify(result)
    },
    [mcpServers, currentResourceId, currentTaskId]
  )

  // 执行一轮 AI 调用并返回结果
  const executeAICall = useCallback(
    async (
      chatId: string,
      systemMessage: string,
      includeTools: boolean = false,
    ): Promise<{ content: string; toolCalls?: ToolCall[]; reasoning?: string }> => {
      return new Promise(async (resolve, reject) => {
        const eventId = generateEventId()
        setCurrentStreamEventId(eventId)

        const assistantMessageId = Date.now().toString()
        const assistantMessage: AIMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        }
        updateMessages((prev) => [...prev, assistantMessage])

        let finalContent = ''
        let finalReasoning = ''
        let finalToolCalls: ToolCall[] | undefined = undefined

        const eventName = `ai-chat-stream-${eventId}`
        
        const unlisten = await listen<{
          type: string
          content?: string
          tool_calls?: ToolCall[]
          event_id: string
        }>(eventName, (event) => {
          if (isStoppedRef.current) return

          const payload = event.payload
          if (payload.type === 'content' && payload.content) {
            finalContent += payload.content
            updateMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: msg.content + payload.content }
                  : msg
              )
            )
          } else if (payload.type === 'tool_calls' && payload.tool_calls) {
            finalToolCalls = payload.tool_calls
            updateMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, tool_calls: payload.tool_calls }
                  : msg
              )
            )
          } else if (payload.type === 'reasoning' && payload.content && payload.content.trim().length > 0) {
            finalReasoning += payload.content
            updateMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, reasoning: (msg.reasoning || '') + payload.content }
                  : msg
              )
            )
          } else if (payload.type === 'done' || payload.type === 'stopped') {
            unlisten()
            unlistenRef.current = null
            setCurrentStreamEventId(null)

            // 保存助手消息到数据库
            const hasValidReasoning = finalReasoning.trim().length > 0
            if (finalContent || finalToolCalls || hasValidReasoning) {
              invoke('save_message', {
                chatId,
                role: 'assistant',
                content: finalContent,
                toolCalls: finalToolCalls ? JSON.stringify(finalToolCalls) : null,
                toolCallId: null,
                name: null,
                reasoning: hasValidReasoning ? finalReasoning : null,
              }).catch((err) => {
                console.error('保存助手消息失败:', err)
              })
            }

            if (payload.type === 'stopped') {
              reject(new Error('用户停止'))
            } else {
              resolve({
                content: finalContent,
                toolCalls: finalToolCalls,
                reasoning: hasValidReasoning ? finalReasoning : undefined,
              })
            }
          }
        })
        unlistenRef.current = unlisten

        // 调用 AI API
        const currentMessages = messagesRef.current
        const chatMessages = convertAIMessagesToChatMessages(currentMessages)
        const tools = includeTools ? getAvailableTools(mcpServers) : []

        try {
          await invoke<string>('chat_completion', {
            configId: selectedConfigId,
            messages: chatMessages,
            tools: tools.length > 0 ? tools : null,
            systemMessage: systemMessage,
            eventId: eventId,
          })
        } catch (err) {
          unlisten()
          unlistenRef.current = null
          setCurrentStreamEventId(null)
          reject(err)
        }
      })
    },
    [selectedConfigId, messagesRef, updateMessages, mcpServers]
  )

  // 阶段1: 思考 - 分析问题，决定下一步行动
  const executeThought = useCallback(
    async (chatId: string): Promise<AgentMeta | null> => {
      setCurrentPhase('thought')
      console.log('[ReAct] 阶段1: 思考')
      
      const toolInfoList = getToolInfoList(mcpServers)
      console.log('[ReAct] 可用工具:', toolInfoList.map(t => t.name))
      const systemMessage = generateThoughtPrompt(currentResourceId, currentTaskId, toolInfoList)
      
      // 思考阶段不传工具，让 AI 只做分析决策
      const result = await executeAICall(chatId, systemMessage, false)
      console.log('[ReAct] 思考结果:', result.content.substring(0, 300))
      
      const meta = parseAgentMeta(result.content)
      console.log('[ReAct] 解析的 meta:', meta)
      
      // 如果不需要继续，从消息内容中移除 agent_meta 标签，确保用户能看到完整回答
      if (meta && !meta.shouldContinue) {
        console.log('[ReAct] 原始内容:', result.content)
        console.log('[ReAct] 原始内容长度:', result.content.length)
        
        const cleanedContent = removeAgentMeta(result.content)
        console.log('[ReAct] 清理后内容:', cleanedContent)
        console.log('[ReAct] 清理后内容长度:', cleanedContent.length)
        
        // 如果清理后内容为空，说明 AI 只输出了 agent_meta 标签，没有实际内容
        // 这是不符合要求的，应该记录警告
        let finalContent = cleanedContent
        if (!finalContent || finalContent.trim().length === 0) {
          console.warn('[ReAct] 清理后内容为空，AI 只输出了 agent_meta 标签，没有输出实际内容')
          console.warn('[ReAct] 这不符合提示词要求，AI 应该先输出思考过程和回答内容')
          // 保留空内容，让用户看到问题（而不是用 reason 替代）
          finalContent = ''
        }
        
        // 无论内容是否改变，都更新消息（确保内容正确显示）
        // 更新消息内容，移除 agent_meta 标签
        updateMessages((prev) => {
          // 找到最后一条 assistant 消息（应该是思考阶段的消息）
          let lastAssistantIndex = -1
          for (let i = prev.length - 1; i >= 0; i--) {
            if (prev[i].role === 'assistant') {
              lastAssistantIndex = i
              break
            }
          }
          if (lastAssistantIndex >= 0) {
            const updated = [...prev]
            updated[lastAssistantIndex] = {
              ...updated[lastAssistantIndex],
              content: finalContent,
            }
            console.log('[ReAct] 更新消息内容，索引:', lastAssistantIndex, '内容长度:', finalContent.length)
            return updated
          }
          console.warn('[ReAct] 未找到最后一条 assistant 消息')
          return prev
        })
        
        // 更新数据库中的消息内容
        const lastAssistantMsg = [...messagesRef.current].reverse().find(
          (msg) => msg.role === 'assistant'
        )
        if (lastAssistantMsg) {
          await invoke('save_message', {
            chatId,
            role: 'assistant',
            content: finalContent,
            toolCalls: null,
            toolCallId: null,
            name: null,
            reasoning: null,
          }).catch((err) => {
            console.error('更新思考消息失败:', err)
          })
          console.log('[ReAct] 已更新数据库中的消息内容')
        } else {
          console.warn('[ReAct] 未找到最后一条 assistant 消息用于数据库更新')
        }
      }
      
      return meta
    },
    [executeAICall, updateMessages, messagesRef, currentResourceId, currentTaskId, mcpServers]
  )

  // 阶段2: 行动 - 执行具体行动
  const executeAction = useCallback(
    async (chatId: string): Promise<{ content: string; toolCalls?: ToolCall[] }> => {
      setCurrentPhase('action')
      console.log('[ReAct] 阶段2: 行动')
      
      const toolInfoList = getToolInfoList(mcpServers)
      
      // 生成通用的行动提示词，让 AI 自己判断行动类型
      const systemMessage = generateActionPrompt(currentResourceId, currentTaskId, toolInfoList)
      console.log('[ReAct] 行动 prompt:', systemMessage)
      
      // 总是传入工具列表，让 AI 自己判断是否需要调用工具
      const result = await executeAICall(chatId, systemMessage, toolInfoList.length > 0)
      console.log('[ReAct] 行动结果 - toolCalls:', result.toolCalls)
      return result
    },
    [executeAICall, currentResourceId, currentTaskId, mcpServers]
  )

  // 阶段3: 观察 - 总结工具结果
  const executeObservation = useCallback(
    async (chatId: string): Promise<string> => {
      setCurrentPhase('observation')
      console.log('[ReAct] 阶段3: 观察')
      
      const systemMessage = generateObservationPrompt(currentResourceId, currentTaskId)
      const result = await executeAICall(chatId, systemMessage, false)
      
      // 直接返回完整内容，不做任何解析和修改
      return result.content
    },
    [executeAICall, currentResourceId, currentTaskId]
  )

  // ReAct 主循环
  const runReActLoop = useCallback(
    async (chatId: string) => {
      let iteration = 0

      while (iteration < maxIterations && !isStoppedRef.current) {
        iteration++
        setCurrentIteration(iteration)
        console.log(`[ReAct] ========== 第 ${iteration} 轮迭代 ==========`)

        try {
          // 阶段1: 思考 - 分析问题，决定下一步行动
          const thoughtMeta = await executeThought(chatId)
          
          if (!thoughtMeta) {
            console.log('[ReAct] 思考阶段未返回有效 meta，结束循环')
            break
          }

          console.log('[ReAct] 思考决定:', thoughtMeta)

          // 检查是否结束（思考阶段已经包含了回答内容）
          if (!thoughtMeta.shouldContinue) {
            console.log('[ReAct] 思考决定结束循环（回答已在思考中输出）')
            break
          }

          // 阶段2: 行动 - 执行具体行动
          const actionResult = await executeAction(chatId)
          
          // 检查是否有工具调用
          if (actionResult.toolCalls && actionResult.toolCalls.length > 0) {
            // 检查是否需要用户确认
            const allDefault = areAllDefaultMCPTools(actionResult.toolCalls, mcpServers)
            
            if (!allDefault) {
              // 非默认工具需要用户确认，暂停循环
              console.log('[ReAct] 工具需要用户确认，暂停循环')
              const lastAssistantMsg = [...messagesRef.current].reverse().find(
                (m: AIMessage) => m.role === 'assistant' && m.tool_calls
              )
              if (lastAssistantMsg) {
                updateMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === lastAssistantMsg.id
                      ? { ...msg, pendingToolCalls: actionResult.toolCalls }
                      : msg
                  )
                )
              }
              break
            }

            // 执行工具调用
            console.log('[ReAct] 执行工具调用')
            for (const toolCall of actionResult.toolCalls) {
              try {
                const toolResult = await executeToolCall(toolCall)
                
                // 添加工具结果消息
                const toolMessage: AIMessage = {
                  id: Date.now().toString() + Math.random(),
                  role: 'tool',
                  content: toolResult,
                  timestamp: new Date(),
                  tool_call_id: toolCall.id,
                  name: toolCall.function.name,
                }
                updateMessages((prev) => [...prev, toolMessage])

                // 保存工具结果到数据库
                await invoke('save_message', {
                  chatId,
                  role: 'tool',
                  content: toolResult,
                  toolCalls: null,
                  toolCallId: toolCall.id,
                  name: toolCall.function.name,
                  reasoning: null,
                })
              } catch (err) {
                console.error('工具调用失败:', err)
                message.error(`工具调用失败: ${err}`)
              }
            }

            // 阶段3: 观察 - 总结工具结果
            console.log('[ReAct] 开始执行观察阶段')
            try {
              await executeObservation(chatId)
              console.log('[ReAct] 观察阶段完成，准备进入下一轮')
            } catch (obsErr) {
              console.error('[ReAct] 观察阶段出错:', obsErr)
            }
            
            // 继续下一轮循环
            console.log('[ReAct] 执行 continue')
            continue
          }

          // 没有工具调用，说明是 answer 或 analyze，检查是否结束
          console.log('[ReAct] 行动完成，无工具调用')
          break

        } catch (err) {
          if ((err as Error).message === '用户停止') {
            console.log('[ReAct] 用户停止循环')
          } else {
            console.error('[ReAct] 执行出错:', err)
            message.error(`AI 对话失败: ${err}`)
          }
          break
        }
      }

      if (iteration >= maxIterations) {
        console.warn('[ReAct] 达到最大迭代次数限制')
        message.warning('AI 达到最大迭代次数限制')
      }

      setCurrentPhase('idle')
      setCurrentIteration(0)
      setIsStreaming(false)
    },
    [executeThought, executeAction, executeObservation, executeToolCall, mcpServers, messagesRef, updateMessages, message]
  )

  // 启动 ReAct Agent
  const startReActAgent = useCallback(
    async (chatId: string) => {
      isStoppedRef.current = false
      setIsStreaming(true)
      await runReActLoop(chatId)
    },
    [runReActLoop]
  )

  // 停止 ReAct Agent
  const stopReActAgent = useCallback(async () => {
    isStoppedRef.current = true
    if (currentStreamEventId) {
      try {
        await invoke('stop_chat_stream', { eventId: currentStreamEventId })
      } catch (err) {
        console.error('停止流式响应失败:', err)
      }
    }
    if (unlistenRef.current) {
      unlistenRef.current()
      unlistenRef.current = null
    }
    setIsStreaming(false)
    setCurrentStreamEventId(null)
  }, [currentStreamEventId])

  // 手动确认工具调用后继续执行
  const continueAfterToolConfirm = useCallback(
    async (toolCalls: ToolCall[], chatId: string) => {
      setIsStreaming(true)
      isStoppedRef.current = false

      // 执行工具调用
      for (const toolCall of toolCalls) {
        try {
          const toolResult = await executeToolCall(toolCall)
          
          const toolMessage: AIMessage = {
            id: Date.now().toString() + Math.random(),
            role: 'tool',
            content: toolResult,
            timestamp: new Date(),
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
          }
          updateMessages((prev) => [...prev, toolMessage])

          await invoke('save_message', {
            chatId,
            role: 'tool',
            content: toolResult,
            toolCalls: null,
            toolCallId: toolCall.id,
            name: toolCall.function.name,
            reasoning: null,
          })
        } catch (err) {
          console.error('工具调用失败:', err)
          message.error(`工具调用失败: ${err}`)
        }
      }

      // 继续 ReAct 循环
      await runReActLoop(chatId)
    },
    [executeToolCall, updateMessages, runReActLoop, message]
  )

  return {
    isStreaming,
    setIsStreaming,
    currentStreamEventId,
    currentPhase,
    currentIteration,
    startReActAgent,
    stopReActAgent,
    continueAfterToolConfirm,
  }
}

