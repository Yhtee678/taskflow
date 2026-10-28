import type { Member } from '@/types/database';
import { useWorkspace } from '@/app/workspace-context';
import { statusLabels, priorityLabels } from './queries';
import type { Filters } from './filter-state';
export function TaskFilters({
  value,
  onChange,
  members,
  global = false,
}: {
  value: Filters;
  onChange: (v: Filters) => void;
  members?: Member[];
  global?: boolean;
}) {
  const { catalog } = useWorkspace();
  const set = (key: keyof Filters, v: string) =>
    onChange({ ...value, [key]: v });
  return (
    <div className="toolbar task-filters">
      <input
        type="search"
        aria-label="Search tasks"
        placeholder="Search tasks…"
        value={value.search}
        onChange={(e) => set('search', e.target.value)}
      />
      <select
        aria-label="Filter by status"
        value={value.status}
        onChange={(e) => set('status', e.target.value)}
      >
        <option value="all">All statuses</option>
        {Object.entries(statusLabels).map(([id, label]) => (
          <option value={id} key={id}>
            {label}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by priority"
        value={value.priority}
        onChange={(e) => set('priority', e.target.value)}
      >
        <option value="all">All priorities</option>
        {Object.entries(priorityLabels).map(([id, label]) => (
          <option value={id} key={id}>
            {label}
          </option>
        ))}
      </select>
      {members && (
        <select
          aria-label="Filter by assignee"
          value={value.person}
          onChange={(e) => set('person', e.target.value)}
        >
          <option value="all">All assignees</option>
          <option value="unassigned">Unassigned</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.display_name}
            </option>
          ))}
        </select>
      )}
      {global && (
        <select
          aria-label="Filter by project"
          value={value.project}
          onChange={(e) => set('project', e.target.value)}
        >
          <option value="all">All projects</option>
          {catalog.data!.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      <select
        aria-label="Sort tasks"
        value={value.sort}
        onChange={(e) => set('sort', e.target.value)}
      >
        <option value="due">Deadline</option>
        <option value="priority">Priority</option>
        <option value="title">Title</option>
        <option value="position">Section order</option>
      </select>
    </div>
  );
}
