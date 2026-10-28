import { Navigate, useParams } from 'react-router-dom';
export function DeadlineCalendarPage() {
  const { projectId } = useParams();
  return (
    <Navigate
      to={`/calendar?project=${encodeURIComponent(projectId ?? '')}`}
      replace
    />
  );
}
