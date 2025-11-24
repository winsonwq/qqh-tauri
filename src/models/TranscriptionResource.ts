// 转写资源类型
export enum ResourceType {
  AUDIO = 'audio',
  VIDEO = 'video',
}

// 转写资源模型
export interface TranscriptionResource {
  id: string; // 唯一标识符
  name: string; // 资源名称
  file_path: string; // 文件地址
  resource_type: ResourceType; // 资源类型：音频或视频
  extracted_audio_path?: string; // 提取的音频路径（仅视频资源有）
  latest_completed_task_id?: string; // 最新一条转写成功的任务 ID
  created_at: string; // 创建时间
  updated_at: string; // 更新时间
}

