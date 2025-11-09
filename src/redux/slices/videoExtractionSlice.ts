import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface VideoExtractionState {
  // 按 resourceId 存储提取状态和进度
  extractions: Record<string, {
    isExtracting: boolean;
    progress: number; // 0-100
  }>;
}

const initialState: VideoExtractionState = {
  extractions: {},
};

const videoExtractionSlice = createSlice({
  name: 'videoExtraction',
  initialState,
  reducers: {
    // 设置提取状态
    setExtracting: (state, action: PayloadAction<{ resourceId: string; isExtracting: boolean }>) => {
      const { resourceId, isExtracting } = action.payload;
      if (!state.extractions[resourceId]) {
        state.extractions[resourceId] = { isExtracting: false, progress: 0 };
      }
      state.extractions[resourceId].isExtracting = isExtracting;
    },
    // 设置提取进度
    setProgress: (state, action: PayloadAction<{ resourceId: string; progress: number }>) => {
      const { resourceId, progress } = action.payload;
      if (!state.extractions[resourceId]) {
        state.extractions[resourceId] = { isExtracting: true, progress: 0 };
      }
      state.extractions[resourceId].progress = Math.min(100, Math.max(0, progress));
    },
    // 清除提取状态
    clearExtraction: (state, action: PayloadAction<string>) => {
      const resourceId = action.payload;
      if (state.extractions[resourceId]) {
        delete state.extractions[resourceId];
      }
    },
  },
});

export const { setExtracting, setProgress, clearExtraction } = videoExtractionSlice.actions;
export default videoExtractionSlice.reducer;

