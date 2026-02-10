import { Journals } from 'react-bootstrap-icons';
import { useListExercisesReposQuery } from "../api/githubApi/graphqlApi/baseApi";
import FormattedTextRenderer, { repoUriTransformer } from "../components/FormattedTextRenderer";
import { useAppSelector } from "../app/hooks";
import { authSelectors } from "../features/auth/authSlice";
import LoginPage from "./LoginPage";
import { useLocation } from "react-router-dom";

export default function ExercisesPage() {
  const user = useAppSelector(authSelectors.user);
  const location = useLocation();
  const exercisesRepo = useListExercisesReposQuery({ expression: 'HEAD:workbook.md' })
  console.log(exercisesRepo)

  const repoViews = exercisesRepo.isSuccess
    ? exercisesRepo.data.viewer.repositories.nodes.filter(p => p.object !== null)
    : []

  if (!user) {
    return <LoginPage msg="Pre pokračovanie sa musíte prihlásiť" readirectTo={location.pathname} />
  }

  return (
    <Container>
      <h1 className="my-3">Workbooks</h1>
      {repoViews.map(view => (
        <Card key={view.object.oid}>
          <Card.Header><h2 className="h5 my-1 d-inline-block"><Journals className="me-2"/><Link to={`/repo/${user.login}/${view.name}`}>{user.login}/{view.name}</Link></h2></Card.Header>
          <Card.Body as="article">
            <FormattedTextRenderer
              text={view.object.text}
              uriTransformer={repoUriTransformer(`/${user.login}/${view.name}/blob/${view.defaultBranchRef.name}`)}
            />
          </Card.Body>
        </Card>
      ))}
    </Container>
  )
}