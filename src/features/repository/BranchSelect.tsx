import React, { useEffect, useMemo } from "react";
import { useState } from "react";
import { Alert, Button, ListGroup, OverlayTrigger, Popover, PopoverProps, Spinner } from "react-bootstrap";
import { BiGitBranch } from "react-icons/bi";
import { CheckLg, SlashCircle } from "react-bootstrap-icons";
import { Link } from "react-router-dom";
import { ReposGetApiResponse, ReposListBranchesApiResponse, useReposGetQuery, useReposListBranchesQuery } from "../../api/githubApi/endpoints/repos";
import { displayLoadable } from "./displayLoadable";

import styles from "./styles.module.css";
import { isSessionBranchName } from "../../storageWorker/githubStorage/utils";

export interface BranchSelectProps {
  owner: string,
  repo: string,
  branch?: string,
  path: string,
  makeLink: (path: string, fileType: 'file' | 'dir', owner: string, repo: string, branch?: string) => string
}

const UpdatingPopover = React.forwardRef<HTMLDivElement, PopoverProps>(
  ({ popper, children, show: _, ...props }, ref) => {
    useEffect(() => {
      popper.scheduleUpdate();
    }, [popper, children]);
    return (
      <Popover ref={ref} {...props}>
        <Popover.Body className="p-0">
          {children}
        </Popover.Body>
      </Popover>
    );
  },
);

function BranchSelect(props: BranchSelectProps) {
  const { owner, repo, path, makeLink } = props;
  let { branch } = props;

  const [skip, setSkip] = useState(true);

  // load default branch if branch is undefined in props
  const repoInfo = useReposGetQuery({ owner, repo }, { skip: branch !== undefined });
  const branches = useReposListBranchesQuery({ owner, repo, perPage: 100 }, { skip });

  const loadingSmall = <Spinner animation="border" size="sm" role="status" />
  const err = (message: string) => {
    return <Alert variant="danger">{message}</Alert>
  }
  const renderList = (data: ReposListBranchesApiResponse) => {
    if (data.length === 0) {
      return (
        <div className="text-center text-muted">
          <SlashCircle className="m-3" size={'2em'} />
        </div>
      )
    }

    // hide session branches
    const branches = data.filter(b => !isSessionBranchName(b.name));

    return (
      <ListGroup className="rounded-3" variant="flush">
        {branches.map(b => {
          const linkTo = makeLink(path, 'dir', owner, repo, b.name);
          const active = b.name === branch;
          return (
            <ListGroup.Item action key={b.name}>
              <Link className={styles.linkStyle} to={linkTo} onClick={() => document.body.click()}>{active ? <CheckLg /> : <span className="p-2" />} {b.name}</Link>
            </ListGroup.Item>
          )
        })}
      </ListGroup>
    )
  }

  /* using memo prevents render loop */
  const memoizedContent = useMemo(() => {
    return displayLoadable(branches, loadingSmall, renderList, () => err('Načítanie vetiev zlyhalo'))
  }, [branches, branch, loadingSmall, renderList]);

  const renderBranchName = (name: string) => <><BiGitBranch className="me-1"/>{name}</>
  return (
      <OverlayTrigger
        trigger="click"
        placement="bottom"
        onToggle={() => skip && setSkip(false)}
        rootClose
        overlay={(props) => <UpdatingPopover {...props}>{memoizedContent}</UpdatingPopover>}
      >
        <Button className="dropdown-toggle">
          {
            branch ?
              renderBranchName(branch)
              : displayLoadable(repoInfo, loadingSmall, (data: ReposGetApiResponse) => renderBranchName(data.default_branch), () => err('Načítanie vetvy zlyhalo'))
          }
        </Button>
      </OverlayTrigger>
  )
}

export default BranchSelect;