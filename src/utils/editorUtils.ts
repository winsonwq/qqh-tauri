import { $getRoot, LexicalEditor } from 'lexical'

/**
 * 发送编辑器内容
 * @param editor Lexical 编辑器实例
 * @param onSend 发送回调函数
 */
export function sendContent(editor: LexicalEditor, onSend?: (content: string) => void) {
  if (!onSend) return
  
  editor.getEditorState().read(() => {
    const root = $getRoot()
    const content = root.getTextContent()
    if (content.trim()) {
      onSend(content.trim())
      // 清空编辑器
      editor.update(() => {
        const root = $getRoot()
        root.clear()
      })
    }
  })
}

/**
 * Lexical 编辑器错误处理函数
 * 捕获 Lexical 更新过程中发生的错误并记录它们
 * 如果不抛出错误，Lexical 会尝试优雅地恢复，而不会丢失用户数据
 */
export function onLexicalError(error: Error) {
  console.error('Lexical Editor Error:', error)
  // 可以根据需要决定是否抛出错误
  // 如果不抛出，Lexical 会尝试优雅恢复
}

