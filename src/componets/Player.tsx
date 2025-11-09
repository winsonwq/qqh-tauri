import { memo, useMemo } from 'react'
import Plyr from 'plyr-react'
import 'plyr-react/plyr.css'
import type { Options } from 'plyr'

interface PlayerProps {
  src: string
  type?: 'audio' | 'video'
  onError?: (error: unknown) => void
  options?: Partial<Options>
  className?: string
}

const Player = memo(({
  src,
  type = 'audio',
  onError,
  options,
  className,
}: PlayerProps) => {
  // 默认配置 - 使用 useMemo 稳定引用
  const defaultOptions: Options = useMemo(() => ({
    controls: [
      'play',
      'progress',
      'current-time',
      'mute',
      'settings',
    ],
    settings: ['speed'],
  }), [])

  // 合并用户配置和默认配置 - 使用 useMemo 稳定引用
  const mergedOptions = useMemo(() => ({
    ...defaultOptions,
    ...options,
    // 确保 controls 和 settings 正确合并
    controls: options?.controls || defaultOptions.controls,
    settings: options?.settings || defaultOptions.settings,
  }), [defaultOptions, options])

  // 稳定 source 对象引用
  const source = useMemo(() => ({
    type,
    sources: [
      {
        src,
      },
    ],
  }), [type, src])

  return (
    <div className={className}>
      <Plyr
        source={source}
        options={mergedOptions}
        onError={onError}
      />
    </div>
  )
})

Player.displayName = 'Player'

export default Player

