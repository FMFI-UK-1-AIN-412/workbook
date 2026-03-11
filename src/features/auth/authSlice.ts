import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { githubApi } from "../../api/githubApi/endpoints/users";
import { isUser } from "./authSlice.guard";
import { AppDispatch, RootState } from "../../app/store";
import config from '../../config.json';


/** @see {isUser} ts-auto-guard:type-guard */
export interface User {
  login: string,
  avatarUrl: string,
}

export interface AuthState {
  authState: 'authenticated' | 'unauthenticated' | 'authPending' | 'tokenExpired',
  user?: User,
  accessToken?: string,
  tokenState: 'noToken' | 'tokenLoaded' | 'tokenTested',
  error?: string
}

const initialState: AuthState = {
  authState: getSavedAccessToken() ? 'authenticated' : 'unauthenticated',
  user: getSavedUser(),
  accessToken: getSavedAccessToken(),
  tokenState: getSavedAccessToken() ? 'tokenLoaded' : 'noToken',
}

export const authSlice = createSlice({
  name: 'authSlice',
  initialState,
  reducers: {
    setAuthState: (state, action: PayloadAction<'authenticated' | 'unauthenticated' | 'tokenExpired'>) => {
      state.authState = action.payload;
    },
    setAccessToken: (state, action: PayloadAction<string | undefined>) => {
      state.accessToken = action.payload;
    },
    // logout: (state) => {
    //   state.accessToken = undefined;
    //   state.authState = "unauthenticated";
    // }
  },
  extraReducers: (builder) => {
    builder.addCase(requestAccessToken.pending, (state) => {
      state.authState = 'authPending';
    });
    builder.addCase(requestAccessToken.fulfilled, (state, action) => {
      // this state will trigger usersGetAuthenticatedQuery in App component
      state.tokenState = 'tokenLoaded';
      state.accessToken = action.payload;
    });
    builder.addCase(requestAccessToken.rejected, (state, action) => {
      state.authState = 'unauthenticated';
      state.error = action.error.message;
    });
    builder.addCase(requestRefreshTokens.pending, (state) => {
      state.authState = 'authPending';
    });
    builder.addCase(requestRefreshTokens.fulfilled, (state, action) => {
      state.authState = 'authenticated';
      state.tokenState = 'tokenTested';
      state.accessToken = action.payload;
    });
    builder.addCase(requestRefreshTokens.rejected, (state, action) => {
      state.authState = 'unauthenticated';
      state.tokenState = 'noToken';
      state.error = action.error.message;
    });
    builder.addCase(requestLogout.pending, (state) => {
      state.authState = 'authPending';
    });
    builder.addCase(requestLogout.fulfilled, (state, action) => {
      state.accessToken = undefined;
      state.authState = "unauthenticated";
    });
    builder.addCase(requestLogout.rejected, (state, action) => {
      state.accessToken = undefined;
      state.authState = "unauthenticated";
      state.error = action.error.message;
    });
    builder.addMatcher(githubApi.endpoints.usersGetAuthenticated.matchFulfilled,
      (state, { payload }) => {
        state.user = { login: payload.login, avatarUrl: payload.avatar_url }
        state.authState = 'authenticated';
        state.tokenState = 'tokenTested';
      });
  }
});

export const requestAccessToken = createAsyncThunk
  <any, string, { state: RootState }>('auth/requestAccessToken', async (code) => {
    const { baseUrl, authPath } = config.backend;
    const response = await fetch(`${baseUrl+authPath}?code=${encodeURIComponent(code)}`, { method: 'POST', credentials: "include" });
    const json = await response.json();
    if ('accessToken' in json) {
      return json.accessToken;
    }
    if ('error' in json) {
      throw Error(json.error);
    }
    throw Error('Invalid response from authentication backend');
  });

let refreshPromise: any = null;
export const requestRefreshTokens = createAsyncThunk
  <any, void, { state: RootState }>('auth/requestRefreshTokens', async () => {
    if (refreshPromise !== null) return await refreshPromise;

    try {
      const { baseUrl, refreshPath } = config.backend;
      refreshPromise = fetch(`${baseUrl+refreshPath}`, { method: 'POST', credentials: "include" });
      const response = await refreshPromise;
      const json = await response.json();

      if ('accessToken' in json) {
        refreshPromise = null;
        return json.accessToken;
      }
      if ('error' in json) {
        throw Error(json.error);
      }
    }
    catch (e) {
      refreshPromise = null;
      throw e;
    }
    finally {
      refreshPromise = null;
    }

    throw Error('Invalid response from authentication backend');
  });

export const requestLogout = createAsyncThunk
  <any, void, { state: RootState }>('auth/logout', async () => {
    const { baseUrl, logoutPath } = config.backend;
    const response = await fetch(`${baseUrl+logoutPath}`, { method: 'POST', credentials: "include" });
    const json = await response.json();
    if ('error' in json) {
      throw Error(json.error);
    }
    return true;
  });

function getSavedAccessToken(): string | undefined {
  return localStorage.getItem('accessToken') || undefined;
}

export function saveAuthState(user: User, accessToken: string) {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('accessToken', accessToken);
}

export function clearSavedAuthState() {
  localStorage.removeItem('user');
  localStorage.removeItem('accessToken');
}

function getSavedUser(): User | undefined {
  const u = localStorage.getItem('user');
  if (u) {
    let user;
    try {
      user = JSON.parse(u);
    } catch (e) { }
    if (user) {
      if (isUser(user)) {
        return user as User;
      }
    }
  }
}

export const logout = () => {
  return async (dispatch: AppDispatch) => {
    clearSavedAuthState();
    dispatch(authActions.logout());
  }
}

export const authActions = { requestAccessToken, requestRefreshTokens, logout: requestLogout, ...authSlice.actions };
export const authSelectors = {
  authState: (state: RootState) => state.auth.authState,
  accessToken: (state: RootState) => state.auth.accessToken,
  user: (state: RootState) => state.auth.user,
  tokenState: (state: RootState) => state.auth.tokenState,
  error: (state: RootState) => state.auth.error,
}

export default authSlice.reducer;