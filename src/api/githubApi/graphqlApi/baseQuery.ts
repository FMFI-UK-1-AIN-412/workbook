
import { graphqlRequestBaseQuery } from '@rtk-query/graphql-request-base-query'
import { DocumentNode } from 'graphql';
import { BaseQueryFn, } from "@reduxjs/toolkit/query/react";
import { ClientError } from 'graphql-request';
import { ErrorResponse } from '@rtk-query/graphql-request-base-query/dist/GraphqlBaseQueryTypes';

import { RootState } from '../../../app/store';
import config from "../../../config.json";
import { authActions } from '../../../features/auth/authSlice';

const baseQuery = graphqlRequestBaseQuery({
    url: 'https://api.github.com/graphql',
    prepareHeaders: (headers, api) => {
      const accessToken = (api.getState() as RootState).auth.accessToken;
      if (accessToken) {
        headers.append('Authorization', `${config.token_name} ${accessToken}`);
      }
      return headers;
    },
  });

// TODO: possibly merge into one wrapper with githubBaseQuery 
const graphqlBaseQuery: BaseQueryFn<{
    document: string | DocumentNode;
    variables?: any;
}, unknown, ErrorResponse, Partial<Pick<ClientError, "request" | "response">>> 
= async (args, api, extraOptions) => {
  /* Detect when query returns http status 401 (Unauthorized) which means accessToken 
   * is invalid or expired.
   */
  let result = await baseQuery(args, api, extraOptions);
  if (result.error && result.error.message.includes("GraphQL Error (Code: 401)")) {
    try {
      let refreshRes = await api.dispatch<any, any>(authActions.requestRefreshTokens()).unwrap();
      if (refreshRes) {
        return await baseQuery(args, api, extraOptions);
      }
    } catch (e) {
      console.log("Failed to refresh:", e);
      api.dispatch(authActions.logout());
    }
  }
  return result;
};

export default graphqlBaseQuery;