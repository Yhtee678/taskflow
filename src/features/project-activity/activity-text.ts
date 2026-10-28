import type { ProjectActivityRow } from '@/types/database';
import { statusLabels } from '@/features/tasks/queries';
// Compact presentation for My Tasks; the full history keeps its original text.
export function projectActivityPreviewAction(a: ProjectActivityRow) {
  const actor = a.actor_name || 'A project member';
  switch (a.kind) {
    case 'task_created':
      return `${actor} created a task${a.assignee_name ? ` and assigned it to ${a.assignee_name}` : ''}`;
    case 'task_assigned':
      return `${actor} assigned a task${a.assignee_name ? ` to ${a.assignee_name}` : ''}`;
    case 'task_reassigned':
      return `${actor} reassigned a task${a.assignee_name ? ` to ${a.assignee_name}` : ''}`;
    case 'task_completed':
      return `${actor} completed a task`;
    case 'task_status_changed':
      return `${actor} moved a task to ${a.task_status ? statusLabels[a.task_status] : 'a new status'}`;
    case 'deadline_changed':
      return `${actor} ${a.deadline_at ? 'updated' : 'removed'} a task deadline`;
    case 'comment_added':
      return `${actor} commented on a task`;
    case 'discussion_added':
      return `${actor} posted in Project Discussion`;
  }
}
export function activityPreviewTime(value: string, now = new Date()) {
  const date = new Date(value);
  const time = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  if (date.toDateString() === now.toDateString()) return time;
  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  );
  if (date.toDateString() === yesterday.toDateString())
    return `Yesterday · ${time}`;
  return `${date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear()
      ? { year: 'numeric' as const }
      : {}),
  })} · ${time}`;
}
export function projectActivityText(a: ProjectActivityRow) {
  const actor = a.actor_name || 'A project member',
    task = `“${a.task_title}”`;
  switch (a.kind) {
    case 'task_created':
      return `${actor} created ${task}${a.assignee_name ? ` and assigned it to ${a.assignee_name}` : ''}.`;
    case 'task_assigned':
      return `${actor} assigned ${task}${a.assignee_name ? ` to ${a.assignee_name}` : ''}.`;
    case 'task_reassigned':
      return `${actor} reassigned ${task}${a.assignee_name ? ` to ${a.assignee_name}` : ''}.`;
    case 'task_completed':
      return `${actor} completed ${task}.`;
    case 'task_status_changed':
      return `${actor} moved ${task} to ${a.task_status ? statusLabels[a.task_status] : 'a new status'}.`;
    case 'deadline_changed':
      return `${actor} ${a.deadline_at ? 'updated' : 'removed'} the deadline for ${task}.`;
    case 'comment_added':
      return `${actor} commented on ${task}.`;
    case 'discussion_added':
      return `${actor} posted in Project Discussion.`;
  }
}
