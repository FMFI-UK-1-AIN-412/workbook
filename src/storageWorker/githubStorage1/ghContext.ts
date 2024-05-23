import { Octokit, RequestError } from "octokit"
import { MayFail, TMayFail, err, success } from "./mayfail"
import { Gh1ApiError, Gh1ApiErrorEx, Gh1AutosaveErr, Gh1CustomState, Gh1MergeErr, Gh1OpenErr, Gh1HandInErr } from "./types"
import { GhEngineState, GhOpenPayload, HandInPayload } from "./ghEngine"
import { getSessionBranchName, pathURIEncode } from "../githubStorage/utils"
import { Base64 } from "js-base64"

async function octoProm<T>(p: Promise<T>): Promise<TMayFail<T, Gh1ApiErrorEx>> {
  try {
    const a = await p
    return MayFail.Success<T, Gh1ApiErrorEx>(a)
  } catch (e: any) {
    if ('name' in e && 'message' in e) {
      if (e.name === 'HttpError') {
        const apiError = e as RequestError
        return MayFail.Error<T, Gh1ApiErrorEx>({
          reason: "api_call_failed",
          message: `HTTP error: ${apiError.request.method} ${apiError.request.url} failed (${apiError.message})`,
          apiError
        })
      }
      return MayFail.Error<T, Gh1ApiErrorEx>({
        reason: "api_call_failed",
        message: `Exception during API call: ${e.name}: ${e.message}`
      })
    }
    return MayFail.Error<T, Gh1ApiErrorEx>({
      reason: "api_call_failed",
      message: `API call ended with unknown error: ${e}`
    })
  }
}

export class GhContext {
  changeState: (newState: GhEngineState) => void
  customState: Gh1CustomState
  octokit: Octokit

  constructor(authToken: string, changeState: (newState: GhEngineState) => void) {
    this.octokit = new Octokit({
      auth: authToken,
      retry: {
        doNotRetry: [
          404, 405, 409, 422
        ],
      },
      request: { retries: 0, retryAfter: 1 },
      throttle: { enabled: false }
    });
    this.changeState = changeState
    this.customState = {
      canMerge: false,
      undeletedMergedSession: false,
      baseBranch: 'will be set'
    }
  }

  async handIn(args: HandInPayload & {  addr: GhOpenPayload }) {
    const { owner, repo, ref } = args.addr;
    const { handInBranch, title, body } = args;
    const operation = MayFail.do<Gh1HandInErr | Gh1ApiErrorEx>()
      .assignV('repoInfo', await octoProm(
        this.octokit.rest.repos.get({ owner, repo })
      ))
      .asyncAssignF('pullRequest', async scope => {
        const { parent } = scope.repoInfo.data
        if (parent === undefined) {
          return MayFail.Error({
            reason: 'no_parent',
            message: 'Workbook opened from repository that has no parent'
          })
        }
        return octoProm(
          this.octokit.rest.pulls.create({
            owner: parent.owner.login, repo,
            base: handInBranch,
            head: `${owner}:${ref}`,
            title, body
          })
        )
      })
      return operation
  }

  async open(addr: GhOpenPayload) {
    const { owner, repo, path } = addr;
    return MayFail.do<Gh1OpenErr | Gh1ApiErrorEx>()
      .assignV('branches', await octoProm(
        this.octokit.paginate(this.octokit.rest.repos.listBranches, {
          owner, repo, per_page: 100,
          headers: { 'If-None-Match': '' } // disable caching
        })
      ))
      .assignV('sheetBranch', await this.getSheetBranches2(addr))
      .asyncAssignF('undeletedMergedSession', async scope => {
        // check disabled, to decrease loading time
        // this condition is checked before every commit
        return MayFail.Success(false)
        /*
        const { sessionBranch } = scope.sheetBranch;
        if (sessionBranch === undefined) {
          return MayFail.Success(false)
        } else {
          //return this.isBranchMerged(addr, baseBranch.name, sessionBranch)
          return this.isBranchMerged2(addr, sessionBranch.headId)
        }
        */
      })
      .asyncAssignF('file', async scope => {
        const { baseBranch, sessionBranch } = scope.sheetBranch;
        const ref = sessionBranch === undefined ? baseBranch.name : sessionBranch.name
        return octoProm(this.octokit.rest.repos.getContent({
          owner, repo, path, ref,
          headers: { 'If-None-Match': '' } // disable caching
        }))
      })
      .retF(scope => {
        const { file } = scope;
        const undeletedMergedSession = false;
        const { baseBranch, sessionBranch } = scope.sheetBranch;
        if (!('content' in file.data)) {
          return err({
            reason: 'not_found',
            message: 'Workbook path refers to a directory.'
          })
        }
        try {
          const content = Base64.decode(file.data.content);
          return success({
            baseBranch, sessionBranch, content,
            sha: file.data.sha,
            undeletedMergedSession
          })
        } catch (e) {
          return err({
            reason: 'load_error',
            message: 'Base64 content decoding failed.'
          })
        }
      })
      .transformError<Gh1OpenErr>(err => ({ ...err, apiError: undefined }))
  }

  async getSheetBranches2(addr: GhOpenPayload) {
    // faster graphql version of getting sheet branches info,
    // eliminates transfer of possibly big list with pull requests
    const { owner, repo } = addr;
    const baseBranch = addr.ref
    const sessionBranch = getSessionBranchName(addr);

    type ResponseType = {
      repository: {
        baseBranch: { name: string, target: { oid: string } } | null,
        sessionBranch: { name: string, target: { oid: string } } | null,
      }
    }

    return MayFail.do<Gh1OpenErr | Gh1ApiErrorEx>()
      .assignV('branches', await octoProm(this.octokit.graphql(`
        query getSheetBranches($owner: String!, $repo: String!, $baseBranch: String!, $sessionBranch: String!) {
          repository(owner: $owner, name: $repo) {
            baseBranch: ref(qualifiedName: $baseBranch) {
              name
              target {
                ... on Commit {
                  oid
                }
              }
            }
            sessionBranch: ref(qualifiedName: $sessionBranch) {
              name
              target {
                ... on Commit {
                  oid
                }
              }
            }
          }
        }      
        `,
        {
          owner, repo, baseBranch, sessionBranch,
          headers: { 'If-None-Match': '' } // disable caching
        }
      )
      ))
      .retF(scope => {
        const { baseBranch, sessionBranch } = (scope.branches as ResponseType).repository
        if (baseBranch === null) {
          return MayFail.Error({
            reason: 'not_found',
            message: 'The requested work sheet was not found in the repository. Check the file name, path, and branch.'
          })
        }
        return MayFail.Success({
          baseBranch: {
            headId: baseBranch.target.oid,
            name: baseBranch.name
          },
          sessionBranch: sessionBranch !== null ? {
            name: sessionBranch.name,
            headId: sessionBranch.target.oid
          } : undefined
        })
      })
  }

  async createSessionBranch(args: { addr: GhOpenPayload, baseCommitId: string }) {
    const { addr, baseCommitId } = args;
    const { owner, repo } = addr;
    const sessionBranchName = `refs/heads/${getSessionBranchName(args.addr)}`;
    return MayFail.do<Gh1ApiErrorEx>()
      .assignV('create', await octoProm(
        this.octokit.rest.git.createRef({
          owner, repo,
          ref: sessionBranchName,
          sha: baseCommitId
        })
      ))
      .retF(scope => MayFail.Success({
        name: getSessionBranchName(addr),
        headId: scope.create.data.object.sha
      }))
      .transformError(err => {
        if (err.reason === 'api_call_failed') {
          const { apiError } = err
          if (apiError?.status === 422
            && (apiError?.response?.data as any).message === 'Reference already exists') {
            const newErr: Gh1ApiError | { reason: 'background_update', message: string } = {
              reason: 'background_update',
              message: ''
            }
            return newErr;
          }
        }
        return err;
      })
  }

  async isBranchMerged2(args: { addr: GhOpenPayload, sessionBranchName: string, commitId: string }) {
    // faster graphql version of getting sheet branches info,
    // eliminates transfer of possibly big list with pull requests
    const { addr, sessionBranchName, commitId } = args;
    const { owner, repo } = addr;

    type ReponseType = {
      repository: { 
        object: { 
          associatedPullRequests: { 
            nodes: Array<{ 
              state: string, 
              headRefOid: string,
              headRefName: string,
            }> 
          } 
        } 
      }
    }

    return MayFail.do()
      .assignV('pull', await octoProm(
        this.octokit.graphql(`
        query getPullRequestForCommit($owner: String!, $repo: String!, $commitId: GitObjectID!) {
          repository(owner: $owner, name: $repo) {
            object(oid: $commitId) {
              ... on Commit {
                associatedPullRequests(first: 1) {
                  nodes {
                    state,
                    headRefOid,
                    headRefName
                  }
                }
              }
            }
          }
        }
        `, {
          owner, repo, commitId,
          headers: { 'If-None-Match': '' } // disable caching
        })
      ))
      .retF(scope => {
        console.log(scope)
        const nodes = (scope.pull as ReponseType).repository.object.associatedPullRequests.nodes
        console.log('Nodes', nodes)
        if (nodes.find(p => p.state === 'MERGED' && p.headRefOid === commitId && p.headRefName === sessionBranchName) !== undefined) {
          return MayFail.Success(true)
        }
        return MayFail.Success(false)
      })
  }

  async isBranchMerged(args: { addr: GhOpenPayload, baseBranch: string, branch: { name: string, commitId: string } }) {
    const { addr, baseBranch, branch } = args;
    const { owner, repo } = addr;
    const { name, commitId } = branch;
    const t1 = performance.now()
    return MayFail.do<Gh1ApiErrorEx>()
      .assignV('pulls', await octoProm(
        this.octokit.paginate(
          this.octokit.rest.pulls.list, {
          owner, repo,
          state: 'closed',
          per_page: 100,
          headers: { 'If-None-Match': '' }
        })
      )).retF(scope => {
        const { pulls } = scope;
        for (let pull of pulls) {
          if (pull.state === 'closed'
            && pull.base.ref === baseBranch
            && pull.head.ref === name
            && pull.head.sha === commitId
          ) {
            console.log('IT TOOK', performance.now() - t1)
            return MayFail.Success(true)
          }
        }
        console.log('IT TOOK', performance.now() - t1)
        return MayFail.Success(false)
      })
  }

  async commit(args: { addr: GhOpenPayload, message: string, content: string, sessionBranchName: string, commitId: string, fileHash: string }) {
    const { addr, sessionBranchName, commitId, content, fileHash, message } = args;
    const { owner, repo, path } = addr;
    console.log('in commit')
    return MayFail.do<Gh1AutosaveErr | Gh1ApiErrorEx>()
      .assignV('mergedSession', await this.isBranchMerged2({ addr, sessionBranchName, commitId }))
      .retF(scope => {
        if (scope.mergedSession === true) {
          return MayFail.Error({
            reason: "merged_session",
            message: "Session branch was merged, but not deleted"
          })
        }
        return MayFail.Success({});
      })
      .asyncAssignF('apiResult', _ => octoProm(
        this.octokit.rest.repos.createOrUpdateFileContents({
          owner, repo,
          path: pathURIEncode(path),
          message, content,
          sha: fileHash,
          branch: sessionBranchName,
        })
      )).retF(scope => {
        return MayFail.Success({
          newFileHash: scope.apiResult.data.content!.sha!,
          newHeadId: scope.apiResult.data.commit.sha!,
        })
      })
      .transformError<Gh1AutosaveErr | Gh1ApiErrorEx>(err => {
        if (err.reason === 'api_call_failed') {
          const { apiError } = err;
          if (apiError?.status === 409) {
            return {
              reason: 'background_update',
              message: 'Workbook file was updated in the background',
            }
          }
        }
        return err;
      })
      .transformError<Gh1AutosaveErr>(err => ({ ...err, apiError: undefined }))
  }

  async deleteMergedSession(args: { addr: GhOpenPayload, sessionBranch: string }) {
    const { addr, sessionBranch } = args;
    const { owner, repo } = addr;
    return MayFail.do<Gh1ApiErrorEx>()
      .assignV('deleteResult', await octoProm(
        this.octokit.rest.git.deleteRef({
          owner, repo,
          ref: `heads/${pathURIEncode(sessionBranch)}`
        }))
      )
      .retV(MayFail.Success(true))
  }

  async mergeSession(args: { addr: GhOpenPayload, sourceBranch: { name: string }, targetBranch: string }) {
    const { addr, sourceBranch, targetBranch } = args;
    const { owner, repo, path } = addr;
    // parse filename from repo path
    const filename = path.replace(/^([^/]*\/)*([^/]+)\.workbook$/, '$2');
    let s = await MayFail.do<Gh1MergeErr | Gh1ApiErrorEx>()
      // list all puls
      .assignV('pulls', await octoProm(
        this.octokit.paginate(
          this.octokit.rest.pulls.list, {
          owner,
          repo,
          state: 'open',
          per_page: 100,
          headers: { 'If-None-Match': '' }
        })
      )) // find already created pull or create new 
      .asyncAssignF('createdPull', async scope => {
        const { pulls } = scope;
        const pr = pulls.filter(pull => pull.base.ref === targetBranch && pull.head.ref === sourceBranch.name);
        if (pr.length > 1) {
          // this should not happen, github wont allow creation of same PR twice
          return err({
            reason: 'multiple_pulls',
            message: 'The repository is in an inconsistent state. There are multiple pull requests open from the session branch to the base branch.',
          })
        } else if (pr.length === 1) {
          // opened pull request from source to target branch already created
          // lets use it
          return success({ pullNumber: pr[0].number, pullUrl: pr[0].html_url, created: true })
        } else {
          // no pull request from source to target branch
          // lets create one
          return (await octoProm(
            this.octokit.rest.pulls.create({
              owner, repo,
              title: `${filename}: Worksheet session`,
              head: `refs/heads/${sourceBranch.name}`,
              base: `refs/heads/${targetBranch}`,
            })
          )).retF(scope => success({
            pullNumber: scope.data.number,
            pullUrl: scope.data.html_url
          }))
        }
      }) // perform merge
      .asyncAssignF('mergeResult', async scope => {
        console.log('merging')
        let a = (await octoProm(
          this.octokit.rest.pulls.merge({
            owner, repo,
            pull_number: scope.createdPull.pullNumber,
            commit_title: `${filename}: Workbook session ${owner}/${repo}#${scope.createdPull.pullNumber}`,
            commit_message: `See https://github.com/${owner}/${repo}/pull/${scope.createdPull.pullNumber}`,
            merge_method: 'squash'
          })
        )).transformError<Gh1MergeErr>(err => {
          console.log('merge error', err)
          if (err.reason === 'api_call_failed') {
            const { apiError } = err
            if (apiError?.status === 405
              /*&& apiError.message === 'Pull Request is not mergeable'*/) {
              console.log('transforming error')
              return {
                reason: 'not_mergable',
                message: '',
                pullUrl: scope.createdPull.pullUrl
              }
            }
          }
          return err;
        })
        console.log('merging ended')
        return a
      }) // delete session branch
      .asyncAssignF('deleteResult', async scope => {
        await octoProm(
          this.octokit.rest.git.deleteRef({
            owner, repo,
            ref: `heads/${pathURIEncode(sourceBranch.name)}`
          })
        )
        // if everything before succeeded, and deleting of merged branch failed
        // it is not reported as error, because from this state we can recover
        // on any next commit or open
        return success(true)
      })
      .retF(scope => MayFail.Success(scope.mergeResult.data.sha))
      // strip apiError, because it cannot be transfered out of worker
      .transformError<Gh1MergeErr>(err => ({ ...err, apiError: undefined }))
    console.log('merging function ended')
    return s
  }
}