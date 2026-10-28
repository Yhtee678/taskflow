import type { NotificationRow } from '@/types/database';
import { statusLabels } from '@/features/tasks/queries';
export function activityText(n: NotificationRow, taskTitle: string) {
  const actor = n.actor_name || 'A project member';
  switch (n.kind) {
    case 'discussion_added':
      return `${actor} posted in Project Discussion.`;
    case 'task_assigned':
      return `You were assigned ${taskTitle}.`;
    case 'task_completed':
      return `${actor} completed ${taskTitle}.`;
    case 'task_status_changed':
      return `${actor} changed ${taskTitle} to ${n.task_status ? statusLabels[n.task_status] : 'a new status'}.`;
    case 'comment_added':
      return `${actor} commented on ${taskTitle}.`;
    case 'deadline_changed':
      return `${actor} ${n.deadline_at ? 'changed' : 'removed'} the deadline for ${taskTitle}.${n.deadline_at ? ` Due ${new Date(n.deadline_at).toLocaleString()}.` : ''}`;
    case 'deadline_approaching':
      return `${taskTitle} has a deadline reminder: ${n.deadline_at ? new Date(n.deadline_at).toLocaleString() : ''}.`;
  }
}
export function notificationHref(
  n: Pick<NotificationRow, 'kind' | 'project_id' | 'task_id'>,
) {
  return n.kind === 'discussion_added'
    ? `/projects/${n.project_id}/overview#project-discussion`
    : n.task_id
      ? `/projects/${n.project_id}/tasks/${n.task_id}`
      : `/projects/${n.project_id}/overview`;
}
