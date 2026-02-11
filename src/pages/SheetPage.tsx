import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, ButtonGroup, ButtonToolbar, Container, Dropdown } from "react-bootstrap";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { FileEarmarkRuledFill, GearFill } from "react-bootstrap-icons";
import { authSelectors } from "../features/auth/authSlice";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { makeRepoLink, parseFilepath, parseGithubUrlPath } from "./RepoPage";
import Sheet from "../features/sheet/Sheet";
import Pathbar from "../features/repository/Pathbar";
import UserAvatar from "../features/auth/UserAvatar";
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
import { downloadSheet, importFromFile } from "../features/sheet/slice/sheetSlice";
import RecomendedBranchModal from "../features/sheetStorage/github/RecomendedBranchModal";
import HandInButton from "../features/sheetStorage/github/HandInButton";
import { StorageNavigationBlocker } from "../features/sheetStorage/StorageNavigationBlocker";
import { GhOpenPayload } from "../storageWorker/githubStorage1/ghEngine";
import { useReposListBranchesQuery } from "../api/githubApi/endpoints/repos";
import { getSessionBranchName } from "../storageWorker/githubStorage/utils";

function SheetPage() {
  const authState = useAppSelector(authSelectors.authState);
  const user = useAppSelector(authSelectors.user);
  const iid = useAppSelector(storageSelectors.instanceId);
  const location = useLocation();
  const params = useParams();
  const { owner, repo } = params;
  const url = params['*']
  const repoParams = useMemo(() => parseGithubUrlPath(url || ''), [url]);
  let [searchParams] = useSearchParams();
  const ghLocation = useRef<GhOpenPayload | undefined>(undefined);
  const dispatch = useAppDispatch();

  useEffect(() => {
    let lastLoaded: GhOpenPayload | undefined = undefined
    if (ghLocation.current !== undefined && JSON.stringify(ghLocation.current) !== JSON.stringify(lastLoaded)) {
      console.log('loading sheet', ghLocation.current);
      lastLoaded = { ...ghLocation.current };
      dispatch(loadSheet('github1', ghLocation.current))
    }
  }, [repoParams, dispatch]);

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
      const openAs = searchParams.get('openAs') ?? user.login;
      ghLocation.current = { owner, repo, path: path, ref: branch, openAs };
      return (
        <Container fluid className={classNames("w-100 m-0 p-0 bg-body", styles.sheetContainer)}>

          <MergeSheetModal show={mergeSheetModal} onClose={() => setMergeSheetModal(false)} />
          <SheetSettingsModal tab={settingsTab} onClose={() => setSettingsTab('NONE')} />
          <SaveErrorModal />
          <RecomendedBranchModal addr={ghLocation.current} />
          <StorageNavigationBlocker />

          <div className={classNames("p-3 border-bottom d-flex align-items-center flex-wrap position-sticky bg-body", styles.sheetToolbar)}>
            <div style={{}}>
              <FileEarmarkRuledFill />
              <BranchLabel branch={branch} />
              <Pathbar owner={owner} path={path} branch={branch} repoName={repo} makeLink={makeRepoLink} />
              {openAs !== user.login &&
              <Badge pill bg="warning" className="fs-6 py-0 pe-0 ms-2 text-bg-warning">
                Opened as
                <UserAvatar className="mx-1 bg-white rounded-circle border border-2 border-warning"
                  size='2.25rem'
                  title={openAs || LEGACY} username={openAs || LEGACY} />
              </Badge>}
            </div>
            <div className="mx-3"><SaveIndicator /></div>
            <div style={{ flexGrow: '1' }}></div>
            <AlsoEditedBy owner={owner} repo={repo} branch={branch} path={path} openAs={openAs} className="me-3"/>
            <ButtonToolbar className="d-inline-block">
              <UndoRedoButtonGroup />
              <ButtonGroup className="me-2">
                <MergeButton />
                <HandInButton addr={ghLocation.current} />
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
                    <Dropdown.Item onClick={() => dispatch(importFromFile())}>Import sheet</Dropdown.Item>
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

type AlsoEditedByProps = {
  owner: string,
  repo: string,
  branch: string,
  path: string,
  openAs: string,
  className?: string,
}

const LEGACY = 'Legacy user';

function AlsoEditedBy({ owner, repo, branch, path, openAs, className }: AlsoEditedByProps) {
  const branches = useReposListBranchesQuery({ owner: owner, repo: repo, perPage: 100 });

  if (branches.isLoading || branches.isError || branches.data === undefined) {
    return <></>
  }

  const expectedSessionBranchName = getSessionBranchName({ owner, repo, path, ref: branch || '' });
  const editingUsers = branches.data
    ?.filter(b => b.name.startsWith(expectedSessionBranchName))
    .map(b => b.name.slice(expectedSessionBranchName.length + 1))
    .filter(username => username !== openAs)
    .map(username => username || LEGACY)
    || [];

  if (editingUsers.length === 0) {
    return <></>
  }

  return (
    <span title={`Also edited by ${editingUsers.join(', ')}`} className={className}>
      {editingUsers.map(username =>
        <UserAvatar key={username} username={username}
          className="me-1 border border-2 border-danger rounded-circle" size='2.25rem' />
      )}
    </span>
  );  

}

export default SheetPage;