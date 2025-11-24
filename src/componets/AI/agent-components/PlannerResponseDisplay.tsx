import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ComponentProps } from '../ComponentRegistry'
import { parsePartialJson } from '../../../utils/partialJsonParser'
import { PlannerResponse } from '../../../agents/agentTypes'
import { markdownComponents } from '../MarkdownComponents'
import TodoList from './TodoList'

interface PlannerResponseDisplayProps {
  props: ComponentProps
}

const PlannerResponseDisplay: React.FC<PlannerResponseDisplayProps> = ({
  props,
}) => {
  const { content } = props

  // 解析 JSON
  const parsed = useMemo(() => {
    try {
      return parsePartialJson<PlannerResponse>(content)
    } catch (error) {
      console.warn('JSON 解析失败:', error)
      return {
        data: {} as Partial<PlannerResponse>,
        isValid: false,
        raw: content,
      }
    }
  }, [content])

  const { data, isValid } = parsed

  // 检查是否有 JSON 结构（通过检查内容是否包含 JSON 特征来判断）
  const hasJsonStructure = content.trim().match(/\{[\s\S]*\}/) !== null

  // 如果没有 JSON 结构，可能是纯文本总结
  if (!hasJsonStructure && content.trim().length > 0) {
    return (
      <div className="planner-response stream-json-display">
        <div className="summary-section prose prose-sm max-w-none text-base-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    )
  }

  // 如果有 JSON 结构但没有有效数据，不显示（除非正在流式传输）
  if (!data || Object.keys(data).length === 0) {
    return null
  }

  const { summary, todos, needsMorePlanning } = data

  // 检查是否有有效数据
  const hasData =
    (summary && summary.trim().length > 0) ||
    (Array.isArray(todos) && todos.length > 0) ||
    needsMorePlanning !== undefined

  if (!hasData) {
    return null
  }

  return (
    <div className="planner-response stream-json-display space-y-4">
      {/* 渲染 summary */}
      {summary && summary.trim().length > 0 && (
        <div className="summary-section prose prose-sm max-w-none text-base-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {summary}
          </ReactMarkdown>
        </div>
      )}

      {/* 渲染 todos */}
      {Array.isArray(todos) && todos.length > 0 && (
        <TodoList todos={todos} />
      )}

      {/* 流式传输提示 */}
      {!isValid && (
        <div className="text-xs text-warning/70 italic">正在接收数据...</div>
      )}
    </div>
  )
}

export default PlannerResponseDisplay
