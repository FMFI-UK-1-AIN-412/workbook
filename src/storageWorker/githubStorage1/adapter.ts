import { StorageEngine } from "../storageEngine";
import { AutosavePayload, Command, Task } from "../workerApi";
import { GithubEngine, HandInPayload } from "./ghEngine";
import { TMayFail } from "./mayfail";
import { Gh1CustomState } from "./types";

export interface GhOpenPayload {
  owner: string,
  repo: string,
  path: string,
  ref: string,
  openAs?: string,
}

type RequestResult = {
  result: 'success'
  data?: any,
  customState?: any
} | {
  result: 'error'
  errorMessage: string,
  customState: any,
  customError: any,
}

function adapter<S, E extends { customError: {message: string}, customState?: Gh1CustomState }>(result: TMayFail<S, E>): RequestResult  {
  if (result.isSuccess()) {
    return {
      result: 'success',
      ...result.value
    }
  } else {
    return {
      result: 'error',
      errorMessage: result.value.customError.message,
      customState: result.value.customState,
      customError: result.value.customError,
    }
  }
}

export function initGithubEngine(initPayload: any): StorageEngine {
  const gh = new GithubEngine(initPayload.custom.ghToken)
  const engine: StorageEngine = {
    runCommand: async (cmd: Command) => {
      switch (cmd.type) {
        case 'load': {
          return adapter(await gh.openCmd(cmd.payload as GhOpenPayload))
        }
        case 'init': {
          return { result: 'success' }
        }
        case 'deleteMergedSession': {
          return adapter(await gh.deleteMergedSessionCmd())
        }
        default:
          throw new Error("Unknown command in github engine: " + cmd.type)
      }
    },
    runTask: async (task: Task) => {
      switch (task.type) {
        case 'autosave': {
          return adapter(await gh.autosaveTask(task.payload as AutosavePayload))
        }
        case 'merge': {
          return adapter(await gh.mergeTask())
        }
        case 'handIn': {
          return adapter(await gh.handInTask(task.payload as HandInPayload))
        }
        default:
          throw new Error("Unknown task in github engine: " + task.type)
      }
    },
  }
  return engine;
}