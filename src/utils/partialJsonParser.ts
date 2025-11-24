/**
 * Partial JSON 解析工具
 * 使用 partial-json-parser 库来解析不完整的 JSON 字符串
 */

// @ts-ignore - partial-json-parser 可能没有类型定义
import partialParse from 'partial-json-parser'

export interface PartialJsonResult<T> {
  data: Partial<T>
  isValid: boolean
  raw: string
}

/**
 * 清理 markdown 代码块标记
 * 去除开头的 ```json 或 ``` 和末尾的 ```
 */
function cleanMarkdownCodeBlock(jsonString: string): string {
  let cleaned = jsonString.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '')
  cleaned = cleaned.replace(/\n?```\s*$/, '')

  return cleaned.trim()
}

/**
 * 解析部分 JSON
 * 支持流式场景下不完整的 JSON 字符串
 *
 * @param jsonString - 可能不完整的 JSON 字符串
 * @returns 解析结果，包含部分数据、是否完整、原始字符串
 */
export function parsePartialJson<T extends Record<string, any>>(
  jsonString: string,
): PartialJsonResult<T> {
  try {
    const cleaned = cleanMarkdownCodeBlock(jsonString)
    const parsed = partialParse(cleaned) as Partial<T>
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
    }
  } catch (error) {
    return {
      data: {} as Partial<T>,
      isValid: false,
      raw: jsonString,
    }
  }
}
