import { useContext, useRef, useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { RemoteState } from '@/components/ui/remote-state';
import { useAuth } from '@/features/auth/auth-context';
import { useWorkspace } from '@/app/workspace-context';
import { useRemote } from '@/app/use-remote';
import { loadMyTasks, saveTask } from '@/features/tasks/queries';
import { TaskList } from '@/features/tasks/task-list';
import { TaskFilters } from '@/features/tasks/task-filters';
import { filterTasks } from '@/features/tasks/filter-tasks';
import {
  MiniCalendar,
  type PersonalScheduleSnapshot,
} from '@/features/calendar/mini-calendar';
import { SelectedProjectContext } from '@/components/layout/project-context';
import { RecentActivity } from '@/features/project-activity/recent-activity';
import { MyTasksBanner } from '@/features/tasks/my-tasks-banner';
import { useLiveTime } from '@/features/tasks/use-live-time';
import type { Status, TaskRow } from '@/types/database';
export function MyTasksPage() {
  const { session } = useAuth();
  const project = useContext(SelectedProjectContext);
  const {
    revision,
    refresh,
    mutate,
    myTasksFilters: filters,
    setMyTasksFilters: setFilters,
  } = useWorkspace();
  const [overrides, setOverrides] = useState<Record<string, Status>>({});
  const inFlight = useRef(new Set<string>());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [schedule, setSchedule] = useState<PersonalScheduleSnapshot | null>(
    null,
  );
  const state = useRemote(`${session!.user.id}:${revision}`, () =>
    loadMyTasks(session!.user.id),
  );
  const tasks =
    state.data?.map((t) =>
      overrides[t.id] ? { ...t, status: overrides[t.id] } : t,
    ) ?? null;
  const now = useLiveTime(tasks, schedule?.data?.occurrences);
  async function toggle(task: TaskRow) {
    if (inFlight.current.has(task.id)) return;
    inFlight.current.add(task.id);
    setPending(new Set(inFlight.current));
    const status = task.status === 'done' ? 'todo' : 'done';
    setOverrides((current) => ({ ...current, [task.id]: status }));
    try {
      const saved = await mutate(
        () => saveTask(task.project_id, { status }, task.id),
        status === 'done' ? 'Task completed.' : 'Task marked to do.',
      );
      if (!saved)
        setOverrides((current) => {
          const next = { ...current };
          delete next[task.id];
          return next;
        });
    } finally {
      inFlight.current.delete(task.id);
      setPending(new Set(inFlight.current));
    }
  }
  return (
    <>
      <MyTasksBanner
        tasks={tasks}
        taskError={state.error}
        schedule={schedule}
        now={now}
      />
      <div className="my-tasks-with-calendar">
        <div className="my-tasks-main">
          {project && (
            <p className="project-heading" aria-label="Current project">
              {project.name}
            </p>
          )}
          {project && (
            <RecentActivity key={project.id} projectId={project.id} preview />
          )}
          <PageHeader
            showProject={false}
            title="My Tasks"
            description="Your assigned work across all projects."
          />
          <TaskFilters value={filters} onChange={setFilters} global />
          {tasks ? (
            <section className="list-section">
              <h2>
                Assigned to me{' '}
                <span className="count">
                  {filterTasks(tasks, filters).length}
                </span>
              </h2>
              <TaskList
                tasks={filterTasks(tasks, filters)}
                showProject
                onToggleCompletion={(task) => void toggle(task)}
                completionPending={pending}
              />
            </section>
          ) : (
            <RemoteState state={state} retry={refresh} />
          )}
        </div>
        <MiniCalendar tasks={tasks ?? []} onScheduleChange={setSchedule} />
      </div>
    </>
  );
}
