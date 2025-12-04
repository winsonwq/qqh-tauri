import { memo, useMemo, useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import { convertToEmbedUrl } from '../utils/urlUtils'

export interface IframePlayerRef {
  seek: (time: number) => void
  getCurrentTime: () => number
  onTimeUpdate: (callback: (time: number) => void) => () => void
}

interface IframePlayerProps {
  src: string
  className?: string
  onError?: (error: unknown) => void
}

const IframePlayer = memo(
  forwardRef<IframePlayerRef, IframePlayerProps>(
    ({ src, className, onError }, ref) => {
      // 转换为嵌入 URL（初始状态，不包含时间参数，不自动播放）
      const initialEmbedUrl = useMemo(() => {
        return convertToEmbedUrl(src, undefined, false)
      }, [src])
      
      // 使用 state 来存储当前的 embedUrl（可以包含时间参数）
      const [embedUrl, setEmbedUrl] = useState<string | null>(initialEmbedUrl)
      // iframe 加载状态
      const [isLoading, setIsLoading] = useState<boolean>(true)
      
      // 当 src 改变时，重置 embedUrl 并显示 loading
      useEffect(() => {
        const newEmbedUrl = convertToEmbedUrl(src, undefined, false)
        setEmbedUrl(newEmbedUrl)
        setIsLoading(true)
      }, [src])

      // 暴露播放器控制方法
      useImperativeHandle(ref, () => ({
        seek: (time: number) => {
          // URL 资源：通过更新 iframe src 来 seek（添加时间参数和自动播放）
          // 传入 autoplay=true 使 seek 后自动播放
          // 注意：不传入 mute，让视频尝试有声音自动播放
          // 如果浏览器阻止，用户需要手动点击播放
          const newEmbedUrl = convertToEmbedUrl(src, time, true, false)
          if (newEmbedUrl) {
            setIsLoading(true)
            setEmbedUrl(newEmbedUrl)
          }
        },
        getCurrentTime: () => {
          // iframe 嵌入的视频无法直接获取时间，返回 0
          return 0
        },
        onTimeUpdate: () => {
          // iframe 嵌入的视频无法监听时间更新，返回空清理函数
          return () => {}
        },
      }), [src])

      if (embedUrl) {
        // 有有效的嵌入 URL，使用 iframe
        // 使用 key 属性确保当 embedUrl 改变时 iframe 会重新加载
        return (
          <div className={className}>
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}> {/* 16:9 比例 */}
              {/* Loading 遮罩层 */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-base-200/80 z-10">
                  <div className="text-center">
                    <span className="loading loading-spinner loading-lg"></span>
                    <p className="mt-4 text-base-content/70">加载中...</p>
                  </div>
                </div>
              )}
              <iframe
                key={embedUrl}
                src={embedUrl}
                className="absolute top-0 left-0 w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="视频播放器"
                referrerPolicy="no-referrer-when-downgrade"
                onLoad={() => {
                  // iframe 加载成功
                  console.log('视频 iframe 加载成功')
                  setIsLoading(false)
                }}
                onError={(e) => {
                  // iframe 加载失败
                  console.error('视频 iframe 加载失败:', e)
                  setIsLoading(false)
                  if (onError) {
                    onError(e)
                  }
                }}
              />
            </div>
          </div>
        )
      } else {
        // 无法转换为嵌入 URL，显示提示信息
        return (
          <div className={className}>
            <div className="flex items-center justify-center h-64 bg-base-200 rounded-lg">
              <div className="text-center">
                <p className="text-base-content/70 mb-2">无法嵌入此视频链接</p>
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  在新窗口中打开
                </a>
              </div>
            </div>
          </div>
        )
      }
    },
  ),
)

IframePlayer.displayName = 'IframePlayer'

export default IframePlayer

