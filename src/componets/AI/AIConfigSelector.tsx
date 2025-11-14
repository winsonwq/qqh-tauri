import { useState, useEffect, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { AIConfig } from '../../models'
import Select, { SelectOption } from '../Select'

interface AIConfigSelectorProps {
  selectedConfigId?: string
  onConfigChange?: (configId: string) => void
}

const AIConfigSelector = ({
  selectedConfigId: externalSelectedConfigId,
  onConfigChange,
}: AIConfigSelectorProps) => {
  const [configs, setConfigs] = useState<AIConfig[]>([])
  const [internalSelectedConfigId, setInternalSelectedConfigId] =
    useState<string>('')
  const [loadingConfigs, setLoadingConfigs] = useState(false)

  // 使用外部传入的 selectedConfigId，如果没有则使用内部状态
  const selectedConfigId =
    externalSelectedConfigId !== undefined
      ? externalSelectedConfigId
      : internalSelectedConfigId

  // 加载 AI 配置列表（仅在组件挂载时）
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        setLoadingConfigs(true)
        const configsList = await invoke<AIConfig[]>('get_ai_configs')
        setConfigs(configsList)
        // 如果有配置且没有选中，默认选择第一个
        if (configsList.length > 0) {
          const newSelectedId = (() => {
            // 如果外部传入了 selectedConfigId，优先使用
            if (externalSelectedConfigId) {
              const exists = configsList.some(
                (c) => c.id === externalSelectedConfigId,
              )
              return exists ? externalSelectedConfigId : configsList[0].id
            }
            // 否则检查内部状态
            const currentConfigExists = configsList.some(
              (c) => c.id === internalSelectedConfigId,
            )
            return currentConfigExists && internalSelectedConfigId
              ? internalSelectedConfigId
              : configsList[0].id
          })()

          if (externalSelectedConfigId === undefined) {
            setInternalSelectedConfigId(newSelectedId)
          }
          if (onConfigChange) {
            onConfigChange(newSelectedId)
          }
        }
      } catch (err) {
        console.error('加载 AI 配置失败:', err)
      } finally {
        setLoadingConfigs(false)
      }
    }
    loadConfigs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 将 AIConfig[] 转换为 SelectOption[]
  const selectOptions = useMemo<SelectOption[]>(() => {
    return configs.map((config) => ({
      value: config.id,
      label: `${config.name} (${config.model})`,
    }))
  }, [configs])

  const handleConfigSelect = (configId: string) => {
    if (externalSelectedConfigId === undefined) {
      setInternalSelectedConfigId(configId)
    }
    if (onConfigChange) {
      onConfigChange(configId)
    }
  }

  if (configs.length === 0) {
    return null
  }

  return (
    <Select
      value={selectedConfigId}
      options={selectOptions}
      onChange={handleConfigSelect}
      placeholder={loadingConfigs ? '加载中...' : '选择 AI 配置'}
      disabled={loadingConfigs}
      size="xs"
      className="max-w-[120px]"
    />
  )
}

export default AIConfigSelector
