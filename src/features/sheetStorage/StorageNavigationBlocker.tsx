import { useCallback, useEffect, useState } from "react";
import { useBlocker } from "react-router-dom";
import { useAppSelector, useAppDispatch } from "../../app/hooks";
import { storageActions, storageSelectors } from "./storageSlice";
import { Button, Modal, ProgressBar } from "react-bootstrap";
import DownloadWorkbook from "../sheet/utils/DownloadWorbook";

export function StorageNavigationBlocker() {
  const storageSynced = useAppSelector(storageSelectors.storageSynced);
  const queueState = useAppSelector(storageSelectors.taskQueueState);
  const dispatch = useAppDispatch();

  const shouldBlock = useCallback(({ currentLocation, nextLocation }) => {
    if (storageSynced === false &&
      currentLocation.pathname !== nextLocation.pathname) {
      dispatch(storageActions.syncUnsyncedChanges())
      return true;
    }
    return false;
  }, [storageSynced, dispatch])

  const blocker = useBlocker(shouldBlock)

  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (storageSynced) {
        blocker.proceed()
      }
    }
  }, [blocker, storageSynced, queueState])

  const handleContinue = () => {
    if (blocker.state === 'blocked') {
      blocker.proceed();
    }
  }
  console.log('blocker state', blocker.state)
  return (<>
    {blocker.state === "blocked" ? (
      <Modal
        show={true}
        onHide={() => blocker.reset()}
      >
        <Modal.Header closeButton>
          <Modal.Title>Pending Changes</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {queueState === 'processing'
            ? (<>
              <p>Please wait while all changes are saved</p>
              <ProgressBar animated now={100} />
            </>)
            : queueState === 'offline_paused'
              ? (
                <p>
                  Pending changes cannot be saved because you are offline.
                  Connect to the internet or you can save your workbook locally and import it later.
                </p>
              )
              : queueState === 'error'
                ? (<p>
                  Pending changes cannot be saved because of error.
                  You can save current workbook locally and import it later.
                </p>)
                : <></>}
        </Modal.Body>
        <Modal.Footer>
          {(queueState === 'error' || queueState === 'offline_paused') && <DownloadWorkbook />}
          <Button variant="danger" onDoubleClick={handleContinue}>Double click to continue</Button>
        </Modal.Footer>
      </Modal >
    ) : <></>
    }
  </>)
}