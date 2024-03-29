import { useEffect, useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { BiDownload, BiRefresh, BiTrash } from "react-icons/bi";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import { githubApi as gitDbApi } from '../../../api/githubApi/endpoints/git'
import { parseFilepath } from "../../../pages/RepoPage";
import { storageActions, storageSelectors } from "../sheetStorage";
import { ghClearSessionBranch, GhSaveError, ghStorageSelectors } from "./githubStorage";
import Loading from "../../../components/Loading";
import { githubApiErrorMessage } from "../../../api/githubApi/errorMessage";
import ErrBox from "../../../components/ErrBox";

export default function SaveErrorModal() {
  const queue = useAppSelector(storageSelectors.queue);
  const ghState = useAppSelector(ghStorageSelectors.ghState);

  const [deleteRefState, setDeleteRefState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [deleteRefError, setDeleteRefError] = useState<string | undefined>(undefined);

  const dispatch = useAppDispatch();

  //const [deleteRef, deleteRefResult] = useGitDeleteRefMutation()

  let fileName: string | undefined = undefined;
  if (ghState !== undefined) {
    fileName = parseFilepath(ghState.location.path).filename;
  }

  const download = (json: string) => {
    const url = window.URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.setAttribute('download', fileName || 'workbook-sheet.json');
    link.href = url;
    link.click();
    link.remove();
  }

  const json: string | undefined = (() => {
    if (queue.items.length > 0) {
      return queue.items[queue.items.length - 1].content;
    } else {
      return undefined;
    }
  })();

  useEffect(() => {
    if (ghState?.saveError !== undefined) {
      document.body.scrollTop = 0; // For Safari
      document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
    }
  }, [ghState?.saveError])

  if (ghState === undefined) {
    return <></>
  }

  const deleteOldSession = async () => {
    setDeleteRefState('loading');
    const { owner, repo } = ghState.location;
    const ref = ghState.sessionBranch!.name;
    const r = await dispatch(gitDbApi.endpoints.gitDeleteRef.initiate({ owner, repo, ref: `heads/${ref}` }));
    console.log('delete ref response: ', r);
    if ('data' in r) {
      dispatch(ghClearSessionBranch());
      dispatch(storageActions.resume());
    } else {
      setDeleteRefState('error');
      setDeleteRefError(githubApiErrorMessage(r.error));
    }
    setDeleteRefState('success');
    setDeleteRefError(undefined);
  }

  const type = ghState.saveError?.type;
  const unknownError = (saveError: GhSaveError) => (
    <>
      <Modal.Body>
        <p>Pri ukladaní zmien nastala <strong>neočakávaná chyba</strong>: ${saveError.message}.</p>
        <p>
          Vykonané zmeny sa nepodarilo uložiť.&nbsp;
          {json !== undefined && 'Hárok zo zmenami urobenými v tomto okne si môžete stiahnuť.&nbsp;'}
          Môžete skúsiť zopakovať uloženie zmien do repozitára.
        </p>
        <p className="text-danger">Ak <strong>obnovíte</strong> stránku alebo <strong>zavriete</strong> toto okno, neuložené zmeny vykonané v tomto okne budú <strong>stratené</strong>.</p>
        <p>Čo chcete urobiť?</p>
      </Modal.Body>
      <Modal.Footer>
        <div className="mx-auto">
          {json !== undefined && <Button className="mx-2" variant="success" onClick={() => download(json)}><BiDownload /> Stiahnuť hárok</Button>}
          <Button className="mx-2" variant="success" onClick={() => dispatch(storageActions.resume())}><BiRefresh /> Skúsiť znova uložiť</Button>
        </div>
      </Modal.Footer>
    </>
  )
  const mergedSessionError = (saveError: GhSaveError) => (
    <>
      <Modal.Body>
        <p>
          Aktuálna vetva sedenia {ghState.sessionBranch?.name} bola zlúčená do pôvodnej vetvy. Pred uložením vykonaných zmien je potrebné starú vetvu sedenia zmazať.
        </p>
        <p className="text-danger">Pokým nezmažete starú vetvu sedenia, automatické ukladanie bude <strong>pozastavené</strong>.</p>
        <p>Zmeny vykonané v starej vetve sedenia sú uložené vo vetve <strong>{ghState.baseBranch}</strong>.</p>
        <p>Čo chcete urobiť?</p>

        {deleteRefError && (
          <ErrBox><>Operácia zlyhala: {deleteRefError}</></ErrBox>
        )}

      </Modal.Body>
      <Modal.Footer>
        <div className="mx-auto">
          {json !== undefined && <Button className="mx-2" variant="success" onClick={() => download(json)}><BiDownload /> Stiahnuť hárok</Button>}
          <Button className="mx-2" variant="warning" onClick={deleteOldSession}>
            <BiTrash />
            Zmazať starú vetvu
            {deleteRefState === 'loading' && <Loading compact />}
          </Button>
        </div>
      </Modal.Footer>
    </>
  )
  const backgroundUpdateError = (saveError: GhSaveError) => (
    <>
      <Modal.Body>
        <p>
          Zdá sa že súbor hárku bol aktualizovaný na pozadí.
          Zmeny ktoré ste vykonali boli ale spravené na neaktuálnom hárku.
          {json !== undefined && 'Hárok zo zmenami urobenými v tomto okne si môžete stiahnuť.'}
        </p>
        <p className="text-danger">Ak <strong>obnovíte</strong> stránku alebo <strong>zavriete</strong> toto okno, neuložené zmeny vykonané v tomto okne budú <strong>stratené</strong>.</p>
        <p>Čo chcete urobiť?</p>
      </Modal.Body>
      <Modal.Footer>
        <div className="mx-auto">
          {json !== undefined && <Button className="mx-2" variant="success" onClick={() => download(json)}><BiDownload /> Stiahnuť hárok</Button>}
          <Button className="mx-2" variant="danger" onClick={() => window.location.reload()}><BiRefresh /> Obnoviť stránku</Button>
        </div>
      </Modal.Footer>
    </>
  )

  return (
    <Modal
      size="lg"
      aria-labelledby="contained-modal-title-vcenter"
      show={type !== undefined}
    /*onHide={() => setClosed(true)}*/
    /*centered*/
    >
      <Modal.Header>
        <Modal.Title id="contained-modal-title-vcenter">
          Zmeny hárku sa <strong>nepodarilo</strong> uložiť
        </Modal.Title>
      </Modal.Header>

      {type === 'background_update' && backgroundUpdateError(ghState.saveError!)}
      {type === 'merged_session' && mergedSessionError(ghState.saveError!)}
      {type === 'unknown_error' && unknownError(ghState.saveError!)}
    </Modal>
  )

}