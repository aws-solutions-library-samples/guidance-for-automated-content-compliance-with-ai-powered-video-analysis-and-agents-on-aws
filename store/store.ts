import {configureStore} from '@reduxjs/toolkit';
import { authReducer } from './auth';
import { logMessagesReducer } from './log-output';
import { configReducer } from './config';

const store = configureStore({
    reducer: {
        authReducer,
        logMessagesReducer,
        configReducer
    }
});

export default store;