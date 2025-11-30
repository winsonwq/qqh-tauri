import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { parsePartialJson } from '../utils/jsonParser'
import { ExecutorResponse } from '../core/types'
import { markdownComponents } from '../../components/AI/MarkdownComponents'
import TodoList from './TodoList'

export interface ExecutorResponseDisplayProps {
  content: string
}

const ExecutorResponseDisplay: React.FC<ExecutorResponseDisplayProps> = ({
  content,
}) => {
  // 解析 JSON
  const parsed = useMemo(() => {
    try {
      return parsePartialJson<ExecutorResponse>(content)
    } catch (error) {
      console.warn('JSON 解析失败:', error)
      return {
        data: {} as Partial<ExecutorResponse>,
        isValid: false,
        raw: content,
        textContent: '',
      }
    }
  }, [content])

  const { data, textContent } = parsed

  // 提取数据字段，使用安全的默认值
  // 优先使用 textContent（<data> 标签前的文本），其次使用 data.summary
  const summary = textContent || data?.summary
  const todos = data?.todos

  // 检查是否有有效数据，确保 summary 是字符串类型
  const summaryText = typeof summary === 'string' ? summary : String(summary || '')
  const todosArray = Array.isArray(todos) ? todos : []
  
  return (
    <div className="executor-response stream-json-display space-y-4">
      {/* 渲染 summary（来自 textContent 或 data.summary） */}
      {summaryText.trim().length > 0 && (
        <div className="summary-section prose prose-sm max-w-none text-base-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents as any}
          >
            {summaryText}
          </ReactMarkdown>
        </div>
      )}

      {/* 渲染 todos */}
      {todosArray.length > 0 && (
        <TodoList todos={todosArray} />
      )}
    </div>
  )
}

export default ExecutorResponseDisplay

