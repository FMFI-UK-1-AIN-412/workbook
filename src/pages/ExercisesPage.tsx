import React from "react";
import { Alert, Card, Container, Spinner } from "react-bootstrap";
import { Journals } from 'react-bootstrap-icons';
import { useListExercisesReposQuery } from "../api/githubApi/graphqlApi/baseApi";
import FormattedTextRenderer, { repoUriTransformer } from "../components/FormattedTextRenderer";
import { useAppSelector } from "../app/hooks";
import { authSelectors } from "../features/auth/authSlice";
import LoginPage from "./LoginPage";
import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";

export interface ExercisesPageWrapperProps {
  children: React.ReactNode;
}

const ExercisesPageWrapper = ({ children }: ExercisesPageWrapperProps) =>
  <Container>
    <h1 className="my-3">Workbooks</h1>
    {children}
  </Container>

export default function ExercisesPage() {
  const user = useAppSelector(authSelectors.user);
  const location = useLocation();

  const exercisesRepo = useListExercisesReposQuery({ expression: 'HEAD:workbook.md' })
  console.log(exercisesRepo)

  if (!user) {
    return <LoginPage msg="Log in to view your workbooks" readirectTo={location.pathname} />
  }

  if (exercisesRepo.isLoading) {
    return (
      <ExercisesPageWrapper>
        <div className="text-center my-5">
          <Spinner animation="border" role="status" />
        </div>
      </ExercisesPageWrapper>
    );
  }

  if (exercisesRepo.isError) {
    return (
      <ExercisesPageWrapper>
        <Alert variant="danger" className="my-5">
          <h2 className="h4">Error searching your repositories for workbooks</h2>
          <p className="mb-0">Try reloading the page or <Link to="/repos">browse repositories</Link>.</p>
        </Alert>
      </ExercisesPageWrapper>
    );
  }

  const repoViews = exercisesRepo.isSuccess
    ? exercisesRepo.data.viewer.repositories.nodes.filter(p => p.object !== null)
    : []

  if (repoViews.length === 0) {
    return (
      <ExercisesPageWrapper>
        <Alert variant="secondary" className="text-secondary-emphasis my-5">
          <h2 className="h4">No workbooks found</h2>
          <p>
            None of your repositories contain a workbook summary document
            (<code>workbook.md</code>).
          </p>
          <Link to="/repos" className="btn btn-primary">
            Browse repositories
          </Link>
        </Alert>
      </ExercisesPageWrapper>
    )
  }

  return (
    <ExercisesPageWrapper>
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
    </ExercisesPageWrapper>
  )
}
