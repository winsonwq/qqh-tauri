import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { $getRoot, EditorState, LexicalEditor } from 'lexical'
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { TagNode } from './TagNode'
import { MentionPlugin, MentionOption } from './MentionPlugin'
import './RichTextEditor.css'

interface RichTextEditorProps {
  placeholder?: string
  onSend?: (content: string) => void
  minHeight?: number
  maxHeight?: number
  mentionOptions?: MentionOption[]
  onMentionSearch?: (query: string, trigger: string) => Promise<MentionOption[]>
  triggers?: string[]
}

export interface RichTextEditorRef {
  send: () => void
}

// Autosize 插件
function AutosizePlugin({ minHeight = 40, maxHeight = 200 }: { minHeight?: number; maxHeight?: number }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const updateHeight = () => {
      const rootElement = editor.getRootElement()
      if (rootElement) {
        const contentEditable = rootElement.querySelector('[contenteditable="true"]') as HTMLElement
        if (contentEditable) {
          contentEditable.style.height = 'auto'
          const scrollHeight = contentEditable.scrollHeight
          const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
          contentEditable.style.height = `${newHeight}px`
        }
      }
    }

    // 监听编辑器内容变化
    const removeUpdateListener = editor.registerUpdateListener(() => {
      setTimeout(updateHeight, 0)
    })

    // 初始设置
    setTimeout(updateHeight, 100)

    return () => {
      removeUpdateListener()
    }
  }, [editor, minHeight, maxHeight])

  return null
}

// 占位符组件
function Placeholder({ placeholder }: { placeholder?: string }) {
  const [editor] = useLexicalComposerContext()
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    const removeUpdateListener = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot()
        const isEmpty = root.getTextContent().trim() === ''
        setIsEmpty(isEmpty)
      })
    })

    return () => {
      removeUpdateListener()
    }
  }, [editor])

  if (!isEmpty || !placeholder) {
    return null
  }

  return (
    <div className="rich-text-editor-placeholder">
      {placeholder}
    </div>
  )
}

// 发送内容的辅助函数
const sendContent = (editor: LexicalEditor, onSend?: (content: string) => void) => {
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

// 编辑器内容组件
function EditorContent({ 
  placeholder, 
  onSend,
  onEditorReady
}: { 
  placeholder?: string
  onSend?: (content: string) => void
  onEditorReady?: (editor: LexicalEditor) => void
}) {
  const [editor] = useLexicalComposerContext()
  const contentRef = useRef<HTMLDivElement>(null)

  // 通知父组件编辑器已准备好
  useEffect(() => {
    if (onEditorReady) {
      onEditorReady(editor)
    }
  }, [editor, onEditorReady])

  // 处理键盘事件
  useEffect(() => {
    if (!onSend) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendContent(editor, onSend)
      }
    }

    const contentEditable = contentRef.current
    if (contentEditable) {
      contentEditable.addEventListener('keydown', handleKeyDown)
      return () => {
        contentEditable.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [editor, onSend])

  return (
    <div className="rich-text-editor-wrapper" ref={contentRef}>
      <ContentEditable
        className="rich-text-editor-content"
        spellCheck={false}
        style={{
          outline: 'none',
          minHeight: '40px',
          padding: '12px',
        }}
      />
      <Placeholder placeholder={placeholder} />
    </div>
  )
}

// 错误处理函数
// 捕获 Lexical 更新过程中发生的错误并记录它们
// 如果不抛出错误，Lexical 会尝试优雅地恢复，而不会丢失用户数据
function onError(error: Error) {
  console.error('Lexical Editor Error:', error)
  // 可以根据需要决定是否抛出错误
  // 如果不抛出，Lexical 会尝试优雅恢复
}

const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(({
  placeholder = '在这里输入消息，按 Enter 发送...',
  onSend,
  minHeight = 40,
  maxHeight = 200,
  mentionOptions = [],
  onMentionSearch,
  triggers = ['#', '@'],
}, ref) => {
  const editorRef = useRef<LexicalEditor | null>(null)

  const initialConfig = {
    namespace: 'AIMessageEditor',
    theme: {
      paragraph: 'rich-text-editor-paragraph',
      text: {
        bold: 'rich-text-editor-text-bold',
        italic: 'rich-text-editor-text-italic',
        underline: 'rich-text-editor-text-underline',
      },
    },
    nodes: [TagNode],
    onError,
  }

  const handleChange = (_editorState: EditorState, editor: LexicalEditor) => {
    editorRef.current = editor
  }

  // 暴露发送方法给父组件
  useImperativeHandle(ref, () => ({
    send: () => {
      if (editorRef.current) {
        sendContent(editorRef.current, onSend)
      }
    },
  }), [onSend])

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="rich-text-editor-container" style={{ position: 'relative' }}>
        <RichTextPlugin
          contentEditable={
            <EditorContent 
              placeholder={placeholder} 
              onSend={onSend}
              onEditorReady={(editor) => {
                editorRef.current = editor
              }}
            />
          }
          placeholder={null}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <OnChangePlugin onChange={handleChange} />
        <AutosizePlugin minHeight={minHeight} maxHeight={maxHeight} />
        <MentionPlugin
          triggers={triggers}
          options={mentionOptions}
          onSearch={onMentionSearch}
        />
      </div>
    </LexicalComposer>
  )
})

RichTextEditor.displayName = 'RichTextEditor'

export default RichTextEditor

