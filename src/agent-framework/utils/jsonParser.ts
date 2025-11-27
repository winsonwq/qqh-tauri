
/**
 * Partial JSON 解析工具
 * 使用 partial-json-parser 库来解析不完整的 JSON 字符串
 * 支持混合格式：文本内容 + <data>JSON</data>
 */

// @ts-ignore - partial-json-parser 可能没有类型定义
import partialParse from 'partial-json-parser'

export interface PartialJsonResult<T> {
  data: Partial<T>
  isValid: boolean
  raw: string
  /** <data> 标签之前的文本内容 */
  textContent: string
}

/**
 * 从混合内容中提取 <agent_meta> 标签内的 JSON 和标签前的文本
 */
function extractFromDataTag(content: string): { textContent: string; jsonContent: string } {
  // 匹配 <agent_meta>...</agent_meta> 标签（支持不完整的结束标签，用于流式解析）
  const dataTagMatch = content.match(/<agent_meta>([\s\S]*?)(?:<\/agent_meta>|$)/)
  
  if (dataTagMatch) {
    const dataStartIndex = content.indexOf('<agent_meta>')
    const textContent = content.substring(0, dataStartIndex).trim()
    const jsonContent = dataTagMatch[1].trim()
    return { textContent, jsonContent }
  }
  
  // 如果没有 <agent_meta> 标签，返回原始内容
  return { textContent: '', jsonContent: content }
}

/**
 * 从混合内容中提取 JSON 对象
 * 支持从包含普通文本和 JSON 的混合内容中提取最后一个完整的 JSON 对象
 */
function extractJsonFromMixedContent(content: string): string {
  // 首先尝试提取 markdown 代码块中的 JSON
  const jsonCodeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (jsonCodeBlockMatch && jsonCodeBlockMatch[1]) {
    return jsonCodeBlockMatch[1].trim()
  }

  // 如果没有代码块，尝试从内容中提取最后一个 JSON 对象
  const jsonMatches = []
  let depth = 0
  let startIndex = -1
  
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '{') {
      if (depth === 0) {
        startIndex = i
      }
      depth++
    } else if (content[i] === '}') {
      depth--
      if (depth === 0 && startIndex !== -1) {
        jsonMatches.push(content.substring(startIndex, i + 1))
        startIndex = -1
      }
    }
  }
  
  if (jsonMatches.length > 0) {
    return jsonMatches[jsonMatches.length - 1]
  }
  
  return content
}

/**
 * 清理 markdown 代码块标记
 */
function cleanMarkdownCodeBlock(jsonString: string): string {
  let cleaned = jsonString.trim()
  
  cleaned = cleaned.replace(/^```+\s*(?:json\s*)?```*(?:json)?\s*\n?/i, '```')
  
  const jsonCodeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  
  if (jsonCodeBlockMatch && jsonCodeBlockMatch[1]) {
    cleaned = jsonCodeBlockMatch[1].trim()
  } else {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '')
    if (cleaned.includes('```')) {
      cleaned = cleaned.replace(/\n?```+\s*$/, '')
    }
  }

  return cleaned.trim()
}

/**
 * 解析部分 JSON
 * 支持混合格式：文本内容 + <data>JSON</data>
 */
export function parsePartialJson<T extends Record<string, any>>(
  jsonString: string,
): PartialJsonResult<T> {
  try {
    // 首先尝试从 <data> 标签中提取
    const { textContent, jsonContent } = extractFromDataTag(jsonString)
    
    // 如果有 <data> 标签，使用标签内的内容；否则使用传统方式提取
    let extractedJson = jsonContent
    if (!textContent && !jsonContent.startsWith('{')) {
      extractedJson = extractJsonFromMixedContent(jsonString)
    }
    
    const cleaned = cleanMarkdownCodeBlock(extractedJson)
    
    if (!cleaned.trim()) {
      return {
        data: {} as Partial<T>,
        isValid: false,
        raw: jsonString,
        textContent,
      }
    }
    
    let parsed: Partial<T>
    try {
      parsed = partialParse(cleaned) as Partial<T>
    } catch (parseError) {
      try {
        parsed = JSON.parse(cleaned) as Partial<T>
      } catch {
        parsed = {} as Partial<T>
      }
    }
    
    const isValid = (() => {
      try {
        JSON.parse(cleaned)
        return true
      } catch {
        return false
      }
    })()

    return {
      data: parsed,
      isValid,
      raw: jsonString,
      textContent,
    }
  } catch (error) {
    try {
      const { textContent, jsonContent } = extractFromDataTag(jsonString)
      let extractedJson = jsonContent
      if (!textContent && !jsonContent.startsWith('{')) {
        extractedJson = extractJsonFromMixedContent(jsonString)
      }
      const cleaned = cleanMarkdownCodeBlock(extractedJson)
      const parsed = partialParse(cleaned) as Partial<T>
      return {
        data: parsed,
        isValid: false,
        raw: jsonString,
        textContent,
      }
    } catch {
      return {
        data: {} as Partial<T>,
        isValid: false,
        raw: jsonString,
        textContent: '',
      }
    }
  }
}

