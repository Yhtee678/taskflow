import { people, projects } from '@/features/projects/mock-data';
import { statusLabels } from './mock-data';
export function TaskFilters({
  status,
  setStatus,
  person,
  setPerson,
  project,
  setProject,
  search,
  setSearch,
}: {
  status: string;
  setStatus: (v: string) => void;
  person?: string;
  setPerson?: (v: string) => void;
  project?: string;
  setProject?: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
}) {
  return (
    <div className="toolbar">
      <input
        aria-label="Search tasks"
        type="search"
        placeholder="Search tasks…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select
        aria-label="Filter by status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option value="all">All statuses</option>
        {Object.entries(statusLabels).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      {setPerson && (
        <select
          aria-label="Filter by assignee"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
        >
          <option value="all">All assignees</option>
          <option value="unassigned">Unassigned</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      {setProject && (
        <select
          aria-label="Filter by project"
          value={project}
          onChange={(e) => setProject(e.target.value)}
        >
          <option value="all">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
