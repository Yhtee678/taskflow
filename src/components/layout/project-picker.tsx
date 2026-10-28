import type { ProjectRow } from '@/types/database';
export function ProjectPicker({
  id,
  label,
  selected,
  projects,
  onChange,
}: {
  id: string;
  label: string;
  selected: ProjectRow | null;
  projects: ProjectRow[];
  onChange: (id: string) => void;
}) {
  return (
    <div className="project-picker">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        title={selected?.name}
        value={selected?.id ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {!selected && <option value="">Select a project</option>}
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {selected && selected.name.length > 24 && (
        <span className="selected-project-name">{selected.name}</span>
      )}
    </div>
  );
}
