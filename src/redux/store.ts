import { configureStore } from '@reduxjs/toolkit';
import featureKeysReducer from './slices/featureKeysSlice';
import themeReducer from './slices/themeSlice';

export const store = configureStore({
  reducer: {
    featureKeys: featureKeysReducer,
    theme: themeReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

