import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { invoke } from '@tauri-apps/api/core';
import { MCPServerInfo } from '../../models';

export type LoadingState = 'idle' | 'loading' | 'refreshing';

export interface MCPState {
  servers: MCPServerInfo[];
  loadingState: LoadingState;
  error: string | null;
  lastUpdated: number | null;
}

const initialState: MCPState = {
  servers: [],
  loadingState: 'idle',
  error: null,
  lastUpdated: null,
};

// 异步加载 MCP 配置
export const loadMCPConfigs = createAsyncThunk(
  'mcp/loadConfigs',
  async (_, { rejectWithValue }) => {
    try {
      const serversList = await invoke<MCPServerInfo[]>('get_mcp_configs');
      return serversList;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载 MCP 配置失败';
      return rejectWithValue(errorMessage);
    }
  }
);

// 刷新 MCP 配置
export const refreshMCPConfigs = createAsyncThunk(
  'mcp/refreshConfigs',
  async (_, { rejectWithValue }) => {
    try {
      const serversList = await invoke<MCPServerInfo[]>('get_mcp_configs');
      return serversList;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '刷新 MCP 配置失败';
      return rejectWithValue(errorMessage);
    }
  }
);

const mcpSlice = createSlice({
  name: 'mcp',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setServers: (state, action: PayloadAction<MCPServerInfo[]>) => {
      state.servers = action.payload;
      state.lastUpdated = Date.now();
    },
  },
  extraReducers: (builder) => {
    builder
      // loadMCPConfigs
      .addCase(loadMCPConfigs.pending, (state) => {
        state.loadingState = 'loading';
        state.error = null;
      })
      .addCase(loadMCPConfigs.fulfilled, (state, action) => {
        state.loadingState = 'idle';
        state.servers = action.payload;
        state.lastUpdated = Date.now();
        state.error = null;
      })
      .addCase(loadMCPConfigs.rejected, (state, action) => {
        state.loadingState = 'idle';
        state.error = action.payload as string;
      })
      // refreshMCPConfigs
      .addCase(refreshMCPConfigs.pending, (state) => {
        state.loadingState = 'refreshing';
        state.error = null;
      })
      .addCase(refreshMCPConfigs.fulfilled, (state, action) => {
        state.loadingState = 'idle';
        state.servers = action.payload;
        state.lastUpdated = Date.now();
        state.error = null;
      })
      .addCase(refreshMCPConfigs.rejected, (state, action) => {
        state.loadingState = 'idle';
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setServers } = mcpSlice.actions;
export default mcpSlice.reducer;

