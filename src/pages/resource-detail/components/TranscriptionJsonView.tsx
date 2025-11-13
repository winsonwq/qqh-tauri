import { useMemo, useRef, useEffect } from 'react'
import {
  TranscriptionResultJson,
  TranscriptionSegment,
} from '../../../models/TranscriptionResult'
import { formatSubtitleTime } from '../../../utils/format'

interface TranscriptionJsonViewProps {
  data: TranscriptionResultJson
  onSeek?: (time: number) => void
  currentTime?: number // 当前播放时间（秒）
}

/**
 * 将时间戳字符串转换为秒数
 * 格式: HH:MM:SS,mmm
 */
const parseTimeToSeconds = (timeStr: string): number => {
  const [timePart, msPart = '0'] = timeStr.split(',')
  const [hours = '0', minutes = '0', seconds = '0'] = timePart.split(':')
  return (
    parseInt(hours, 10) * 3600 +
    parseInt(minutes, 10) * 60 +
    parseInt(seconds, 10) +
    parseInt(msPart, 10) / 1000
  )
}

const TranscriptionJsonView = ({ data, onSeek, currentTime = 0 }: TranscriptionJsonViewProps) => {
  // 使用原始数组，不去重，以保持索引一致性
  const transcription = useMemo(() => {
    return data.transcription || []
  }, [data.transcription])

  // 找到当前播放时间对应的片段索引（使用原始数组）
  // 使用更精确的匹配逻辑：当时间正好等于 fromTime 时，只匹配当前片段
  const highlightedIndex = useMemo(() => {
    if (currentTime === undefined || currentTime === null || currentTime < 0) return -1
    
    for (let i = 0; i < transcription.length; i++) {
      const segment = transcription[i]
      const fromTime = parseTimeToSeconds(segment.timestamps.from)
      const toTime = parseTimeToSeconds(segment.timestamps.to)
      
      // 对于非最后一个片段：使用 [fromTime, nextFromTime) 的范围
      // 这样当时间正好等于 fromTime 时，只匹配当前片段，不会匹配前一个片段
      if (i < transcription.length - 1) {
        const nextSegment = transcription[i + 1]
        const nextFromTime = parseTimeToSeconds(nextSegment.timestamps.from)
        
        // 如果当前时间在 [fromTime, nextFromTime) 范围内，匹配当前片段
        if (currentTime >= fromTime && currentTime < nextFromTime) {
          return i
        }
      } else {
        // 对于最后一个片段：使用 [fromTime, toTime] 的范围
        if (currentTime >= fromTime && currentTime <= toTime) {
          return i
        }
      }
    }
    
    // 如果没有找到匹配的片段，返回最接近的片段
    if (transcription.length > 0) {
      const firstSegment = transcription[0]
      const firstFromTime = parseTimeToSeconds(firstSegment.timestamps.from)
      if (currentTime < firstFromTime) {
        return 0
      }
      
      const lastSegment = transcription[transcription.length - 1]
      const lastToTime = parseTimeToSeconds(lastSegment.timestamps.to)
      if (currentTime > lastToTime) {
        return transcription.length - 1
      }
    }
    
    return -1
  }, [transcription, currentTime])

  // 用于滚动到高亮项
  const highlightedRef = useRef<HTMLDivElement>(null)

  // 当高亮项变化时，滚动到该项
  useEffect(() => {
    if (highlightedIndex >= 0 && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [highlightedIndex])

  if (!transcription || transcription.length === 0) {
    return null
  }

  const handleTagClick = (segment: TranscriptionSegment) => {
    if (onSeek) {
      const timeInSeconds = parseTimeToSeconds(segment.timestamps.from)
      onSeek(timeInSeconds)
    }
  }

  return (
    <>
      {transcription.map(
        (segment: TranscriptionSegment, index: number) => {
          const isHighlighted = index === highlightedIndex
          return (
            <div
              key={index}
              ref={isHighlighted ? highlightedRef : null}
              className={`rounded-lg p-3 transition-colors ${
                isHighlighted
                  ? 'bg-primary/10' 
                  : 'bg-base-100 hover:bg-base-200'
              }`}
            >
              <div className="flex items-center justify-start gap-2">
                <button
                  onClick={() => handleTagClick(segment)}
                  className={`badge badge-sm ${
                    isHighlighted
                      ? 'badge-primary cursor-pointer'
                      : 'badge-soft cursor-pointer hover:badge-primary'
                  }`}
                  title="点击跳转到此位置"
                >
                  #{index + 1}
                </button>
                <div className="flex flex-col">
                  <div className="text-xs text-base-content/50">
                    {formatSubtitleTime(segment.timestamps.from)} → {formatSubtitleTime(segment.timestamps.to)}
                  </div>
                  <div className="text-sm text-base-content leading-relaxed">
                    {segment.text}
                  </div>
                </div>
              </div>
            </div>
          )
        },
      )}
    </>
  )
}

export default TranscriptionJsonView
