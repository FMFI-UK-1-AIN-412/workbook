import { useEffect, useState } from "react";
import { Button, Form, Modal, Row } from "react-bootstrap";
import { useReposGetQuery } from "../../../api/githubApi/endpoints/repos";
import { GhOpenPayload } from "../../../storageWorker/githubStorage1/ghEngine";
import { useAppSelector } from "../../../app/hooks";
import { sheetSelectors } from "../../sheet/slice/sheetSlice";
import { Gh1HandInErr } from "../../../storageWorker/githubStorage1/types";

interface HandInModalProps {
  addr: GhOpenPayload,
  show: boolean,
  onHide: () => void,
  onCreatePR: (title: string, body: string) => void,
  existingPullUrl?: string,
  handInError?: Gh1HandInErr,
}

export default function HandInModal({ addr, show, onHide, onCreatePR, existingPullUrl, handInError }: HandInModalProps) {
  return (<>
    <Modal
      show={show}
      onHide={onHide}
      centered
    >
      {
        handInError !== undefined
          ? <DisplayHandInError handInError={handInError} />
          : existingPullUrl !== undefined
            ? <DisplayPRBody addr={addr} existingPullUrl={existingPullUrl} />
            : <CreatePRBody addr={addr} onCreatePR={onCreatePR} />
      }
    </Modal>
  </>)
}

function CreatePRBody({ addr, onCreatePR }: Pick<HandInModalProps, 'addr' | 'onCreatePR'>) {
  const { owner, repo, ref } = addr;
  const filename = useAppSelector(sheetSelectors.filename);
  const settings = useAppSelector(sheetSelectors.sheetSettings);
  const repoInfo = useReposGetQuery({ owner, repo });

  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (title === '') {
      setTitle(`Handing in ${filename}`)
    }
  }, [title, filename])

  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title>Hand In</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>You are about to create a pull request from &nbsp;
          <code>{owner}/{repo}:{ref}</code> into &nbsp;
          <code>{repoInfo.data?.parent?.owner.login}/{repoInfo.data?.parent?.name}:{settings.github?.handinBranch}</code>.
        </p>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Title</Form.Label>
            <Form.Control type="email" placeholder="title" value={title} onChange={e => setTitle(e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Comment</Form.Label>
            <Form.Control as="textarea" placeholder="comment" value={comment} onChange={e => setComment(e.target.value)} rows={3} />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={() => onCreatePR(title, comment)}>Create pull request</Button>
      </Modal.Footer>
    </>
  )
}

function DisplayPRBody({ addr, existingPullUrl }: Pick<HandInModalProps, 'addr' | 'existingPullUrl'>) {
  const { owner, repo, ref } = addr;
  const settings = useAppSelector(sheetSelectors.sheetSettings);
  const repoInfo = useReposGetQuery({ owner, repo });
  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title>Hand In</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          Hand in pull request request from &nbsp;
          <code>{owner}/{repo}:{ref}</code> into &nbsp;
          <code>{repoInfo.data?.parent?.owner.login}/{repoInfo.data?.parent?.name}:{settings.github?.handinBranch}</code>&nbsp;
          was already created.
        </p>
        <p>
          You can view it on github: <a href={existingPullUrl} target="_blank" rel="noreferrer">{existingPullUrl}</a>
        </p>
      </Modal.Body>
    </>
  )
}

function DisplayHandInError({ handInError }: Required<Pick<HandInModalProps, 'handInError'>>) {
  return <>
    <Modal.Header closeButton>
      <Modal.Title>Hand In Error</Modal.Title>
    </Modal.Header>
    <Modal.Body>
      <p>{handInError.reason === 'api_call_failed'
        ? 'API call failed'
        : 'No parent repository'
      }: {handInError.message}</p>
    </Modal.Body>
  </>
}