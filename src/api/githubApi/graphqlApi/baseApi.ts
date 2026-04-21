import { createApi } from '@reduxjs/toolkit/query/react'
import graphqlBaseQuery from './baseQuery'

interface ListExercisesReposResponse {
  viewer: {
    repositories: {
      nodes: Array<{
        name: string,
        defaultBranchRef: {
          name: string,
        },
        object: {
          oid: string,
          text: string,
          isTruncated: boolean,
        }
      }>,
      pageInfo: {
        hasNextPage: boolean,
        endCursor: string
      }
    }
  }
}

export const githubGqlApi = createApi({
  baseQuery: graphqlBaseQuery,
  endpoints: (builder) => ({
    listExercisesRepos: builder.query<
    ListExercisesReposResponse,
      { expression: string; cursor?: number }
    >({
      query: ({ expression, cursor }) => ({
        document: `
        query($expression: String, $cursor: String) {
          viewer {
            repositories(first: 100, after: $cursor, isFork: true, orderBy: {field:UPDATED_AT, direction:DESC}) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                name
                defaultBranchRef {
                  name
                }
                object(expression: $expression) {
                  ... on Blob {
                    oid
                    text
                    isTruncated
                  }
                }
              }
            }
          }
        }
        `,
        variables: {
          expression,
          cursor,
        },
      }),
    })
  }),
})
export const { useListExercisesReposQuery } = githubGqlApi

/*
const githubApiGraphql = createApi({
  reducerPath: 'githubApiGraphQL',
  baseQuery: graphqlRequestBaseQuery({
    url: 'https://api.github.com/graphql',
  }),
  endpoints: (builder) => ({
    listExercisesRepos: builder.query({
      query: ({ page, per_page }) => ({
        document: `
        query GetUserRepositories($username: String!) {
          user(login: $username) {
            repositories(first: 10) {
              nodes {
                name
                object(expression: "master:index.md") {
                  ... on Blob {
                    oid
                  }
                }
              }
            }
          }
        }
        `,
        variables: {
          page,
          per_page,
        },
      }),
    })
  })
})

export const { useListExercisesRepos } = githubApiGraphql;

const githubApi = createApi({
  reducerPath: "githubApi",
  baseQuery: fetchBaseQuery({ baseUrl: 'https://api.github.com/graphql' }),
  tagTypes: ['Files', 'Refs', 'Pulls'],
  endpoints: (build) => ({
    reposListForUserHeaders: build.query<{ link?: string }, ReposListForUserApiArg>({
      query: (queryArg) => ({
        url: `/users/${queryArg.username}/repos`,
        method: 'HEAD',
        params: {
          type: queryArg['type'],
          sort: queryArg.sort,
          direction: queryArg.direction,
          per_page: queryArg.perPage,
          page: queryArg.page,
        },
      }),
      transformResponse(apiResponse, meta) {
        return { link: meta?.response?.headers.get("link") || undefined }
      }
    })
  })
})

export const { useReposListForUserHeaders } = githubApi*/