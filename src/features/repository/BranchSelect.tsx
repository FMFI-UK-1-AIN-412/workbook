import React, { useEffect, useMemo } from "react";
import { useState } from "react";
import { Alert, Button, ListGroup, OverlayTrigger, Popover, PopoverProps, Spinner } from "react-bootstrap";
import { BiGitBranch } from "react-icons/bi";
import { BsCaretDownFill, BsCircle, BsCircleFill, BsSlashCircle } from "react-icons/bs";
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
      <Popover ref={ref} body {...props}>
        {children}
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
          <BsSlashCircle style={{ margin: '1em' }} size={'2em'} />
        </div>
      )
    }

    // hide session branches
    const branches = data.filter(b => !isSessionBranchName(b.name));

    return (
      <ListGroup variant="flush">
        {branches.map(b => {
          const linkTo = makeLink(path, 'dir', owner, repo, b.name);
          const active = b.name === branch;
          return (
            <ListGroup.Item action key={b.name}>
              <Link className={styles.linkStyle} to={linkTo} onClick={() => document.body.click()}>{active ? <BsCircleFill size={'0.7em'} /> : <BsCircle size={'0.7em'} />} {b.name}</Link>
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

  const renderBranchName = (name: string) => <><BiGitBranch />{name}<BsCaretDownFill /></>
  return (
      <OverlayTrigger
        trigger="click"
        placement="bottom"
        onToggle={() => skip && setSkip(false)}
        rootClose
        overlay={(props) => <UpdatingPopover {...props}>{memoizedContent}</UpdatingPopover>}
      >
        <Button>
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