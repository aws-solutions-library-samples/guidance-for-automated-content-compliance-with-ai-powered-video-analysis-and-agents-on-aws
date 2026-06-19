import { ILogMessage } from '../types/log-output';
import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export interface ILogMessagesState {
  messages: ILogMessage[];
  isLoading: boolean;
  error: string | null;
  sessionId: string | null;
}

// key name for reducer object must match key name for reducer in the "store.ts" file
export interface ILogMessagesStateReducer {
  logMessagesReducer: ILogMessagesState
}

const slice = createSlice({
  name: 'log-messages',
  initialState: <ILogMessagesState>{
    messages: [] as ILogMessage[],
    sessionId: null,
  },
  reducers: {
    setSessionId: (state, action: PayloadAction<string>) => {
      state.sessionId = action.payload;
    },
    setMessages: (state, action: PayloadAction<ILogMessage[]>) => {
      state.messages = action.payload;
    },
  }
})

export const logMessagesReducer = slice.reducer;
export const logMessagesStoreActions = slice.actions;