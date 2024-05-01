import { RequestError } from "octokit"

export type Gh1Err = {
  reason: 'background_update' | 'load_error' | 'not_found' | 'multiple_pulls' | 'not_mergable' | 'merged_session',
  message: string,
} 

export interface Gh1ApiError {
  reason: 'api_call_failed',
  message: string,
  apiError: undefined
}

export interface Gh1ApiErrorEx {
  reason: 'api_call_failed',
  message: string,
  apiError?: RequestError, 
}

export type Gh1OpenErr =  {
  reason: 'not_found' | 'load_error'
  message: string,
} | Gh1ApiError

export type Gh1AutosaveErr = {
  reason: 'background_update' | 'merged_session'
  message: string,
} | Gh1ApiError

export type Gh1MergeErr = {
  reason: 'api_call_failed' | 'background_update' | 'multiple_pulls'
  message: string,
} | {
  reason: 'not_mergable'
  message: string,
  pullUrl: string
}

export type Gh1HandInErr = {
  reason: 'no_parent',
  message: string,
} | Gh1ApiError

export interface Gh1CustomState {
  canMerge: boolean,
  undeletedMergedSession: boolean,
  baseBranch: string,
  sessionBranch?: string,
  savingFailed?: Gh1AutosaveErr,
  mergingFailed?: Gh1MergeErr,
}