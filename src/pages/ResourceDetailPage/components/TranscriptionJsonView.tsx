import {
  TranscriptionResultJson,
  TranscriptionSegment,
} from '../../../models/TranscriptionResult'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(customParseFormat)

interface TranscriptionJsonViewProps {
  data: TranscriptionResultJson
}

const TranscriptionJsonView = ({ data }: TranscriptionJsonViewProps) => {
  const formatTime = (timeStr: string) => {
    // 解析时间格式：HH:MM:SS,mmm
    const time = dayjs(timeStr, 'HH:mm:ss,SSS')
    
    // 如果小时为0，只显示分钟和秒
    if (time.hour() === 0) {
      return time.format('mm:ss')
    }
    
    // 如果小时不为0，显示完整格式
    return time.format('HH:mm:ss')
  }

  if (!data.transcription || data.transcription.length === 0) {
    return null
  }

  return (
    <>
      {data.transcription.map(
        (segment: TranscriptionSegment, index: number) => (
          <div
            key={index}
            className="rounded-lg p-3 bg-base-100 hover:bg-base-200 transition-colors"
          >
            <div className="flex items-center justify-start gap-2">
              <div className="badge badge-sm badge-soft">#{index + 1}</div>
              <div className="flex flex-col">
                <div className="text-xs text-base-content/50">
                  {formatTime(segment.timestamps.from)} → {formatTime(segment.timestamps.to)}
                </div>
                <div className="text-sm text-base-content leading-relaxed">
                  {segment.text}
                </div>
              </div>
            </div>
          </div>
        ),
      )}
    </>
  )
}

export default TranscriptionJsonView
