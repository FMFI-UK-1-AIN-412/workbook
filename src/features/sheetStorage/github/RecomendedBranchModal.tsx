import { Button, Modal } from "react-bootstrap";
import { Gh1CustomState } from "../../../storageWorker/githubStorage1/types";
import { SheetSettings, sheetSelectors } from "../../sheet/slice/sheetSlice";
import { useState } from "react";
import { connect } from "react-redux";
import { RootState } from "../../../app/store";
import { storageSelectors } from "../storageSlice";
import { LinkContainer } from "react-router-bootstrap";
import { makeRepoLink } from "../../../pages/RepoPage";
import { GithubFileLocation } from "../../../storageWorker/githubStorage/types";

interface MappedProps {
  storageEngine: ReturnType<typeof storageSelectors.storageEngine>
  sheetSettings: SheetSettings,
}

interface OwnProps {
  addr: GithubFileLocation
}

type RecomendedBranchModalProps = MappedProps & OwnProps

function RecomendedBranchModal(props: RecomendedBranchModalProps) {
  const { storageEngine, sheetSettings, addr } = props;
  const [closed, setClosed] = useState(false);

  if (storageEngine === undefined
    || storageEngine.type !== 'github1'
    || storageEngine.custom === undefined) {
    return <></>
  }

  const customState = storageEngine.custom as Gh1CustomState
  const show =
    sheetSettings.github?.editBranch !== undefined
    && sheetSettings.github.editBranch.trim() !== ''
    && customState.baseBranch !== sheetSettings.github.editBranch
    && !closed

  return (
    <Modal
      show={show}
      onHide={() => setClosed(true)}
      centered
    >
      <Modal.Header closeButton>
        <Modal.Title id="contained-modal-title-vcenter">
          Recomended branch
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          This workbook has set recomended editing branch to '{sheetSettings.github?.editBranch}', but you are currently using '{addr.ref}'
        </p>
      </Modal.Body>
      <Modal.Footer>
        <div className="mx-auto">
          <Button className="mx-2" variant="secondary" onClick={() => setClosed(true)}>
            Continue
          </Button>
          <LinkContainer to={makeRepoLink(addr.path, 'file', addr.owner, addr.repo, sheetSettings.github?.editBranch)}>
            <Button className="mx-2" variant="success">
              Use recomended
            </Button>
          </LinkContainer>
        </div>
      </Modal.Footer>

    </Modal>
  )
}

const mapStateToProps = (state: RootState, ownProps: OwnProps): RecomendedBranchModalProps => ({
  storageEngine: storageSelectors.storageEngine(state),
  sheetSettings: sheetSelectors.sheetSettings(state),
  addr: ownProps.addr
})

export default connect(mapStateToProps)(RecomendedBranchModal)