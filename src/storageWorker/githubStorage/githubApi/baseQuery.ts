import { BaseQueryFn, FetchArgs, fetchBaseQuery, FetchBaseQueryError, FetchBaseQueryMeta } from "@reduxjs/toolkit/query/react";
import { RootState } from "../store";
import config from "../../../config.json";

const baseQuery = fetchBaseQuery({ 
  baseUrl: "https://api.github.com/",
  prepareHeaders: (headers, { getState }) => {
    
    const accessToken = (getState() as RootState).sheetStorage.ghToken;
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
  let result = await baseQuery(args, api, extraOptions)
  /*
  if (result.error && result.error.status === 401) {
    clearSavedAuthState();
    api.dispatch(authActions.setAuthState('tokenExpired'));
  }
  */
  return result;
};

export default githubBaseQuery;
