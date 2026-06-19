import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import { IUser } from "../types/user";

export interface IUserState {
  user?: IUser;
}

// key name for reducer object must match key name for reducer in the "store.ts" file
export interface IUserStateReducer {
  authReducer: IUserState
}

const slice = createSlice({
    name: 'auth',
    initialState: <IUserState>{
      user: undefined,
    },
    reducers: {
      setUser: (state, action: PayloadAction<IUser | undefined>) => {
        state.user = action.payload;
      }
    }
  })

export const authReducer = slice.reducer;
export const authStoreActions = slice.actions;
