import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ComponentProps } from '../ComponentRegistry'
import { parsePartialJson } from '../../../utils/partialJsonParser'
import { VerifierResponse, Todo } from '../../../agents/agentTypes'
import { markdownComponents } from '../MarkdownComponents'
import TodoList from './TodoList'

interface VerifierResponseDisplayProps {
  props: ComponentProps
}

const VerifierResponseDisplay: React.FC<VerifierResponseDisplayProps> = ({
  props,
}) => {
  const { content } = props
  const existingConfig = (props as any).config
  // 使用 useMemo 稳定 plannerTodos 的引用
  const plannerTodos = useMemo(() => {
    return existingConfig?.plannerTodos as Todo[] | undefined
  }, [existingConfig?.plannerTodos])

  // 解析 JSON
  const parsed = useMemo(() => {
    try {
      return parsePartialJson<VerifierResponse>(content)
    } catch (error) {
      console.warn('JSON 解析失败:', error)
      return {
        data: null as VerifierResponse | null,
        isValid: false,
      }
    }
  }, [content])

  const { data } = parsed

  const todos: Todo[] = useMemo(() => {
    if (!data || !data.tasks || !Array.isArray(data.tasks)) {
      return []
    }
    return data.tasks.map((task) => {
      const status: Todo['status'] = task.completed ? 'completed' : 'failed'
      let description = task.id || '任务'
      if (plannerTodos && Array.isArray(plannerTodos)) {
        const plannerTodo = plannerTodos.find((t) => t.id === task.id)
        if (plannerTodo && plannerTodo.description) {
          description = plannerTodo.description
        }
      }
      return {
        id: task.id,
        description,
        status,
        result: task.feedback || undefined,
        priority: 0,
      }
    })
  }, [data, plannerTodos])

  // 检查是否有有效数据
  const overallFeedback = data?.overallFeedback
  const overallFeedbackText = typeof overallFeedback === 'string' ? overallFeedback : String(overallFeedback || '')
  const hasData =
    (overallFeedbackText.trim().length > 0) ||
    todos.length > 0 ||
    data?.allCompleted !== undefined

  // 如果没有有效数据，不显示
  // 注意：流式传输时，即使 JSON 不完整，如果有部分数据也应该显示
  if (!hasData) {
    return null
  }

  return (
    <div className="verifier-response stream-json-display space-y-4">
      {overallFeedbackText.trim().length > 0 && (
        <div className="summary-section prose prose-sm max-w-none text-base-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {overallFeedbackText}
          </ReactMarkdown>
        </div>
      )}

      {todos.length > 0 && (
        <TodoList todos={todos} title={`任务验证结果 (${todos.length})`} />
      )}
    </div>
  )
}

export default VerifierResponseDisplay
