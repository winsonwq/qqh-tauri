import { useState, useEffect, useRef, useCallback } from 'react'
import { AIMessage } from '../utils/aiMessageUtils'

export function useStickyMessages(
  messages: AIMessage[],
  scrollContainerRef: React.RefObject<HTMLDivElement | null>,
  chatBarHeight: number,
) {
  const [stickyMessageId, setStickyMessageId] = useState<string | null>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // 注册消息元素的 ref
  const setMessageRef = useCallback((messageId: string, element: HTMLDivElement | null) => {
    if (element) {
      messageRefs.current.set(messageId, element)
    } else {
      messageRefs.current.delete(messageId)
    }
  }, [])

  // 检测 sticky 状态：只保留最后一个进入 sticky 状态的 user 消息
  useEffect(() => {
    const userMessages = messages.filter((m) => m.role === 'user')
    if (userMessages.length === 0) {
      setStickyMessageId(null)
      console.log('[AIPanel] Sticky Message ID: null (no user messages)')
      return
    }

    // 检测哪些消息在视口顶部
    const checkStickyMessages = () => {
      const candidateMessages: Array<{ id: string; index: number; bottom: number }> = []
      const scrollContainer = scrollContainerRef.current
      if (!scrollContainer) return

      // 获取滚动容器的位置
      const containerRect = scrollContainer.getBoundingClientRect()
      const containerTop = containerRect.top

      // 找到所有在视口上方或与视口顶部相交的 user message
      messageRefs.current.forEach((element, messageId) => {
        const message = messages.find((m) => m.id === messageId)
        if (message && message.role === 'user') {
          const rect = element.getBoundingClientRect()
          const messageIndex = messages.findIndex((m) => m.id === messageId)
          
          // 如果消息的顶部在滚动容器顶部或上方，则认为它可能是 sticky 候选
          // 这包括：
          // 1. 消息与视口顶部相交（rect.top <= containerTop && rect.bottom > containerTop）
          // 2. 消息完全在视口上方（rect.top <= containerTop && rect.bottom <= containerTop）
          // 但我们优先选择与视口顶部相交的消息
          if (rect.top <= containerTop) {
            candidateMessages.push({
              id: messageId,
              index: messageIndex,
              bottom: rect.bottom,
            })
          }
        }
      })

      if (candidateMessages.length > 0) {
        // 优先选择与视口顶部相交的消息（bottom > containerTop）
        const intersectingMessages = candidateMessages.filter(
          (m) => m.bottom > containerTop
        )

        let targetMessage: { id: string; index: number } | null = null

        if (intersectingMessages.length > 0) {
          // 如果有与视口顶部相交的消息，选择其中最后一个（按消息顺序）
          const sorted = intersectingMessages.sort((a, b) => a.index - b.index)
          targetMessage = sorted[sorted.length - 1]
        } else {
          // 如果没有与视口顶部相交的消息，选择最接近视口顶部的消息（bottom 最大的）
          // 这通常是在视口上方但最接近视口的消息
          const sorted = candidateMessages.sort((a, b) => {
            // 首先按 bottom 降序排序（最接近视口的在前）
            if (b.bottom !== a.bottom) {
              return b.bottom - a.bottom
            }
            // 如果 bottom 相同，按消息顺序排序（选择最后一个）
            return b.index - a.index
          })
          targetMessage = sorted[0]
        }

        if (targetMessage && targetMessage.id !== stickyMessageId) {
          setStickyMessageId(targetMessage.id)
          console.log('[AIPanel] Sticky Message ID updated to:', targetMessage.id)
        }
      } else if (stickyMessageId !== null) {
        setStickyMessageId(null)
        console.log('[AIPanel] Sticky Message ID updated to: null (no sticky messages)')
      }
    }

    // 使用 scroll 事件来检测
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', checkStickyMessages)
      // 初始检查
      setTimeout(checkStickyMessages, 0)

      return () => {
        scrollContainer.removeEventListener('scroll', checkStickyMessages)
      }
    }
  }, [messages, chatBarHeight, stickyMessageId, scrollContainerRef])

  return {
    stickyMessageId,
    setMessageRef,
  }
}

