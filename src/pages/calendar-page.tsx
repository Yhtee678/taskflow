import { CalendarView } from '@/features/calendar/calendar-view';
import { Link, useSearchParams } from 'react-router-dom';
import { useRemote } from '@/app/use-remote';
import { useWorkspace } from '@/app/workspace-context';
import { loadProject } from '@/features/tasks/queries';
import { RemoteState } from '@/components/ui/remote-state';
export function CalendarPage() {
  const [params] = useSearchParams();
  const projectId = params.get('project');
  return projectId ? (
    <ProjectCalendar key={projectId} projectId={projectId} />
  ) : (
    <CalendarView />
  );
}
function ProjectCalendar({ projectId }: { projectId: string }) {
  const { revision, refresh } = useWorkspace();
  const state = useRemote(`${projectId}:${revision}`, () =>
    loadProject(projectId),
  );
  return state.data ? (
    <CalendarView bundle={state.data} />
  ) : (
    <>
      <RemoteState state={state} retry={refresh} />
      <Link to="/calendar">Return to personal Calendar</Link>
    </>
  );
}
