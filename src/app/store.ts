import { configureStore } from '@reduxjs/toolkit';
import sheetReducer from '../features/sheet/slice/sheetSlice';
import { githubApi } from '../api/githubApi/endpoints/repos';
import authReducer from '../features/auth/authSlice';
import { setupListeners } from '@reduxjs/toolkit/dist/query';
import { storageMiddleware } from './storageMiddleware';
import { storageSlice, storageSelectors } from '../features/sheetStorage/storageSlice';
import { githubGqlApi } from '../api/githubApi/graphqlApi/baseApi';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    sheet: sheetReducer,
    storage: storageSlice.reducer,
    [githubApi.reducerPath]: githubApi.reducer,
    [githubGqlApi.reducerPath]: githubGqlApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(githubApi.middleware, storageMiddleware),
});

// enable listener behavior for the store
setupListeners(store.dispatch)

store.dispatch({ type: window.navigator.onLine ? 'browser/online' : 'browser/offline' });
window.addEventListener('online', () => store.dispatch({ type: 'browser/online' }))
window.addEventListener('offline', () => store.dispatch({ type: 'browser/offline' }))
window.onbeforeunload = function (e) {
  const state = store.getState();
  const msg = 'There are unsaved changes, do you really want to leave?'

  if (storageSelectors.storageSynced(state) === false) {
    if (e) {
      e.returnValue = msg;
    }
    return msg;
  }
};

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
