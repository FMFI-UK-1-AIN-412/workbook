import { Button } from "react-bootstrap";
import { IoMdGitMerge } from "react-icons/io";
import { MdCheck } from "react-icons/md";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import Loading from "../../../components/Loading";
import { storageActions, storageSelectors } from "../storageSlice";
import { useEffect } from "react";

export default function MergeButton() {
  const dispatch = useAppDispatch();
  const queueState = useAppSelector(storageSelectors.taskQueueState)
  const isOnline = useAppSelector(storageSelectors.isOnline)
  const engine = useAppSelector(storageSelectors.storageEngine);
  const mergeTask = useAppSelector(state => storageSelectors.monitorTask(state, 'merge'))
  const mergeState = mergeTask?.task.state

  useEffect(() => {
    // cancel merging if some saving task before failed
    // or client went offline, otherwise button will keep spinning
    if (mergeTask?.task.state === 'waiting') {
      if (queueState === 'error' || queueState === 'offline_paused') {
        dispatch(storageActions.cancelTask({ id: mergeTask.taskId }))
      }
    }
  }, [queueState, dispatch, mergeTask])

  if (!engine || !['github', 'github1'].find(e => e === engine?.type)) {
    return <></>
  }

  const variant = (() => {
    switch (mergeTask?.task.state) {
      case 'error':
      case 'cancelled':
        return 'danger';
      case 'waiting':
        return 'warning';
      case 'success':
        return 'success';
      default:
        return 'success';
    }
  })()

  const disabled =
    engine.custom?.canMerge !== true
    || isOnline === false
    || mergeState === 'waiting'
    || mergeState === 'processing'
    || queueState === 'error'
    || queueState === 'paused'

  const startMerge = () => {
    // force any delayed updates before merging
    dispatch(storageActions.syncUnsyncedChanges())
    dispatch(storageActions.enqueueTask({
      type: 'merge',
      skipOnError: true
    }))
    //setTaskId(taskId)
  }

  return (
    <Button variant={variant} title={mergeState === 'cancelled' ? 'Merging was cancelled' : ''} disabled={disabled} onClick={startMerge}>
      <IoMdGitMerge />&nbsp;Merge changes
      {(mergeState === 'waiting' || mergeState === 'processing') && <>&nbsp;<Loading compact /></>}
      {mergeState === 'success' && <>&nbsp;<MdCheck /></>}
    </Button>
  )
}