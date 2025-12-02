import { memo, useState, useEffect, useRef, useCallback, ReactNode } from 'react'
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2'

interface ScrollContainerProps {
  children: ReactNode
  className?: string
  direction?: 'horizontal' | 'vertical'
}

const ScrollContainer = memo(({
  children,
  className = '',
  direction = 'horizontal',
}: ScrollContainerProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)

  const checkScrollPosition = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    if (direction === 'horizontal') {
      const { scrollLeft, scrollWidth, clientWidth } = container
      setShowLeftArrow(scrollLeft > 0)
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1) // -1 for rounding errors
    } else {
      const { scrollTop, scrollHeight, clientHeight } = container
      setShowLeftArrow(scrollTop > 0)
      setShowRightArrow(scrollTop < scrollHeight - clientHeight - 1)
    }
  }, [direction])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Initial check
    checkScrollPosition()

    // Check on scroll
    container.addEventListener('scroll', checkScrollPosition)
    
    // Check on resize
    const resizeObserver = new ResizeObserver(checkScrollPosition)
    resizeObserver.observe(container)

    return () => {
      container.removeEventListener('scroll', checkScrollPosition)
      resizeObserver.disconnect()
    }
  }, [checkScrollPosition])

  const handleScroll = useCallback((scrollDirection: 'left' | 'right' | 'up' | 'down') => {
    const container = containerRef.current
    if (!container) return

    const scrollAmount = 200
    if (scrollDirection === 'left') {
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' })
    } else if (scrollDirection === 'right') {
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    } else if (scrollDirection === 'up') {
      container.scrollBy({ top: -scrollAmount, behavior: 'smooth' })
    } else {
      container.scrollBy({ top: scrollAmount, behavior: 'smooth' })
    }
  }, [])

  const isHorizontal = direction === 'horizontal'

  return (
    <div className={`relative ${className}`}>
      {/* 滚动容器 - 隐藏滚动条 */}
      <div
        ref={containerRef}
        className={`overflow-auto ${
          isHorizontal ? 'overflow-x-auto overflow-y-hidden' : 'overflow-y-auto overflow-x-hidden'
        } [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}
      >
        <div className="p-2">
          {children}
        </div>
      </div>

      {/* 左侧渐变遮罩和箭头 */}
      {isHorizontal && showLeftArrow && (
        <div className="absolute left-0 top-0 bottom-0 w-12 pointer-events-none flex items-center">
          {/* 渐变遮罩 - 从左侧（有颜色）到右侧（透明） */}
          <div 
            className="absolute inset-0 bg-gradient-to-r from-base-100 via-base-100/80 to-transparent"
          />
          {/* 箭头图标 - 圆形按钮 */}
          <button
            className="relative z-10 w-7 h-7 min-w-7 rounded-full btn btn-ghost flex items-center justify-center pointer-events-auto cursor-pointer text-base-content p-0"
            onClick={() => handleScroll('left')}
            aria-label="向左滚动"
          >
            <HiChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 右侧渐变遮罩和箭头 */}
      {isHorizontal && showRightArrow && (
        <div className="absolute right-0 top-0 bottom-0 w-12 pointer-events-none flex items-center justify-end">
          {/* 渐变遮罩 - 从左侧（透明）到右侧（有颜色） */}
          <div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-base-100/80 to-base-100"
          />
          {/* 箭头图标 - 圆形按钮 */}
          <button
            className="relative z-10 w-7 h-7 min-w-7 rounded-full btn btn-ghost flex items-center justify-center pointer-events-auto cursor-pointer text-base-content p-0"
            onClick={() => handleScroll('right')}
            aria-label="向右滚动"
          >
            <HiChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 垂直方向的遮罩和箭头（如果需要） */}
      {!isHorizontal && (
        <>
          {showLeftArrow && (
            <div className="absolute left-0 top-0 right-0 h-12 pointer-events-none flex items-center justify-center">
              <div 
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to bottom, hsl(var(--b1)), hsla(var(--b1), 0))',
                }}
              />
              <button
                className="relative z-10 w-8 h-8 rounded-full bg-base-200/80 hover:bg-base-200 shadow-md flex items-center justify-center pointer-events-auto transition-colors text-base-content text-lg font-bold"
                onClick={() => handleScroll('up')}
                aria-label="向上滚动"
              >
                ‹
              </button>
            </div>
          )}
          {showRightArrow && (
            <div className="absolute left-0 bottom-0 right-0 h-12 pointer-events-none flex items-center justify-center">
              <div 
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to top, hsl(var(--b1, var(--fallback-b1, 0 0% 100%))), hsla(var(--b1, var(--fallback-b1, 0 0% 100%)), 0))',
                }}
              />
              <button
                className="relative z-10 w-8 h-8 rounded-full bg-base-200/80 hover:bg-base-200 shadow-md flex items-center justify-center pointer-events-auto transition-colors text-base-content text-lg font-bold"
                onClick={() => handleScroll('down')}
                aria-label="向下滚动"
              >
                ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
})

ScrollContainer.displayName = 'ScrollContainer'

export default ScrollContainer

