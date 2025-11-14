import React from 'react'

export interface ToolResultContentItem {
  type: 'text' | 'json' | 'webcomponent'
  value: string
}

interface ToolResultDisplayProps {
  items: ToolResultContentItem[]
}

const ToolResultDisplay: React.FC<ToolResultDisplayProps> = ({ items }) => {

  // 渲染单个内容项
  const renderItem = (item: ToolResultContentItem, index: number) => {
    switch (item.type) {
      case 'text':
        // 使用 whitespace-pre-wrap 来处理换行符 \n
        return (
          <div key={index} className="text-sm text-base-content whitespace-pre-wrap break-words">
            {item.value}
          </div>
        )
      
      case 'json':
        try {
          const jsonObj = JSON.parse(item.value)
          return (
            <div key={index} className="bg-base-200 rounded-lg p-3 border border-base-300">
              <pre className="text-xs text-base-content/80 whitespace-pre-wrap break-words overflow-auto max-h-96">
                {JSON.stringify(jsonObj, null, 2)}
              </pre>
            </div>
          )
        } catch {
          // 如果 JSON 解析失败，作为文本显示
          return (
            <div key={index} className="text-sm text-base-content whitespace-pre-wrap break-words">
              {item.value}
            </div>
          )
        }
      
      case 'webcomponent':
        // 对于 webcomponent，使用 dangerouslySetInnerHTML 渲染
        // 注意：这可能有安全风险，但在受控环境中可以使用
        return (
          <div 
            key={index} 
            className="text-sm text-base-content"
            dangerouslySetInnerHTML={{ __html: item.value }}
          />
        )
      
      default:
        return (
          <div key={index} className="text-sm text-base-content whitespace-pre-wrap break-words">
            {item.value}
          </div>
        )
    }
  }

  if (!items || items.length === 0) {
    return (
      <div className="text-sm text-base-content/50 italic">
        无内容
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => renderItem(item, index))}
    </div>
  )
}

// 解析工具调用结果内容的辅助函数
export function parseToolResultContent(content: string): ToolResultContentItem[] {
  try {
    // 尝试解析为 JSON
    const parsed = JSON.parse(content)
    
    // 如果包含 content 数组，使用它
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.content)) {
      return parsed.content.map((item: any) => ({
        type: (item.type || 'text') as 'text' | 'json' | 'webcomponent',
        value: item.value || item.text || '', // 兼容旧的 text 字段
      }))
    } else if (Array.isArray(parsed)) {
      // 如果直接是数组
      return parsed.map((item: any) => ({
        type: (item.type || 'text') as 'text' | 'json' | 'webcomponent',
        value: item.value || item.text || '',
      }))
    } else {
      // 如果是普通对象，转换为 text 类型
      return [{
        type: 'text',
        value: JSON.stringify(parsed, null, 2),
      }]
    }
  } catch {
    // 如果解析失败，作为纯文本处理
    return [{
      type: 'text',
      value: content,
    }]
  }
}

export default ToolResultDisplay

