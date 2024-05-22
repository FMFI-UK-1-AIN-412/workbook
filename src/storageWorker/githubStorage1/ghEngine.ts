import { AutosavePayload, LoadResult } from "../workerApi";
import { MayFail, TMayFail, success, err, ExtractErrorTypeV } from "./mayfail";
import { Base64 } from "js-base64";
import sha1 from "sha1";
import { Gh1ApiError, Gh1AutosaveErr, Gh1CustomState, Gh1MergeErr, Gh1OpenErr, Gh1ApiErrorEx, Gh1HandInErr } from "./types";
import { GhContext } from "./ghContext";

export interface GhOpenPayload {
  owner: string,
  repo: string,
  path: string,
  ref: string,
  openAs?: string,
}

export interface HandInPayload {
  handInBranch: string
  title?: string,
  body?: string,
}

type OpenResult = TMayFail<{
  data: LoadResult,
  customState: Gh1CustomState
}, {
  customError: Gh1OpenErr
  customState: Gh1CustomState
}>

type AutosaveResult = TMayFail<{
  customState: Gh1CustomState
}, {
  customError: Gh1AutosaveErr
  customState: Gh1CustomState
}>

type MergeResult = TMayFail<{
  customState: Gh1CustomState
}, {
  customError: Gh1MergeErr
  customState: Gh1CustomState
}>

type DeleteSessionResult = TMayFail<{
  customState: Gh1CustomState
}, {
  customError: Gh1ApiError
}>

type HandInResult = TMayFail<{
  customState: Gh1CustomState
}, {
  customError: Gh1HandInErr
}>

export abstract class GhEngineState {
  context: GhContext
  stateName: string
  constructor(context: GhContext, name: string) {
    this.context = context
    this.stateName = name
  }

  abstract open(addr: GhOpenPayload): Promise<OpenResult>;
  abstract autosave(payload: AutosavePayload): Promise<AutosaveResult>;
  abstract merge(): Promise<MergeResult>;
  abstract handIn(payload: HandInPayload): Promise<HandInResult>;
  abstract deleteMergedSession(): Promise<DeleteSessionResult>
}

class Initialized extends GhEngineState {
  constructor(context: GhContext) {
    super(context, 'Initialized')

    this.context.customState = {
      canMerge: false,
      undeletedMergedSession: false,
      baseBranch: '',
      sessionBranch: ''
    }
  }

  async open(addr: GhOpenPayload): Promise<OpenResult> {
    return MayFail.do()
      .assignV('data', await this.context.open(addr))
      .retF(scope => {
        const {
          sessionBranch, baseBranch,
          sha, content, undeletedMergedSession
        } = scope.data;

        // initialize custom state
        this.context.customState = {
          canMerge: sessionBranch !== undefined && undeletedMergedSession === false,
          undeletedMergedSession,
          baseBranch: baseBranch.name,
          sessionBranch: sessionBranch?.name
        }

        // change state
        this.context.changeState(
          undeletedMergedSession
            ? new UndeletedSession(this.context, { addr, baseBranch, sessionBranch: sessionBranch!.name, fileHash: sha })
            : sessionBranch !== undefined
              ? new SessionFull(this.context, addr, baseBranch, sessionBranch, sha)
              : new SessionLess(this.context, addr, baseBranch, sha)
        )

        let filename = addr.path.split('/').splice(-1, 1)[0]
        return MayFail.Success({
          customState: this.context.customState,
          data: {
            filename,
            json: content,
            sheetId: sha1(JSON.stringify({
              storageType: 'github', location: addr
            }))
          }
        })
      })
      .transformError<ExtractErrorTypeV<OpenResult>>(error => {
        return {
          customError: error,
          customState: this.context.customState
        }
      })
  }
  async autosave(payload: AutosavePayload): Promise<AutosaveResult> {
    throw new Error("Invalid action");
  }
  async merge(): Promise<MergeResult> {
    throw new Error("Invalid action");
  }
  async handIn(): Promise<HandInResult> {
    throw new Error("Invalid action");
  }
  async deleteMergedSession(): Promise<DeleteSessionResult> {
    throw new Error("Invalid action");
  }
}

class UndeletedSession extends GhEngineState {
  private stateInfo

  constructor(context: GhContext, stateInfo: { addr: GhOpenPayload, baseBranch: { name: string, headId: string }, sessionBranch: string, fileHash: string }) {
    super(context, 'UndeletedSession')
    this.stateInfo = stateInfo

    this.context.customState.undeletedMergedSession = true;
  }

  open(addr: GhOpenPayload): Promise<OpenResult> {
    const newState = new Initialized(this.context)
    this.context.changeState(newState)
    return newState.open(addr);
  }
  async autosave(payload: AutosavePayload): Promise<AutosaveResult> {
    return MayFail.Error({
      customError: {
        reason: "merged_session",
        message: "Session branch was merged and must be deleted",
      },
      customState: this.context.customState
    })
  }
  merge(): Promise<MergeResult> {
    throw new Error("Invalid action");
  }
  async handIn(): Promise<HandInResult> {
    throw new Error("Invalid action");
  }
  async deleteMergedSession(): Promise<DeleteSessionResult> {
    return (await this.context.deleteMergedSession({
      addr: this.stateInfo.addr,
      sessionBranch: this.stateInfo.sessionBranch
    }))
      .retF(_ => {
        this.context.customState.undeletedMergedSession = false;
        this.context.customState.canMerge = false;
        this.context.changeState(new SessionLess(this.context, this.stateInfo.addr, this.stateInfo.baseBranch, this.stateInfo.fileHash))
        return MayFail.Success({
          customState: this.context.customState
        })
      })
      .transformError<Gh1ApiError>(error => ({ ...error, apiError: undefined }))
      .transformError<ExtractErrorTypeV<DeleteSessionResult>>(error => ({
        customError: error
      }))
  }

}

class SessionLess extends GhEngineState {
  private addr: GhOpenPayload
  private baseBranch: { name: string, headId: string }
  private fileHash: string
  constructor(context: GhContext, addr: GhOpenPayload, baseBranch: { name: string, headId: string }, fileHash: string) {
    super(context, 'SessionLess');
    this.addr = addr;
    this.baseBranch = baseBranch;
    this.fileHash = fileHash
  }
  async open(addr: GhOpenPayload): Promise<OpenResult> {
    throw new Error("Invalid action");
  }
  async autosave(payload: AutosavePayload): Promise<AutosaveResult> {
    return await MayFail.do<Gh1AutosaveErr | Gh1ApiErrorEx>()
      .assignV('sessionBranch', await this.context.createSessionBranch({
        addr: this.addr,
        baseCommitId: this.baseBranch.headId
      }))
      .transformError<ExtractErrorTypeV<AutosaveResult>>(error => ({
        customError: { ...error, apiError: undefined },
        customState: this.context.customState
      }))
      .asyncAssignF('autosave', async scope => {
        this.context.customState.canMerge = true;
        const newState = new SessionFull(this.context, this.addr, this.baseBranch, scope.sessionBranch, this.fileHash)
        this.context.changeState(newState)
        return newState.autosave(payload)
      })
      .retF(scope => success(scope.autosave))
  }
  async merge(): Promise<MergeResult> {
    throw new Error("Invalid action");
  }
  async handIn(payload: HandInPayload): Promise<HandInResult> {
    return (await this.context.handIn({addr: this.addr, ...payload}))
      .retV(MayFail.Success({
        customState: this.context.customState
      }))
      .transformError<{ customError: Gh1HandInErr }>(error => ({
        customError: { ...error, apiError: undefined }
      }))
  }
  async deleteMergedSession(): Promise<DeleteSessionResult> {
    throw new Error("Invalid action");
  }
}

class SessionFull extends GhEngineState {
  private addr: GhOpenPayload
  private baseBranch: { name: string, headId: string }
  private sessionBranch: {
    name: string,
    headId: string,
  }
  private fileHash: string

  constructor(context: GhContext, addr: GhOpenPayload, baseBranch: { name: string, headId: string }, sessionBranch: { name: string, headId: string }, fileHash: string) {
    super(context, 'SessionFull');
    this.addr = addr
    this.baseBranch = baseBranch
    this.sessionBranch = sessionBranch
    this.fileHash = fileHash
  }
  async open(addr: GhOpenPayload): Promise<OpenResult> {
    throw new Error("Invalid action");
  }
  async autosave(payload: AutosavePayload): Promise<AutosaveResult> {
    return MayFail.do()
      .assignV('commit', await this.context.commit({
        addr: this.addr,
        message: payload.message,
        content: Base64.encode(payload.serialized),
        branch: this.sessionBranch.name,
        commitId: this.sessionBranch.headId,
        fileHash: this.fileHash
      })
      )
      .retF(scope => {
        const { newFileHash, newHeadId } = scope.commit
        this.fileHash = newFileHash
        this.sessionBranch.headId = newHeadId
        this.context.customState.canMerge = true
        return MayFail.Success({
          customState: this.context.customState
        })
      })
      .transformError<ExtractErrorTypeV<AutosaveResult>>(error => {

        if (error.reason === 'merged_session') {
          this.context.changeState(new UndeletedSession(this.context, {
            addr: this.addr,
            baseBranch: this.baseBranch,
            sessionBranch: this.sessionBranch.name,
            fileHash: this.fileHash
          }))
        }

        return {
          customError: error,
          customState: this.context.customState
        }
      })
  }
  async merge(): Promise<MergeResult> {
    return MayFail.do<Gh1MergeErr>()
      .assignV('mergeResult', await this.context.mergeSession({
        addr: this.addr,
        sourceBranch: this.sessionBranch,
        targetBranch: this.baseBranch.name
      }))
      .retF(scope => {
        console.log('Merge task successful')
        this.context.customState.canMerge = false
        this.context.changeState(new SessionLess(this.context, this.addr, { ...this.baseBranch, headId: scope.mergeResult }, this.fileHash))
        return MayFail.Success({
          customState: this.context.customState
        })
      })
      .transformError<ExtractErrorTypeV<MergeResult>>(error => {
        console.log('Merge task ended with error', error)
        return {
          customError: error,
          customState: this.context.customState
        }
      })
  }
  async handIn(payload: HandInPayload): Promise<HandInResult> {
    return (await this.context.handIn({addr: this.addr, ...payload}))
      .retV(MayFail.Success({
        customState: this.context.customState
      }))
      .transformError<{ customError: Gh1HandInErr }>(error => ({
        customError: { ...error, apiError: undefined }
      }))
  }
  async deleteMergedSession(): Promise<DeleteSessionResult> {
    throw new Error("Invalid action")
  }
}

export class GithubEngine {
  state: GhEngineState
  context: GhContext
  constructor(authToken: string) {
    this.context = new GhContext(authToken, newState => {
      this.state = newState;
    });
    this.state = new Initialized(this.context)
  }

  async openCmd(addr: GhOpenPayload) {
    return this.state.open(addr)
  }
  async deleteMergedSessionCmd() {
    return this.state.deleteMergedSession()
  }
  async handInTask(payload: HandInPayload) {
    return this.state.handIn(payload);
  }
  async autosaveTask(payload: AutosavePayload) {
    return this.state.autosave(payload)
  }
  async mergeTask() {
    return this.state.merge()
  }
}