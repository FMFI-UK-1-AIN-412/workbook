import { Button, Modal } from "react-bootstrap";
import { useAppDispatch, useAppSelector } from "../../../app/hooks";
import { sheetActions, sheetSelectors } from "../slice/sheetSlice";

export default function ImportWarningModal() {
  const importInfo = useAppSelector(sheetSelectors.importInfo);
  
  if (importInfo === undefined) {
    return <></>
  } else {
    if (importInfo.error !== undefined) {
      return <DisplayError error={importInfo.error}/>
    } else {
      return <DisplayWarning json={importInfo.json}/>
    }
  }

}

function DisplayWarning({ json }: { json: string }) {
  const dispatch = useAppDispatch();
  return (
    <Modal show={true} onHide={() => dispatch(sheetActions.clearImport())}>
      <Modal.Header closeButton>
        <Modal.Title>Import Warning</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        Current workbook will be replaced. Do you want to continue?
      </Modal.Body>
      <Modal.Footer>
        <Button variant='secondary' onClick={() => dispatch(sheetActions.clearImport())}>Cancel</Button>
        <Button variant='danger' onClick={() => dispatch(sheetActions.import({ json }))}>Continue</Button>
      </Modal.Footer>
    </Modal>
  )
}

function DisplayError({ error }: { error: string }) {
  const dispatch = useAppDispatch();
  return (
    <Modal show={true} onHide={() => dispatch(sheetActions.clearImport())}>
      <Modal.Header closeButton>
        <Modal.Title>Import Error</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>{error}</p>
      </Modal.Body>
    </Modal>
  )
}