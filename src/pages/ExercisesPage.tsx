import { Card, Container } from "react-bootstrap";
import { useListExercisesReposQuery } from "../api/githubApi/graphqlApi/baseApi";
import FormattedTextRenderer from "../components/FormattedTextRenderer";

export default function ExercisesPage() {

  const exercisesRepo = useListExercisesReposQuery({ expression: 'HEAD:workbook.md' })
  console.log(exercisesRepo)

  const repoViews = exercisesRepo.isSuccess
    ? exercisesRepo.data.viewer.repositories.nodes.filter(p => p.object !== null)
    : []
  
  return (
    <Container>
      <h1 className="my-3">Workbooks</h1>
      {repoViews.map(view => (
        <Card key={view.object.oid}>
          <Card.Header>{view.name}</Card.Header>
          <Card.Body>
            <FormattedTextRenderer text={view.object.text} />
          </Card.Body>
        </Card>
      ))}
    </Container>
  )
}