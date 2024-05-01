import { Button } from 'react-bootstrap'
import { FaPaperPlane } from 'react-icons/fa'
import { connect } from 'react-redux'
import { storageActions, storageSelectors } from '../storageSlice'
import { RootState } from '../../../app/store'
import { Gh1CustomState } from '../../../storageWorker/githubStorage1/types'
import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { MdCheck } from 'react-icons/md'
import Loading from '../../../components/Loading'
import { GhOpenPayload } from '../../../storageWorker/githubStorage1/ghEngine'

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
  const taskState = useAppSelector(storageSelectors.taskState(taskId))
  const dispatch = useAppDispatch()

  if (storageEngine === undefined || storageEngine !== 'github1') {
    return <></>
  }

  console.log('handin task state: ', taskState)

  const disabled =
    isOnline === false


  const startTurnIn = async () => {
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
      payload: {addr, handInBranch: customState.baseBranch},
      skipOnError: true,
    }))
    setTaskId(taskId);
  }

  return (
    <Button variant="info" disabled={disabled} onClick={startTurnIn}>
      <FaPaperPlane />&nbsp;Hand In
      {(taskState === 'waiting' || taskState === 'processing') && <>&nbsp;<Loading compact /></>}
      {taskState === 'success' && <>&nbsp;<MdCheck /></>}
    </Button>
  )
}

const mapStateToProps = (state: RootState, ownProps: OwnProps): HandInButtonProps => ({
  addr: ownProps.addr,
  isOnline: storageSelectors.isOnline(state),
  storageEngine: storageSelectors.storageEngine(state)?.type,
  customState: storageSelectors.storageEngineCustom(state) as Gh1CustomState
})

export default connect(mapStateToProps)(HandInButton)