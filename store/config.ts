import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface IConfigState {
  config?: any;
}

export interface IConfigStateReducer {
  configReducer: IConfigState;
}

const slice = createSlice({
  name: 'config',
  initialState: <IConfigState>{
    config: undefined,
  },
  reducers: {
    setConfig: (state, action: PayloadAction<any | undefined>) => {
      state.config = action.payload;
    }
  }
});

export const configReducer = slice.reducer;
export const configStoreActions = slice.actions;