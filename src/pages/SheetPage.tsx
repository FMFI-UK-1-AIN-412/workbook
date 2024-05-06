import { useEffect, useRef, useState } from "react";
import { ButtonGroup, ButtonToolbar, Container, Dropdown } from "react-bootstrap";
import { useLocation, useParams } from "react-router-dom";
import { FileEarmarkRuledFill, GearFill } from "react-bootstrap-icons";
import { authSelectors } from "../features/auth/authSlice";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { makeRepoLink, parseFilepath, parseGithubUrlPath } from "./RepoPage";
import Sheet from "../features/sheet/Sheet";
import Pathbar from "../features/repository/Pathbar";
import Err404Page from "./Err404Page";
import BranchLabel from "../features/repository/BranchLabel";
import LoginPage from "./LoginPage";
import SheetSettingsModal, { SettingTab, tabsInfo } from "../features/sheet/modals/SheetSettingsModal";
import MergeSheetModal from "../features/sheetStorage/github/MergeSheetModal";
import SaveIndicator from "../features/sheetStorage/SaveIndicator";
import MergeButton from "../features/sheetStorage/github/MergeButton";
import SaveErrorModal from "../features/sheetStorage/github/SaveErrorModal";
import UndoRedoButtonGroup from "../features/sheet/UndoRedo";
import classNames from 'classnames/dedupe';
import styles from './SheetPage.module.scss';
import { loadSheet, storageSelectors } from "../features/sheetStorage/storageSlice";
import { GithubFileLocation } from "../storageWorker/githubStorage/types";
import { downloadSheet } from "../features/sheet/slice/sheetSlice";

function SheetPage() {
  const authState = useAppSelector(authSelectors.authState);
  const user = useAppSelector(authSelectors.user);
  const iid = useAppSelector(storageSelectors.instanceId);
  const location = useLocation();
  const params = useParams();
  const { owner, repo } = params;
  const repoParams = parseGithubUrlPath(params['*'] || '');

  const ghLocation = useRef<GithubFileLocation | undefined>(undefined);
  const dispatch = useAppDispatch();

  useEffect(() => {
    let lastLoaded: GithubFileLocation | undefined = undefined
    if (ghLocation.current !== undefined && JSON.stringify(ghLocation.current) !== JSON.stringify(lastLoaded)) {
      lastLoaded = { ...ghLocation.current };
      dispatch(loadSheet('github1', ghLocation.current))
    }
  }, [ghLocation, dispatch]);

  const [settingsTab, setSettingsTab] = useState<SettingTab>('NONE')
  const [mergeSheetModal, setMergeSheetModal] = useState(false);

  if ('error' in repoParams) {
    return (<Err404Page />);
  } else if (!user || authState !== "authenticated") {
    return <LoginPage msg="Pre pokračovanie sa musíte prihlásiť" readirectTo={location.pathname} />
  } else {
    const { branch, type, path } = repoParams;
    const { extension } = parseFilepath(path);
    if (type !== 'file' || extension !== 'workbook' || !owner || !repo || !branch) {
      return (<Err404Page />);
    } else {
      ghLocation.current = { owner, repo, path: path, ref: branch };
      return (
        <Container fluid className={classNames("w-100 m-0 p-0 bg-body", styles.sheetContainer)}>

          <MergeSheetModal show={mergeSheetModal} onClose={() => setMergeSheetModal(false)} />
          <SheetSettingsModal tab={settingsTab} onClose={() => setSettingsTab('NONE')} />
          <SaveErrorModal />

          <div className={classNames("p-3 border-bottom d-flex align-items-center flex-wrap position-sticky bg-body", styles.sheetToolbar)}>
            <div style={{}}>
              <FileEarmarkRuledFill />
              <BranchLabel branch={branch} />
              <Pathbar owner={owner} path={path} branch={branch} repoName={repo} makeLink={makeRepoLink} />
            </div>
            <div><SaveIndicator style={{ marginLeft: '1rem' }} /></div>
            <div style={{ flexGrow: '1' }}></div>
            <ButtonToolbar className="d-inline-block">
              <UndoRedoButtonGroup />
              <ButtonGroup className="me-2">
                <MergeButton />
              </ButtonGroup>
              <ButtonGroup>
                <Dropdown>
                  <Dropdown.Toggle title="Workbook settings" variant="secondary">
                    <GearFill />
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    {Object.entries(tabsInfo)
                      .filter(([tabName]) => tabName !== 'NONE')
                      .map(([tabName, tabInfo]) => <Dropdown.Item key={tabName} onClick={() => setSettingsTab(tabName as SettingTab)}>{tabInfo.title}</Dropdown.Item>)
                    }
                    <Dropdown.Item onClick={() => dispatch(downloadSheet())}>Download sheet</Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </ButtonGroup>
            </ButtonToolbar>
          </div>
          <Sheet
            /* forces unmount of old sheet components on reload */
            key={iid}
          />
        </Container>
      )
    }
  }
}

export default SheetPage;