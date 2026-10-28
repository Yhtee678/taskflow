import { allRows, changed, dataClient, dataError } from '@/lib/data-client';
import type { NotificationRow, TaskRow, ProjectRow } from '@/types/database';
export interface InboxItem extends NotificationRow {
  project_name: string;
  task_title: string;
}
export async function loadInbox(
  userId: string,
  reminders = false,
): Promise<InboxItem[]> {
  const db = dataClient();
  if (reminders) {
    const { error } = await db.rpc('refresh_deadline_reminders', {});
    if (error) throw dataError(error);
  }
  const notifications = await allRows((a, b) =>
    db
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(a, b),
  );
  const ids = [
    ...new Set(notifications.flatMap((n) => (n.task_id ? [n.task_id] : []))),
  ];
  const taskRows: Pick<TaskRow, 'id' | 'project_id' | 'title'>[] = [];
  for (let i = 0; i < ids.length; i += 100)
    taskRows.push(
      ...(await allRows((a, b) =>
        db
          .from('tasks')
          .select('id,project_id,title')
          .in('id', ids.slice(i, i + 100))
          .order('id')
          .range(a, b),
      )),
    );
  const projectIds = [...new Set(notifications.map((n) => n.project_id))];
  const projects: Pick<ProjectRow, 'id' | 'name'>[] = [];
  for (let i = 0; i < projectIds.length; i += 100)
    projects.push(
      ...(await allRows((a, b) =>
        db
          .from('projects')
          .select('id,name')
          .in('id', projectIds.slice(i, i + 100))
          .order('id')
          .range(a, b),
      )),
    );
  // If membership disappears between the inbox and title lookups, do not retain
  // an inaccessible notification or render a stale link from the earlier query.
  return notifications.flatMap((n) => {
    const task = taskRows.find(
        (t) => t.id === n.task_id && t.project_id === n.project_id,
      ),
      project = projects.find((p) => p.id === n.project_id);
    return project && (task || n.kind === 'discussion_added')
      ? [{ ...n, task_title: task?.title ?? '', project_name: project.name }]
      : [];
  });
}
export async function markNotificationRead(userId: string, id: string) {
  return changed(
    await dataClient()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select(),
  );
}
