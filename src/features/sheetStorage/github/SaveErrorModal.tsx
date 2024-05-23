import { useEffect, useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { BiDownload, BiRefresh, BiTrash } from "react-icons/bi";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import { runCommand, storageActions, storageSelectors } from "../storageSlice";
import Loading from "../../../components/Loading";
import ErrBox from "../../../components/ErrBox";
import { Gh1AutosaveErr, Gh1CustomState } from "../../../storageWorker/githubStorage1/types";
import { downloadSheet } from "../../sheet/slice/sheetSlice";

export default function SaveErrorModal() {
  const engineInfo = useAppSelector(storageSelectors.storageEngine)
  const saveTask = useAppSelector(state => storageSelectors.lastProcessedTask(state, 'autosave'))
  const saveError = saveTask?.result?.result === 'error' ? saveTask.result.customError as Gh1AutosaveErr : undefined
  const [closed, setClosed] = useState(false);
  const [deleteRefState, setDeleteRefState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [deleteRefError, setDeleteRefError] = useState<string | undefined>(undefined);

  const dispatch = useAppDispatch();

  const displayError =
    engineInfo?.custom?.undeletedMergedSession === true
    || (saveError !== undefined && saveError.reason !== "merged_session")

  useEffect(() => {
    if (displayError) {
      setClosed(false);
    }
  }, [displayError, saveError])

  if (engineInfo?.type !== 'github1' || !displayError) {
    return <></>
  }

  const customState = engineInfo.custom as Gh1CustomState

  const deleteOldSession = async () => {
    setDeleteRefState('loading');
    const cmd = await dispatch(runCommand({ type: 'deleteMergedSession', payload: undefined }))
    if (cmd.result === 'success') {
      setDeleteRefState('success');
      setDeleteRefError(undefined);
      dispatch(storageActions.resume())
    } else {
      setDeleteRefState('error');
      setDeleteRefError(cmd.errorMessage);
    }
  }

  const type = customState.undeletedMergedSession ? 'merged_session'
    : saveError?.reason


  const unknownError = (error: { reason: string, message: string }) => (
    <>
      <Modal.Body>
        <p>Pri ukladaní zmien nastala <strong>neočakávaná chyba</strong>: ${error.message}</p>
        <p>
          Vykonané zmeny sa nepodarilo uložiť.&nbsp;
          Hárok zo zmenami urobenými v tomto okne si môžete stiahnuť.&nbsp;
          Môžete skúsiť zopakovať uloženie zmien do repozitára.
        </p>
        <p className="text-danger">Ak <strong>obnovíte</strong> stránku alebo <strong>zavriete</strong> toto okno, neuložené zmeny vykonané v tomto okne budú <strong>stratené</strong>.</p>
        <p>Čo chcete urobiť?</p>
      </Modal.Body>
      <Modal.Footer>
        <div className="mx-auto">
          <Button className="mx-2" variant="success" onClick={() => dispatch(downloadSheet())}><BiDownload />Stiahnuť hárok</Button>
          <Button className="mx-2" variant="success" onClick={() => dispatch(storageActions.resume())}><BiRefresh /> Skúsiť znova uložiť</Button>
        </div>
      </Modal.Footer>
    </>
  )
  const mergedSessionError = () => (
    <>
      <Modal.Body>
        <p>
          Aktuálna vetva sedenia {customState.sessionBranch} bola zlúčená do pôvodnej vetvy. Pred uložením vykonaných zmien je potrebné starú vetvu sedenia zmazať.
        </p>
        <p className="text-danger">Pokým nezmažete starú vetvu sedenia, automatické ukladanie bude <strong>pozastavené</strong>.</p>
        <p>Zmeny vykonané v starej vetve sedenia sú uložené vo vetve <strong>{customState.baseBranch}</strong>.</p>
        <p>Čo chcete urobiť?</p>

        {deleteRefError && (
          <ErrBox><>Operácia zlyhala: {deleteRefError}</></ErrBox>
        )}

      </Modal.Body>
      <Modal.Footer>
        <div className="mx-auto">
          <Button className="mx-2" variant="success" onClick={() => dispatch(downloadSheet())}><BiDownload />Stiahnuť hárok</Button>
          <Button className="mx-2" variant="warning" onClick={deleteOldSession}>
            <BiTrash />
            Zmazať starú vetvu
            {deleteRefState === 'loading' && <Loading compact />}
          </Button>
        </div>
      </Modal.Footer>
    </>
  )
  const backgroundUpdateError = () => (
    <>
      <Modal.Body>
        <p>
          Zdá sa že súbor hárku bol aktualizovaný na pozadí.
          Zmeny ktoré ste vykonali boli ale spravené na neaktuálnom hárku.
          Hárok zo zmenami urobenými v tomto okne si môžete stiahnuť.
        </p>
        <p className="text-danger">Ak <strong>obnovíte</strong> stránku alebo <strong>zavriete</strong> toto okno, neuložené zmeny vykonané v tomto okne budú <strong>stratené</strong>.</p>
        <p>Čo chcete urobiť?</p>
      </Modal.Body>
      <Modal.Footer>
        <div className="mx-auto">
          <Button className="mx-2" variant="success" onClick={() => dispatch(downloadSheet())}><BiDownload />Stiahnuť hárok</Button>
          <Button className="mx-2" variant="danger" onClick={() => window.location.href = window.location.href}><BiRefresh /> Obnoviť stránku</Button>
        </div>
      </Modal.Footer>
    </>
  )

  return (
    <Modal
      size="lg"
      aria-labelledby="contained-modal-title-vcenter"
      show={displayError && !closed}
      onHide={() => setClosed(true)}
    /*centered*/
    >
      <Modal.Header closeButton>
        <Modal.Title id="contained-modal-title-vcenter">
          Zmeny hárku sa <strong>nepodarilo</strong> uložiť
        </Modal.Title>
      </Modal.Header>

      {type === 'background_update' && backgroundUpdateError()}
      {type === 'merged_session' && mergedSessionError()}
      {type === 'api_call_failed' && saveError !== undefined && unknownError(saveError)}
    </Modal>
  )

}