import { Button } from 'react-bootstrap'
import { FaPaperPlane } from 'react-icons/fa'
import { connect } from 'react-redux'
import { storageActions, storageSelectors } from '../storageSlice'
import { RootState } from '../../../app/store'
import { Gh1CustomState } from '../../../storageWorker/githubStorage1/types'
import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { MdCheck } from 'react-icons/md'
import Loading from '../../../components/Loading'
import { GhOpenPayload } from '../../../storageWorker/githubStorage1/ghEngine'
import HandInModal from './HandInModal'
import { usePullsListQuery } from '../../../api/githubApi/endpoints/pulls'
import { useReposGetQuery } from '../../../api/githubApi/endpoints/repos'
import { sheetSelectors } from '../../sheet/slice/sheetSlice'

interface MappedProps {
  isOnline: boolean
  storageEngine?: string,
  customState: Gh1CustomState
}

interface OwnProps {
  addr: GhOpenPayload,
}

type HandInButtonProps = MappedProps & OwnProps

function HandInButton({ addr, isOnline, storageEngine, customState }: HandInButtonProps) {
  const [taskId, setTaskId] = useState(-1);
  const task = useAppSelector(storageSelectors.task(taskId))
  const taskState = task === 'unknown_task' ? 'unknown_task' : task.state;
  const taskResult = task === 'unknown_task' ? undefined : task.result;
  const settings = useAppSelector(sheetSelectors.sheetSettings);
  const { owner, repo, ref } = addr;
  const repoInfo = useReposGetQuery({ owner, repo });
  const pulls = usePullsListQuery({
    owner: repoInfo.data?.parent?.owner.login || '',
    repo: repoInfo.data?.parent?.name || '',
    state: 'all'
  }, {
    skip: !repoInfo.isSuccess || repoInfo.data?.parent === undefined
  })
  const dispatch = useAppDispatch()

  const [showModal, setShowModal] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (taskState === 'success') {
      // refetch pulls to update button state
      pulls.refetch()
    }
  }, [taskState, pulls])

  useEffect(() => {
    if (taskResult?.result === 'error' && showModal === false) {
      setShowModal(true)
    }
  }, [taskResult, showModal])

  if (storageEngine === undefined
    || storageEngine !== 'github1'
    || settings.github === undefined
    || settings.github.handinBranch.trim() === '') {
    return <></>
  }

  const existingPull = pulls.isSuccess ? pulls.data.filter(pr =>
    pr.base.label === `${repoInfo.data?.parent?.owner.login}:${settings.github?.handinBranch}`
    && pr.head.label === `${owner}:${ref}`
    && (
      (pr.state === 'closed' && pr.merged_at !== null) // PR graded
      || pr.state === 'open' // PR created
    )
  )[0] : undefined

  const handInState = existingPull === undefined
    ? 'not_turned_in'
    : existingPull.state === 'open'
      ? 'tuned_in'
      : existingPull.state === 'closed' && existingPull.merged_at !== null
        ? 'graded'
        : 'not_turned_in' // PR was closed but not merged

  const startTurnIn = async (title?: string, body?: string) => {
    // force any delayed updates before merging
    dispatch(storageActions.syncUnsyncedChanges())
    // merge first if possible
    if (customState.canMerge) {
      dispatch(storageActions.enqueueTask({
        type: 'merge',
        skipOnError: true
      }))
    }
    const taskId = dispatch(storageActions.enqueueTask({
      type: 'handIn',
      payload: { addr, handInBranch: settings.github?.handinBranch, title, body },
      skipOnError: true,
    }))
    setTaskId(taskId);
  }

  const variant = (() => {
    switch (taskState) {
      case 'error':
      case 'cancelled':
        return 'danger';
      case 'waiting':
        return 'warning';
      case 'success':
        return 'success';
      default:
        return handInState === 'graded' ? 'success' : 'info';
    }
  })()

  const disabled =
    isOnline === false

  const handleHandInClicked = () => {
    setClosed(false);
    setShowModal(true);
    setTaskId(-1);
  }

  const handleHide = () => {
    setClosed(true)
  }

  const handleCreatePR = (title: string, body: string) => {
    setShowModal(false);
    startTurnIn(title, body)
  }

  return (<>
    <HandInModal
      addr={addr}
      show={showModal && !closed}
      onHide={handleHide}
      onCreatePR={handleCreatePR}
      existingPullUrl={existingPull?.html_url}
      handInError={taskResult?.result === 'error' ? taskResult.customError : undefined}
    />
    <Button variant={variant} disabled={disabled} onClick={handleHandInClicked}>
      <FaPaperPlane />&nbsp;

      {handInState === 'not_turned_in'
        ? 'Hand In'
        : handInState === 'tuned_in'
          ? `Handed in as PR #${existingPull!.number}`
          : `Graded in PR #${existingPull!.number}`
      }
      {(taskState === 'waiting' || taskState === 'processing') && <>&nbsp;<Loading compact /></>}
      {taskState === 'success' && <>&nbsp;<MdCheck /></>}
    </Button>
  </>)
}

const mapStateToProps = (state: RootState, ownProps: OwnProps): HandInButtonProps => ({
  addr: ownProps.addr,
  isOnline: storageSelectors.isOnline(state),
  storageEngine: storageSelectors.storageEngine(state)?.type,
  customState: storageSelectors.storageEngineCustom(state) as Gh1CustomState
})

export default connect(mapStateToProps)(HandInButton)