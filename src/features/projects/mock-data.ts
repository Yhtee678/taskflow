import type { Project } from '@/types/domain';
export const currentUser = 'alex';
export const people = [
  { id: 'alex', name: 'Alex Tan', initials: 'AT' },
  { id: 'brandon', name: 'Brandon Lee', initials: 'BL' },
  { id: 'cheryl', name: 'Cheryl Lim', initials: 'CL' },
];
export const projects: Project[] = [
  {
    id: 'website',
    name: 'Website Redesign',
    description:
      'A clearer, more accessible website for our student community.',
    due: '2026-11-13',
    members: ['alex', 'brandon', 'cheryl'],
  },
  {
    id: 'research',
    name: 'Research Project',
    description: 'Understand how students organize collaborative assignments.',
    due: '2026-11-20',
    members: ['alex', 'cheryl'],
  },
];
