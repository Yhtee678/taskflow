import { createContext } from 'react';
import type { Project } from '@/types/domain';

export const SelectedProjectContext = createContext<Project | null>(null);
