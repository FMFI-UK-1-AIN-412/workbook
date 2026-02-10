import { useRef, useState } from "react";
import { Col, Container, FormControl, Row } from "react-bootstrap";
import { useLocation, useParams } from "react-router-dom";
import { authSelectors } from "../features/auth/authSlice";
import { useAppSelector } from "../app/hooks";
import CheckList from "../components/CheckList";
import Err404Page from "./Err404Page";
import LoginPage from "./LoginPage";
import OptionList from "../components/OptionList";
import { PopoverButton } from "../components/PopoverMenu";
import RepoList from "../features/repository/RepoList";
import { makeRepoLink } from "./RepoPage";

function RepoListPage() {
  const location = useLocation();
  const params = useParams();
  const authState = useAppSelector(authSelectors.authState);
  const user = useAppSelector(authSelectors.user);

  const [affiliation, setAffiliation] = useState<string[]>(['owner']);
  const [sortBy, setSortBy] = useState<string>('pushed');
  const time = useRef<boolean>(false)
  const q = useRef('');
  const [query, setQuery] = useState<string | undefined>(undefined);

  if (params.page && params.page.match("^[1-9]\\d*$") === null) {
    return <Err404Page />
  }

  if (authState !== "authenticated") {
    return <LoginPage msg="You have to be logged in to continue" readirectTo={location.pathname} />
  }
  const makePageLink = (page: number) => page === 1 ? '/repos' : `/repos/${page}`;

  return (
    <Container>
      <h1 className="my-3">Repositories</h1>

      <Row className="gx-3 gy-2 mb-3">
        <Col md xs={12}>
          <FormControl type="text" placeholder="Search repositories" style={{ display: 'inline-block', width: '100%' }} onChange={e => {
            console.log(e.target.value);
            q.current = e.target.value;
            if (time.current === false) {
              time.current = true;
              setTimeout(() => { setQuery(q.current === '' ? undefined : q.current); time.current = false }, 1000)
            }
          }
          } />
        </Col>
        <Col className="text-center" md="auto" xs={6}>
          <PopoverButton className="" title="Sort">
            <OptionList selected={sortBy} onSelectedChange={selected => setSortBy(selected)}>
              <OptionList.Item name="full_name">Name</OptionList.Item>
              <OptionList.Item name="pushed">Last updated</OptionList.Item>
            </OptionList>
          </PopoverButton>
        </Col>
        <Col className="text-center" md="auto" xs={6}>
          <PopoverButton className="" title="Repositories">
            <CheckList onCheckedChange={(arr) => { console.log(arr); setAffiliation(arr) }} checked={affiliation}>
              <CheckList.Item name="owner">Yours</CheckList.Item>
              <CheckList.Item name="organization_member">Organizational</CheckList.Item>
            </CheckList>
          </PopoverButton>
        </Col>
      </Row>
      {/* <hr className="mb-3 mt-0" /> */}

      <RepoList
        user={user!.login}
        sort={sortBy as 'full_name' | 'pushed'}
        affiliation={affiliation.reduce((p, c) => `${p},${c}`, '')}
        query={query}
        itemsPerPage={10}
        page={(params.page && parseInt(params.page)) || undefined}
        makePageLink={makePageLink}
        makeRepoLink={makeRepoLink}
      />
    </Container >
  )
}

export default RepoListPage;