import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ComponentProps } from '../ComponentRegistry'
import { parsePartialJson } from '../../../utils/partialJsonParser'
import {
  PlannerResponse,
  VerifierResponse,
  Todo,
} from '../../../agents/agentTypes'
import TodoList from './TodoList'
import { markdownComponents } from '../MarkdownComponents'

type ResponseType = 'planner' | 'verifier'

// 字段渲染配置类型
type FieldRenderConfig =
  | {
      type: 'component'
      component: string
      data: any
      props?: Record<string, any>
    }
  | { type: 'markdown'; data: string }

interface StreamJsonDisplayConfig {
  responseType: ResponseType
  containerClassName?: string
  // 字段映射配置：将响应数据字段映射到渲染配置
  fieldMapping?: Record<string, FieldRenderConfig>
  // 自定义字段提取函数
  extractFields?: (
    data: Partial<PlannerResponse | VerifierResponse>,
  ) => Record<string, any>
  renderExtraContent?: (
    data: Partial<PlannerResponse | VerifierResponse>,
    isValid: boolean,
  ) => React.ReactNode
  plannerTodos?: Todo[] // Planner 的原始 todos，用于 verifier 匹配任务说明
}

interface StreamJsonDisplayProps {
  props: ComponentProps & { config?: StreamJsonDisplayConfig }
}

// 组件分发器
const ComponentRenderer: React.FC<{
  component: string
  data: any
  props?: Record<string, any>
}> = ({ component, data, props = {} }) => {
  if (component === 'TodoList') {
    return <TodoList todos={data} {...props} />
  }
  // 可以在这里添加更多组件分发逻辑
  return null
}

const StreamJsonDisplay: React.FC<StreamJsonDisplayProps> = ({ props }) => {
  const { content, config } = props as {
    content: string
    config?: StreamJsonDisplayConfig
  }

  if (!config) {
    return (
      <div className="stream-json-display">
        <div className="text-sm text-error">配置错误：缺少 config</div>
      </div>
    )
  }

  const {
    responseType,
    containerClassName,
    fieldMapping,
    extractFields,
    renderExtraContent,
    plannerTodos,
  } = config

  // 始终尝试解析 JSON，即使不完整
  const parsed = useMemo(() => {
    // 尝试提取 JSON 部分
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      // 如果没有找到 JSON 结构，返回一个空结果
      return {
        data: {} as Partial<PlannerResponse | VerifierResponse>,
        isValid: false,
        raw: content,
      }
    }

    try {
      if (responseType === 'planner') {
        return parsePartialJson<PlannerResponse>(jsonMatch[0])
      } else {
        return parsePartialJson<VerifierResponse>(jsonMatch[0])
      }
    } catch (error) {
      // JSON 解析完全失败，返回空结果
      console.warn('JSON 解析失败:', error)
      return {
        data: {} as Partial<PlannerResponse | VerifierResponse>,
        isValid: false,
        raw: content,
      }
    }
  }, [content, responseType])

  const { data, isValid } = parsed

  // 检查是否找到了 JSON 结构
  const hasJsonStructure = useMemo(() => {
    return !!content.match(/\{[\s\S]*\}/)
  }, [content])

  // 提取字段数据
  const extractedFields = useMemo(() => {
    if (extractFields) {
      return extractFields(data)
    }

    // 默认字段提取逻辑
    if (responseType === 'planner') {
      const plannerData = data as Partial<PlannerResponse>
      return {
        summary: plannerData.summary,
        todos: plannerData.todos || [],
        needsMorePlanning: plannerData.needsMorePlanning,
      }
    } else {
      const verifierData = data as Partial<VerifierResponse>
      // 转换 verifier tasks 为 todos
      let todos: Todo[] = []
      if (verifierData.tasks && Array.isArray(verifierData.tasks)) {
        todos = verifierData.tasks.map((task) => {
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
      }
      return {
        overallFeedback: verifierData.overallFeedback,
        todos,
        allCompleted: verifierData.allCompleted,
      }
    }
  }, [data, responseType, plannerTodos, extractFields])

  // 检查是否有任何有效的数据字段
  const hasData = useMemo(() => {
    return Object.values(extractedFields).some((value) => {
      if (Array.isArray(value)) return value.length > 0
      if (typeof value === 'string') return value.trim().length > 0
      if (typeof value === 'boolean') return true // boolean 值也算有效数据
      return value !== undefined && value !== null
    })
  }, [extractedFields])

  // 如果没有有效数据，不显示任何内容（包括原始 JSON）
  // 只有在以下情况才显示：
  // 1. 有有效数据（hasData === true）
  // 2. 或者内容不是 JSON 格式且是 planner 类型（可能是纯文本总结）
  if (!hasData) {
    // 如果内容不是 JSON 格式，且是 planner 类型，可能是纯文本总结，使用 markdown 渲染
    if (!hasJsonStructure && responseType === 'planner' && content.trim().length > 0) {
      return (
        <div
          className={`stream-json-display ${
            containerClassName || ''
          }`}
        >
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
    // 其他情况（包括 JSON 解析失败但没有有效数据）不显示内容
    return null
  }

  // 自动生成字段映射配置
  const defaultFieldMapping = useMemo<Record<string, FieldRenderConfig>>(() => {
    if (fieldMapping) {
      return fieldMapping
    }

    // 自动从 extractedFields 中生成映射
    // 根据字段类型和名称自动决定渲染方式
    const mapping: Record<string, FieldRenderConfig> = {}
    
    Object.entries(extractedFields).forEach(([fieldName, fieldValue]) => {
      // 跳过无效值
      if (fieldValue === undefined || fieldValue === null) {
        return
      }

      // todos 字段使用 TodoList 组件
      if (fieldName === 'todos' && Array.isArray(fieldValue) && fieldValue.length > 0) {
        mapping[fieldName] = {
          type: 'component',
          component: 'TodoList',
          data: fieldValue as Todo[],
          props: responseType === 'verifier' 
            ? { title: `任务验证结果 (${fieldValue.length})` }
            : undefined,
        }
        return
      }

      // 字符串字段使用 markdown 渲染
      if (typeof fieldValue === 'string' && fieldValue.trim().length > 0) {
        mapping[fieldName] = {
          type: 'markdown',
          data: fieldValue,
        }
        return
      }

      // 布尔值等其他类型跳过（不渲染）
    })

    return mapping
  }, [fieldMapping, responseType, extractedFields])

  // 渲染字段
  const renderField = (
    fieldName: string,
    config: FieldRenderConfig,
  ): React.ReactNode => {
    switch (config.type) {
      case 'component':
        // 对于 component 类型，使用 config.data，如果为空则不渲染
        if (!config.data || (Array.isArray(config.data) && config.data.length === 0)) {
          return null
        }
        return (
          <ComponentRenderer
            key={fieldName}
            component={config.component}
            data={config.data}
            props={config.props}
          />
        )
      case 'markdown':
        // 对于 markdown 类型，使用 config.data，如果为空则不渲染
        if (!config.data || typeof config.data !== 'string' || config.data.trim().length === 0) {
          return null
        }
        return (
          <div
            key={fieldName}
            className="summary-section prose prose-sm max-w-none text-base-content"
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {config.data}
            </ReactMarkdown>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div
      className={`stream-json-display space-y-4 ${
        containerClassName || ''
      }`}
    >
      {/* 根据字段映射渲染各个字段 */}
      {Object.entries(defaultFieldMapping).map(([fieldName, config]) =>
        renderField(fieldName, config),
      )}

      {/* 额外的内容渲染 */}
      {renderExtraContent && renderExtraContent(data, isValid)}

      {/* 流式传输提示 */}
      {!isValid && hasData && (
        <div className="text-xs text-warning/70 italic">正在接收数据...</div>
      )}
    </div>
  )
}

export default StreamJsonDisplay
export type { StreamJsonDisplayConfig }
