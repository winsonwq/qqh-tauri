import React, { useRef, useEffect, useState, useCallback, ReactNode, forwardRef } from 'react'
import { HiArrowDown } from 'react-icons/hi2'

interface AutoScrollContainerProps {
  children: ReactNode
  shouldAutoScroll?: boolean // 外部控制是否应该自动滚动（比如 AI 正在输出时）
  className?: string
}

const AutoScrollContainer = forwardRef<HTMLDivElement, AutoScrollContainerProps>(({
  children,
  shouldAutoScroll = false,
  className = '',
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const lastScrollTopRef = useRef<number>(0)
  const isUserScrollingRef = useRef<boolean>(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isProgrammaticScrollRef = useRef<boolean>(false)
  const userInteractionRef = useRef<boolean>(false) // 标记是否有用户交互（鼠标/触摸）

  // 检查是否接近底部（允许 50px 的误差）
  const isNearBottom = useCallback(() => {
    const container = containerRef.current
    if (!container) return true

    const { scrollTop, scrollHeight, clientHeight } = container
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    return distanceFromBottom < 50
  }, [])

  // 滚动到底部
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = containerRef.current
    if (!container) return

    isProgrammaticScrollRef.current = true
    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    })
    
    // 标记程序滚动完成
    setTimeout(() => {
      isProgrammaticScrollRef.current = false
    }, behavior === 'smooth' ? 500 : 100)
  }, [])

  // 处理滚动事件
  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    // 如果是程序自动滚动，不处理
    if (isProgrammaticScrollRef.current) {
      lastScrollTopRef.current = container.scrollTop
      return
    }

    const currentScrollTop = container.scrollTop
    const nearBottom = isNearBottom()

    // 如果检测到用户交互（鼠标/触摸），且不是程序滚动，则禁用自动滚动
    if (userInteractionRef.current && !isProgrammaticScrollRef.current) {
      // 用户手动滚动，立即禁用自动滚动
      if (isAutoScrollEnabled) {
        setIsAutoScrollEnabled(false)
      }
    }

    // 更新显示按钮的状态
    setShowScrollButton(!nearBottom)

    lastScrollTopRef.current = currentScrollTop
  }, [isAutoScrollEnabled, isNearBottom])

  // 处理点击滚动按钮
  const handleScrollButtonClick = useCallback(() => {
    scrollToBottom('smooth')
    setIsAutoScrollEnabled(true)
    setShowScrollButton(false)
  }, [scrollToBottom])

  // 将内部 ref 和外部 ref 合并
  useEffect(() => {
    if (typeof ref === 'function') {
      ref(containerRef.current)
    } else if (ref) {
      ref.current = containerRef.current
    }
  }, [ref])

  // 当 shouldAutoScroll 为 true 时，自动滚动到底部（仅在自动滚动已启用时）
  useEffect(() => {
    if (shouldAutoScroll && isAutoScrollEnabled) {
      // 只有在自动滚动已启用时才自动滚动
      requestAnimationFrame(() => {
        scrollToBottom('smooth')
      })
    }
  }, [shouldAutoScroll, isAutoScrollEnabled, scrollToBottom, children])

  // 监听滚动事件和用户交互事件
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // 标记用户交互开始（鼠标按下或触摸开始）
    const handleMouseDown = () => {
      userInteractionRef.current = true
    }

    const handleTouchStart = () => {
      userInteractionRef.current = true
    }

    // 标记用户交互结束（鼠标释放或触摸结束）
    const handleMouseUp = () => {
      // 延迟重置，以便滚动事件可以检测到
      setTimeout(() => {
        userInteractionRef.current = false
      }, 100)
    }

    const handleTouchEnd = () => {
      // 延迟重置，以便滚动事件可以检测到
      setTimeout(() => {
        userInteractionRef.current = false
      }, 100)
    }

    // 监听滚动事件
    container.addEventListener('scroll', handleScroll)
    
    // 监听用户交互事件
    container.addEventListener('mousedown', handleMouseDown)
    container.addEventListener('touchstart', handleTouchStart)
    container.addEventListener('mouseup', handleMouseUp)
    container.addEventListener('touchend', handleTouchEnd)
    
    // 也监听 wheel 事件（鼠标滚轮）
    const handleWheel = () => {
      userInteractionRef.current = true
      setTimeout(() => {
        userInteractionRef.current = false
      }, 100)
    }
    container.addEventListener('wheel', handleWheel)

    return () => {
      container.removeEventListener('scroll', handleScroll)
      container.removeEventListener('mousedown', handleMouseDown)
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('mouseup', handleMouseUp)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('wheel', handleWheel)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [handleScroll])

  // 初始化时检查是否在底部
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const checkInitialPosition = () => {
      const nearBottom = isNearBottom()
      setShowScrollButton(!nearBottom)
      if (nearBottom) {
        setIsAutoScrollEnabled(true)
      }
    }

    // 延迟检查，确保内容已渲染
    const timeoutId = setTimeout(checkInitialPosition, 100)
    return () => clearTimeout(timeoutId)
  }, [isNearBottom])

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="h-full overflow-y-auto">
        {children}
      </div>
      {showScrollButton && (
        <button
          onClick={handleScrollButtonClick}
          className="absolute bottom-4 right-4 z-10 btn btn-circle btn-sm shadow-lg bg-base-200 hover:bg-base-300 border border-base-300"
          aria-label="滚动到底部"
          title="滚动到底部"
        >
          <HiArrowDown className="h-5 w-5" />
        </button>
      )}
    </div>
  )
})

AutoScrollContainer.displayName = 'AutoScrollContainer'

export default AutoScrollContainer

