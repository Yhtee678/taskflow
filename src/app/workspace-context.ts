import { createContext, useContext } from 'react';
import type { loadCatalog } from '@/features/projects/queries';
import type { Remote } from './use-remote';
import type { Filters } from '@/features/tasks/filter-state';
export interface WorkspaceState {
  catalog: Remote<Awaited<ReturnType<typeof loadCatalog>>>;
  revision: number;
  pending: boolean;
  feedback: { message: string; error: boolean } | null;
  refresh: () => void;
  dismissFeedback: () => void;
  myTasksFilters: Filters;
  setMyTasksFilters: (filters: Filters) => void;
  mutate: (work: () => Promise<unknown>, message: string) => Promise<boolean>;
}
export const WorkspaceContext = createContext<WorkspaceState | null>(null);
export function useWorkspace() {
  const v = useContext(WorkspaceContext);
  if (!v) throw new Error('Workspace provider is missing.');
  return v;
}
