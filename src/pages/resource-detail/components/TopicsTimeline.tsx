import { memo, useMemo, useState, useCallback } from 'react'
import { Topic, TopicTimeRange } from '../../../models/TranscriptionResource'
import { PlayerRef } from '../../../components/Player'
import ScrollContainer from '../../../components/ScrollContainer'

interface TopicsTimelineProps {
  topics?: Topic[]
  duration?: number // 视频/音频总时长（秒）
  playerRef?: React.RefObject<PlayerRef | null>
  onSeek?: (time: number) => void
}

const TopicsTimeline = memo(({
  topics,
  duration = 0,
  playerRef,
  onSeek,
}: TopicsTimelineProps) => {
  const [hoveredTimeRange, setHoveredTimeRange] = useState<{ topicIndex: number; rangeIndex: number } | null>(null)
  const [hoveredTopicIndex, setHoveredTopicIndex] = useState<number | null>(null)

  // 处理点击时间范围，跳转到开始时间
  const handleTimeRangeClick = useCallback((topic: Topic, timeRange: TopicTimeRange) => {
    const seekTime = timeRange.start
    if (playerRef?.current) {
      playerRef.current.seek(seekTime)
    }
    if (onSeek) {
      onSeek(seekTime)
    }
  }, [playerRef, onSeek])

  // 处理点击 topic，跳转到第一个时间范围的开始时间
  const handleTopicClick = useCallback((topic: Topic) => {
    if (topic.time_ranges.length > 0) {
      const firstRange = topic.time_ranges[0]
      handleTimeRangeClick(topic, firstRange)
    }
  }, [handleTimeRangeClick])

  // 格式化时间显示
  const formatTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }, [])

  // 从 topics 中计算时间范围（最小开始时间和最大结束时间）
  const timeRangeBounds = useMemo(() => {
    if (duration > 0) {
      return { minStart: 0, maxEnd: duration }
    }
    if (!topics || topics.length === 0) return { minStart: 0, maxEnd: 0 }
    let minStart = Infinity
    let maxEnd = 0
    topics.forEach(topic => {
      topic.time_ranges.forEach(range => {
        if (range.start < minStart) {
          minStart = range.start
        }
        if (range.end > maxEnd) {
          maxEnd = range.end
        }
      })
    })
    return { minStart: minStart === Infinity ? 0 : minStart, maxEnd }
  }, [duration, topics])

  const calculatedDuration = timeRangeBounds.maxEnd - timeRangeBounds.minStart

  // 计算时间范围的宽度和位置
  const calculateRangeStyle = useCallback((timeRange: TopicTimeRange) => {
    if (calculatedDuration === 0) return { left: '0%', width: '0%' }
    const leftPercent = ((timeRange.start - timeRangeBounds.minStart) / calculatedDuration) * 100
    const widthPercent = ((timeRange.end - timeRange.start) / calculatedDuration) * 100
    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
    }
  }, [calculatedDuration, timeRangeBounds])

  if (!topics || topics.length === 0) {
    return null
  }

  // 计算所有色块的总数，用于 z-index 计算
  const totalRanges = useMemo(() => {
    return topics.reduce((sum, topic) => sum + topic.time_ranges.length, 0)
  }, [topics])

  // 计算每个色块在所有色块中的位置（按 topicIndex 和 rangeIndex 顺序）
  const getRangePosition = useCallback((topicIndex: number, rangeIndex: number) => {
    let position = 0
    for (let i = 0; i < topicIndex; i++) {
      position += topics[i].time_ranges.length
    }
    position += rangeIndex
    return position
  }, [topics])

  return (
    <div className="w-full">
      {/* 时间轴 */}
      <div className="relative mb-2">
        <div className="relative h-12 bg-base-200 rounded-lg overflow-hidden">
          {/* 时间刻度背景 */}
          <div className="absolute inset-0 flex items-center">
            <div className="w-full h-0.5 bg-base-300"></div>
          </div>
          
          {/* Topics 时间范围 */}
          {topics.map((topic, topicIndex) => (
            topic.time_ranges.map((timeRange, rangeIndex) => {
              const style = calculateRangeStyle(timeRange)
              const isHovered = hoveredTimeRange?.topicIndex === topicIndex && 
                                hoveredTimeRange?.rangeIndex === rangeIndex
              const isTopicHovered = hoveredTopicIndex === topicIndex
              
              // 默认情况下：相同颜色的色块仅第一块显示时间
              // 悬停色块时：显示时间
              // hover topic 时：只高亮，不显示时间
              const isFirstRange = rangeIndex === 0
              const shouldShowText = isFirstRange || isHovered
              
              // 计算 z-index：
              // 1. hover 时最大（1000）
              // 2. 默认情况下，前面的色块 z-index 大于后续的色块（前面的位置值更小，所以 z-index 更大）
              const position = getRangePosition(topicIndex, rangeIndex)
              const zIndex = isHovered ? 1000 : (totalRanges - position)
              
              return (
                <div
                  key={`${topicIndex}-${rangeIndex}`}
                  className="absolute rounded-xl cursor-pointer transition-all px-1.5 py-0.5"
                  style={{
                    ...style,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    height: '28px',
                    backgroundColor: topic.color,
                    opacity: isHovered || isTopicHovered ? Math.min(topic.opacity + 0.2, 1.0) : topic.opacity,
                    zIndex,
                  }}
                  onClick={() => handleTimeRangeClick(topic, timeRange)}
                  onMouseEnter={() => setHoveredTimeRange({ topicIndex, rangeIndex })}
                  onMouseLeave={() => setHoveredTimeRange(null)}
                >
                  {/* 只显示时间 - 左对齐 */}
                  {shouldShowText && (
                    <div className="flex items-center h-full">
                      <span className="text-[10px] font-medium text-white drop-shadow-sm whitespace-nowrap">
                        {formatTime(timeRange.start)}
                      </span>
                    </div>
                  )}
                </div>
              )
            })
          ))}
        </div>
      </div>

      {/* Topics 列表 - 横向滚动 */}
      <ScrollContainer direction="horizontal">
        <div className="flex gap-2 min-w-max">
          {topics.map((topic, topicIndex) => {
            const isHovered = hoveredTopicIndex === topicIndex
            const firstTime = topic.time_ranges.length > 0 ? formatTime(topic.time_ranges[0].start) : ''
            
            return (
              <div
                key={topicIndex}
                className="px-2.5 py-1 rounded-xl cursor-pointer transition-all text-[10px] font-medium flex-shrink-0 flex items-center gap-1.5"
                style={{
                  backgroundColor: isHovered ? topic.color : `${topic.color}20`,
                  color: isHovered ? 'white' : topic.color,
                  border: `1px solid ${topic.color}`,
                }}
                onMouseEnter={() => setHoveredTopicIndex(topicIndex)}
                onMouseLeave={() => setHoveredTopicIndex(null)}
                onClick={() => handleTopicClick(topic)}
              >
                {firstTime && (
                  <span className="opacity-70">{firstTime}</span>
                )}
                <span>{topic.name}</span>
              </div>
            )
          })}
        </div>
      </ScrollContainer>
    </div>
  )
})

TopicsTimeline.displayName = 'TopicsTimeline'

export default TopicsTimeline

