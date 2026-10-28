import type { TaskRow } from '@/types/database';
import type { Filters } from './filter-state';
export function filterTasks(tasks: TaskRow[], filters: Filters) {
  const priority = { high: 0, normal: 1, low: 2 };
  return tasks
    .filter(
      (t) =>
        t.title.toLowerCase().includes(filters.search.toLowerCase()) &&
        (filters.status === 'all' || t.status === filters.status) &&
        (filters.priority === 'all' || t.priority === filters.priority) &&
        (filters.person === 'all' ||
          (t.assignee_id ?? 'unassigned') === filters.person) &&
        (filters.project === 'all' || t.project_id === filters.project),
    )
    .sort((a, b) => {
      let order = 0;
      if (filters.sort === 'title') order = a.title.localeCompare(b.title);
      else if (filters.sort === 'priority')
        order = priority[a.priority] - priority[b.priority];
      else if (filters.sort === 'position') order = a.position - b.position;
      else
        order =
          (a.due_at ? Date.parse(a.due_at) : Infinity) -
          (b.due_at ? Date.parse(b.due_at) : Infinity);
      return (
        (Number.isNaN(order) ? 0 : order) ||
        a.position - b.position ||
        a.id.localeCompare(b.id)
      );
    });
}
