import { Base64 } from "js-base64";
import { ReposGetContentApiResponse, useReposGetContentQuery } from "../../api/githubApi/endpoints/repos";
import FormattedTextRenderer, { repoUriTransformer } from "../../components/FormattedTextRenderer";
import { pathURIEncode } from "../../storageWorker/githubStorage/utils";
import { Card, Nav } from "react-bootstrap";
import { Icon, Book, Journals } from 'react-bootstrap-icons'
import { useState } from "react";

interface Readme {
  name: string,
  Icon: Icon
}

const readmes: Readme[] = [
  { name: 'workbook.md', Icon: Journals },
  { name: 'readme.md', Icon: Book },
]

interface DirReadmesProps {
  owner: string,
  repo: string,
  branch?: string,
  path: string,
}

export interface ReadmeContentProps {
  owner: string,
  repo: string,
  branch?: string,
  path: string,
  readme: string,
}

function findReadmes(dirContent?: ReposGetContentApiResponse): Readme[] {
  if (dirContent === undefined || !(dirContent instanceof Array))
    return [];
  return readmes.map(({ name: readmeName, Icon }) =>
      ({
        name: dirContent.find(({ name }) => name.toLowerCase() === readmeName)?.name,
        Icon
      })
    ).filter((readme) => readme.name !== undefined)
    .map(({ name, Icon }) => ({ name: name!, Icon }));
}

function readmeContent(readmeContent?: ReposGetContentApiResponse) {
  if (readmeContent !== undefined && 'content' in readmeContent) {
    const base64 = readmeContent.content;
    return Base64.decode(base64)
  }
}

function ReadmeContent({ owner, repo, branch, path, readme }: ReadmeContentProps) {
  const fileContent = useReposGetContentQuery({
    owner,
    repo,
    ref: branch,
    path: pathURIEncode(`${path}/${readme}`)
  })

  const content = readmeContent(fileContent.data);

  console.log("ReadmeContent path:", `/${owner}/${repo}/blob/${branch}${pathURIEncode(path)}`);
  console.log("ReadmeContent content:", content);

  return (fileContent.isSuccess && content) ?
    <FormattedTextRenderer
      text={content}
      uriTransformer={repoUriTransformer(`/${owner}/${repo}/blob/${branch}${pathURIEncode(path)}`)}
    />
  : <></>;
}

export default function DirReadmes({ owner, repo, branch, path }: DirReadmesProps) {
  const [readmeIdx, setReadmeIdx] = useState(0);

  const dirContent = useReposGetContentQuery({
    owner, repo,
    ref: branch,
    path: pathURIEncode(path)
  });
  const existingReadmes: Readme[] = findReadmes(dirContent.data);
  
  return (dirContent.isSuccess && existingReadmes.length > 0) ? (
    <Card className="mb-5">
      <Card.Header>
        <Nav variant="tabs">
          {existingReadmes.map(({name, Icon}, index) =>
            <Nav.Item key={index} onClick={() => setReadmeIdx(index)}>
              <Nav.Link active={index === readmeIdx}><Icon className="me-2" /> {name}</Nav.Link>
            </Nav.Item>
          )}
        </Nav>
      </Card.Header>
      <Card.Body as="article">
        <ReadmeContent owner={owner} repo={repo} branch={branch} path={path} readme={existingReadmes[readmeIdx].name} />
      </Card.Body>
    </Card>
  )
    : <></>
}
