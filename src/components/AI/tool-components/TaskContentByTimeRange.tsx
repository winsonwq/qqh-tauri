import React, { useState } from 'react'
import { ComponentProps } from '../ComponentRegistry'

interface TaskContentByTimeRangeProps {
  props: ComponentProps
}

const TaskContentByTimeRange: React.FC<TaskContentByTimeRangeProps> = ({
  props,
}) => {
  const { task_id, content, segments } = props

  const [showModal, setShowModal] = useState(false)
  const maxLines = 5 // 默认显示前5行

  // 解析内容文本，按行分割
  const contentLines = content
    ? content.split('\n').filter((line: string) => line.trim())
    : []
  const displayLines = contentLines.slice(0, maxLines)
  const hasMore = contentLines.length > maxLines

  return (
    <>
      <div className="task-content-by-time-range-component bg-base-100 rounded-lg p-4 border border-base-300">
        {/* 内容显示 */}
        {content && (
          <>
            <div className="text-xs text-base-content/80 whitespace-pre-wrap break-words">
              {displayLines.join('\n')}
            </div>
            {hasMore && (
              <button
                onClick={() => setShowModal(true)}
                className="btn btn-sm btn-primary btn-outline mt-3"
              >
                显示全部 ({contentLines.length} 行)
              </button>
            )}
          </>
        )}

        {/* 如果没有内容但有片段数据，显示片段信息 */}
        {!content &&
          segments &&
          Array.isArray(segments) &&
          segments.length > 0 && (
            <>
              <div className="text-xs text-base-content/80 space-y-2">
                {segments.slice(0, maxLines).map((seg: any, index: number) => {
                  const timeFrom =
                    seg.timestamps?.from || seg.offsets?.from || ''
                  const timeTo = seg.timestamps?.to || seg.offsets?.to || ''
                  const text = seg.text || ''
                  const offsetFrom = seg.offsets?.from
                  const offsetTo = seg.offsets?.to

                  return (
                    <div
                      key={index}
                      className="border-b border-base-300 pb-2 last:border-b-0"
                    >
                      <div className="text-base-content/60 mb-1">
                        {timeFrom && timeTo ? `[${timeFrom} - ${timeTo}]` : ''}
                        {offsetFrom !== undefined && offsetTo !== undefined && (
                          <span className="ml-2 text-xs">
                            ({offsetFrom.toFixed(2)}s - {offsetTo.toFixed(2)}s)
                          </span>
                        )}
                      </div>
                      <div className="text-base-content">{text}</div>
                    </div>
                  )
                })}
              </div>
              {segments.length > maxLines && (
                <button
                  onClick={() => setShowModal(true)}
                  className="btn btn-sm btn-primary btn-outline mt-3"
                >
                  显示全部 ({segments.length} 个片段)
                </button>
              )}
            </>
          )}

        {/* 隐藏的任务ID，供 AI 识别 */}
        {task_id && <div className="hidden" data-task-id={task_id} />}
      </div>

      {/* Modal 显示全部内容 */}
      {showModal && (
        <>
          <input
            type="checkbox"
            id="task-content-modal"
            className="modal-toggle"
            checked={showModal}
            onChange={(e) => setShowModal(e.target.checked)}
          />
          <div className="modal" role="dialog">
            <div className="modal-box max-w-4xl max-h-[80vh] flex flex-col">
              <h3 className="font-bold text-lg mb-4">完整转写内容</h3>
              <div className="flex-1 overflow-auto">
                {content && (
                  <div className="text-sm text-base-content whitespace-pre-wrap break-words">
                    {content}
                  </div>
                )}
                {!content &&
                  segments &&
                  Array.isArray(segments) &&
                  segments.length > 0 && (
                    <div className="text-sm text-base-content space-y-3">
                      {segments.map((seg: any, index: number) => {
                        const timeFrom =
                          seg.timestamps?.from || seg.offsets?.from || ''
                        const timeTo =
                          seg.timestamps?.to || seg.offsets?.to || ''
                        const text = seg.text || ''
                        const offsetFrom = seg.offsets?.from
                        const offsetTo = seg.offsets?.to

                        return (
                          <div
                            key={index}
                            className="border-b border-base-300 pb-3 last:border-b-0"
                          >
                            <div className="text-base-content/60 mb-2">
                              {timeFrom && timeTo
                                ? `[${timeFrom} - ${timeTo}]`
                                : ''}
                              {offsetFrom !== undefined &&
                                offsetTo !== undefined && (
                                  <span className="ml-2 text-xs">
                                    ({offsetFrom.toFixed(2)}s -{' '}
                                    {offsetTo.toFixed(2)}s)
                                  </span>
                                )}
                            </div>
                            <div className="text-base-content">{text}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
              </div>
              <div className="modal-action">
                <button className="btn" onClick={() => setShowModal(false)}>
                  关闭
                </button>
              </div>
            </div>
            <label
              className="modal-backdrop"
              htmlFor="task-content-modal"
              onClick={() => setShowModal(false)}
            >
              关闭
            </label>
          </div>
        </>
      )}
    </>
  )
}

export default TaskContentByTimeRange
