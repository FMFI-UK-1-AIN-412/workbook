import { BaseQueryFn, FetchArgs, fetchBaseQuery, FetchBaseQueryError, FetchBaseQueryMeta } from "@reduxjs/toolkit/query/react";
import { authActions, clearSavedAuthState, logout } from "../../features/auth/authSlice";
import { AppDispatch, RootState } from '../../app/store';
import config from "../../config.json";

const baseQuery = fetchBaseQuery({ 
  baseUrl: "https://api.github.com/",
  prepareHeaders: (headers, { getState }) => {
    
    const accessToken = (getState() as RootState).auth.accessToken;
    if (accessToken) {
      headers.append('Authorization', `${config.token_name} ${accessToken}`);
    }
    return headers;
  },
  cache: 'no-cache',

 });

 const githubBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown, FetchBaseQueryError,
  {},
  FetchBaseQueryMeta
> = async (args, api, extraOptions) => {
  /* Detect when query returns http status 401 (Unauthorized) which means accessToken 
   * is invalid or expired.
   */
  let result = await baseQuery(args, api, extraOptions);
  if (result.error && result.error.status === 401) {
    // clearSavedAuthState();
    // api.dispatch(authActions.setAuthState('tokenExpired'));

    try {
      let refreshRes = await api.dispatch<any, any>(authActions.requestRefreshTokens()).unwrap();
      if (refreshRes) {
        return await baseQuery(args, api, extraOptions);
      }
    } catch (e) {
      console.log("Failed to refresh:", e);
      clearSavedAuthState();
      api.dispatch(authActions.logout());
    }
  }
  return result;
};

export default githubBaseQuery;
