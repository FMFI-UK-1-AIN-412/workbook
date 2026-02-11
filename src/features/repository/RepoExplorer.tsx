import { Alert, Badge, Card, ListGroup, Placeholder, Spinner, Row, Col, Dropdown, BadgeProps } from "react-bootstrap";
import { FileEarmark, FileEarmarkPlusFill, FolderFill, BoxArrowUpRight, SlashCircle } from 'react-bootstrap-icons';
import { Link } from "react-router-dom";
import Pathbar from "./Pathbar";
import { ContentDirectory, ReposGetContentApiResponse, ReposListBranchesApiResponse, useReposGetContentQuery, useReposGetQuery, useReposListBranchesQuery } from "../../api/githubApi/endpoints/repos";
import BranchSelect from "./BranchSelect";
import { displayLoadable } from "./displayLoadable";

import styles from './styles.module.css';
import { SerializedError } from "@reduxjs/toolkit";
import { FetchBaseQueryError } from "@reduxjs/toolkit/dist/query";
import CreateFileButton from "./CreateFileButton";
import { useRef } from "react";
import { emptySheet } from "../sheet/slice/sheetSlice";
import { getSessionBranchName, pathURIEncode } from "../../storageWorker/githubStorage/utils";
import DisplayReadme from "./DisplayReadme";
import UserAvatar from "../auth/UserAvatar";
import React from "react";
import { BsPrefixRefForwardingComponent } from "react-bootstrap/esm/helpers";
import { classicNameResolver } from "typescript";

export interface RepoExplorerProps {
  owner: string,
  repo: string,
  branch?: string,
  path: string,
  makeLink: (path: string, fileType: 'file' | 'dir', owner: string, repo: string, branch?: string, openAs?: string) => string
  transformFileItem?: (path: string, fileType: 'file' | 'dir') => { changeIcon?: JSX.Element, changeExternal?: boolean }
}

type FileItem = {
  name: string,
  type: 'file' | 'dir',
};

function isEmptyRepoError(error: any) {
  type github404response = {
    status: number,
    data: {
      message: string,
      documentation_url: string,
    }
  }
  let githubErrResponse;
  try {
    githubErrResponse = error as github404response
  } catch (e) {
    return false;
  }
  if (githubErrResponse
    && githubErrResponse.status === 404
    && githubErrResponse.data.message === 'This repository is empty.') {
    return true;
  }
  return false;
}

const BadgeToggle = React.forwardRef<HTMLSpanElement, BadgeProps>(({ children, onClick, ...props }, ref) => (
  <Badge
    ref={ref}
    onClick={(e) => {
      e.preventDefault();
      if (onClick !== undefined) {
        onClick(e);
      }
    }}
    style={{ cursor: 'pointer' }}
    {...props}
  >
    {children}
  </Badge>
));


type UnsavedChangesProps = Pick<RepoExplorerProps, 'owner' | 'repo' | 'path' | 'branch' | 'makeLink'> & {
  branches: ReposListBranchesApiResponse | undefined
}

const LEGACY = 'Legacy user';

function UnsavedChanges({ owner, repo, path, branch, branches, makeLink }: UnsavedChangesProps) {
  if (branches === undefined) {
    return <></>
  }

  const expectedSessionBranchName = getSessionBranchName({ owner, repo, path, ref: branch || '' });
  const editingUsers = branches
    .filter(b => b.name.startsWith(expectedSessionBranchName))
    .map(b => b.name.slice(expectedSessionBranchName.length + 1))
    || [];

  if (editingUsers.length === 0) {
    return <></>
  }

  return (
    <Dropdown className="d-inline">
      <Dropdown.Toggle as={BadgeToggle} pill bg="secondary"
        title={`Edited by ${editingUsers.map(username => username || LEGACY).join(', ')}`}>
        Unmerged
        {editingUsers.map(username =>
          <UserAvatar key={username || LEGACY} username={username || LEGACY}
            className="rounded-circle ms-1 bg-white text-secondary" size='.75rem'
          />)}
      </Dropdown.Toggle>
      <Dropdown.Menu>
        <Dropdown.Header>Open as</Dropdown.Header>
        {editingUsers.map(username =>
          <Dropdown.Item key={username} as={() =>
            <Link key={username || LEGACY} className="dropdown-item"
              to={makeLink(path, 'file', owner, repo, branch, username || '')}>
              <UserAvatar username={username || LEGACY}
                size='1.5rem' className="me-1 rounded-circle"
              />
              {username || LEGACY}
            </Link>
          }/>
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
}

function RepoExplorer(props: RepoExplorerProps) {
  const { owner, repo, path, makeLink, transformFileItem } = props;
  let { branch } = props;

  const repoInfo = useReposGetQuery({ owner, repo }, { skip: branch !== undefined });
  const branches = useReposListBranchesQuery({ owner, repo, perPage: 100 }, { skip: branch === undefined && !repoInfo.isSuccess });
  const content = useReposGetContentQuery({ owner, repo, ref: branch, path: pathURIEncode(path) }, { skip: branch === undefined && !repoInfo.isSuccess && !branches.isSuccess });

  const existingFilenames = useRef<Set<string>>(new Set());

  if (repoInfo.isSuccess && !branch) {
    branch = repoInfo.data.default_branch;
  }

  const folderIcon = <FolderFill />
  const fileIcon = <FileEarmark />

  const loading = <div className="my-3 text-center"><Spinner animation="border" role="status" /></div>
  const err = (message: string) => {
    return <Alert variant="danger m-4">{message}</Alert>
  }

  const emptyOrError = (error: FetchBaseQueryError | SerializedError) => {
    if (isEmptyRepoError(error)) {
      return (
        <div className="text-center text-muted fs-3">
          <SlashCircle className="fs-2 m-4" />
          The repository is empty
        </div>
      )
    }
    return err(`Načítanie súborov zlyhalo s chybou: ${error}`);
  }

  const renderFileItem = (file: FileItem) => {
    let filePath: string;

    if (file.name === '..') {
      const reducer = (prev: string, current: string) => (prev === '' ? '' : prev + '/') + current;
      filePath = path.split('/').slice(0, -1).reduce(reducer, '');
    } else {
      filePath = path === '' ? file.name : `${path}/${file.name}`;
    }
    const link = makeLink(filePath, file.type, owner, repo, branch);
    let icon = file.type === 'file' ? fileIcon : folderIcon
    let fileNameNode = <>{file.name}</>
    let external = false;

    if (transformFileItem) {
      let { changeIcon, changeExternal } = transformFileItem(filePath, file.type);
      if (changeIcon) {
        icon = changeIcon;
      }
      if (changeExternal) {
        external = changeExternal;
      }
    }

    if (content.isFetching) {
      return (
        <ListGroup.Item className={styles.fileItem} key={file.name}>
          <span className={styles.itemIcon}>{icon}</span>
          <Placeholder xs={1} bg="secondary" />
        </ListGroup.Item>
      )
    }

    return (
      <ListGroup.Item className={styles.fileItem} key={file.name}>
        <span className={styles.itemIcon}>{icon}</span>
        {link ?
          <Link className={styles.linkStyle} style={{ marginRight: '1em' }} to={link} target={external ? '_blank' : undefined}>
            {file.name}{ external && <BoxArrowUpRight className="small ms-2 align-baseline"/>}
          </Link>
          :
          file.name
        }
        <UnsavedChanges {...{ owner, repo, branch, branches: branches.data, path: filePath, makeLink }} />
      </ListGroup.Item>
    )
  }
  const renderFiles = (data: ReposGetContentApiResponse) => {
    let files = [];
    if (path !== '') {
      files.push({ name: '..', type: 'dir' });
    }
    try {
      files.push(...data as ContentDirectory);
    } catch (e) {
      return err('Toto nie je priečinok');
    }
    type FileItem2 = { name: string, type: string };
    const cmp = (f1: FileItem2, f2: FileItem2) => {
      if (f1.type === f2.type) {
        return f1.name.localeCompare(f2.name)
      } else {
        // folders before files
        return f1.type === 'dir' ? -1 : 1;
      }
    }
    files.sort(cmp);

    existingFilenames.current.clear();
    for (const item of files) {
      existingFilenames.current.add(item.name);
    }

    return <ListGroup variant="flush">{files.map((file) => renderFileItem({ name: file.name, type: file.type === 'file' ? 'file' : 'dir' }))}</ListGroup>
  }

  return (
    <>
      <Card className="mb-4">
        <Card.Header className="h6">
          <Row className="g-2 align-items-baseline">
            <Col xs="auto">
              <BranchSelect owner={owner} repo={repo} path={path} branch={branch} makeLink={makeLink} />
            </Col>
            <Col>
              <Pathbar owner={owner} repoName={repo} branch={branch} path={path} makeLink={makeLink} />
            </Col>
            <Col xs="auto">
              <CreateFileButton
                owner={owner} repo={repo} path={path} branch={branch}
                existingFilenames={existingFilenames.current}
                transformFilename={(filename: string) => `${filename}.workbook`}
                commitMessage="Created"
                withContent={JSON.stringify(emptySheet)}
              >
                <FileEarmarkPlusFill /> New worksheet
              </CreateFileButton>
            </Col>
          </Row>
        </Card.Header>
        {displayLoadable(content, loading, renderFiles, emptyOrError)}
      </Card>
      { // display readme only after files have been shown
        content && <DisplayReadme {...{ owner, repo, path, branch }} />
      }
    </>
  )
}

export default RepoExplorer;