import { createContext } from 'react';
import type { ProjectRow } from '@/types/database';

export const SelectedProjectContext = createContext<ProjectRow | null>(null);
