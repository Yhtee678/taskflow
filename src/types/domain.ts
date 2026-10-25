export type Status = 'todo' | 'in_progress' | 'done';
export interface Project {
  id: string;
  name: string;
  description: string;
  due: string;
  members: string[];
}
export interface Task {
  id: string;
  projectId: string;
  section: string;
  title: string;
  assignee: string | null;
  status: Status;
  due: string | null;
  description: string;
  guidance: string;
}
