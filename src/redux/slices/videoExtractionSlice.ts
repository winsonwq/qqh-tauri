import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface VideoExtractionState {
  // 按 resourceId 存储提取状态
  extractions: Record<string, {
    isExtracting: boolean;
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
        state.extractions[resourceId] = { isExtracting: false };
      }
      state.extractions[resourceId].isExtracting = isExtracting;
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

export const { setExtracting, clearExtraction } = videoExtractionSlice.actions;
export default videoExtractionSlice.reducer;

