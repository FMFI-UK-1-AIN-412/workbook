import { Base64 } from "js-base64";
import { ReposGetContentApiResponse, useReposGetContentQuery } from "../../api/githubApi/endpoints/repos";
import FormattedTextRenderer from "../../components/FormattedTextRenderer";
import { pathURIEncode } from "../../storageWorker/githubStorage/utils";
import { Card } from "react-bootstrap";
import { CgReadme } from 'react-icons/cg'

export interface RepoReadmeProps {
  owner: string,
  repo: string,
  branch?: string,
  path: string,
}

function findReadme(dirContent?: ReposGetContentApiResponse) {
  if (dirContent !== undefined && dirContent instanceof Array) {
    return dirContent.find(({ name }) => name === 'README.md')?.name
  }
}

function readmeContent(readmeContent?: ReposGetContentApiResponse) {
  if (readmeContent !== undefined && 'content' in readmeContent) {
    const base64 = readmeContent.content;
    return Base64.decode(base64)
  }
}

export default function DisplayReadme({ owner, repo, branch, path }: RepoReadmeProps) {
  const dirContent = useReposGetContentQuery({
    owner, repo,
    ref: branch,
    path: pathURIEncode(path)
  });
  const readme = findReadme(dirContent.data);
  const fileContent = useReposGetContentQuery({
    owner,
    repo,
    ref: branch,
    path: pathURIEncode(`${path}/${readme}`)
  }, {
    skip: readme === undefined
  })
  const content = readmeContent(fileContent.data)
  
  return content ? (
    <Card className="mb-5">
      <Card.Header className="h6">
        <CgReadme /> Readme
      </Card.Header>
      <Card.Body>
        <FormattedTextRenderer text={content} />
      </Card.Body>
    </Card>
  )
    : <></>
}