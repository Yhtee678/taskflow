import {
  dataClient,
  result,
  changed,
  allRows,
  AccessError,
  dataError,
} from '@/lib/data-client';
import { loadMembers } from '@/features/members/queries';
import type {
  Database,
  ProjectBundle,
  TaskRow,
  SectionRow,
  StepRow,
  ResourceRow,
} from '@/types/database';
type Insert<K extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][K]['Insert'];
const taskColumns =
  'id,project_id,section_id,title,description,guidance,status,priority,assignee_id,due_at,position,created_at' as const;
export async function loadProject(projectId: string): Promise<ProjectBundle> {
  const db = dataClient();
  const project = result(
    await db.from('projects').select('*').eq('id', projectId).maybeSingle(),
  );
  const [sections, tasks, members] = await Promise.all([
    allRows((a, b) =>
      db
        .from('sections')
        .select('*')
        .eq('project_id', projectId)
        .order('position')
        .order('id')
        .range(a, b),
    ),
    allRows((a, b) =>
      db
        .from('tasks')
        .select(taskColumns)
        .eq('project_id', projectId)
        .order('position')
        .order('id')
        .range(a, b),
    ),
    loadMembers(projectId),
  ]);
  if (!members.length) throw new AccessError();
  return { project, sections, tasks, members };
}
export async function loadMyTasks(userId: string) {
  const [tasks, sections] = await Promise.all([
    allRows((a, b) =>
      dataClient()
        .from('tasks')
        .select(taskColumns)
        .eq('assignee_id', userId)
        .order('due_at', { nullsFirst: false })
        .order('id')
        .range(a, b),
    ),
    allRows((a, b) =>
      dataClient().from('sections').select('id,name').order('id').range(a, b),
    ),
  ]);
  return tasks.map((task) => ({
    ...task,
    section_name:
      sections.find((s) => s.id === task.section_id)?.name ??
      'Section unavailable',
  }));
}
export async function saveSection(
  projectId: string,
  values: Pick<SectionRow, 'name' | 'position'>,
  id?: string,
) {
  const db = dataClient();
  return id
    ? changed(
        await db
          .from('sections')
          .update(values)
          .eq('project_id', projectId)
          .eq('id', id)
          .select(),
      )
    : changed(
        await db
          .from('sections')
          .insert({ ...values, project_id: projectId })
          .select(),
      );
}
export async function deleteSection(projectId: string, id: string) {
  return changed(
    await dataClient()
      .from('sections')
      .delete()
      .eq('project_id', projectId)
      .eq('id', id)
      .select(),
  );
}
export async function reorderSections(projectId: string, ids: string[]) {
  const { error } = await dataClient().rpc('reorder_sections', {
    p_project_id: projectId,
    p_ids: ids,
  });
  if (error) throw dataError(error);
}
export function saveTask(
  projectId: string,
  values: Pick<TaskRow, 'status'>,
  id: string,
): Promise<TaskRow>;
export function saveTask(
  projectId: string,
  values: Omit<Insert<'tasks'>, 'project_id'>,
  id?: string,
): Promise<TaskRow>;
export async function saveTask(
  projectId: string,
  values: Omit<Insert<'tasks'>, 'project_id'> | Pick<TaskRow, 'status'>,
  id?: string,
) {
  const db = dataClient();
  if (id)
    return changed(
      await db
        .from('tasks')
        .update(values)
        .eq('project_id', projectId)
        .eq('id', id)
        .select(),
    );
  if (!('title' in values) || !('section_id' in values))
    throw new Error('A new task requires a title and section.');
  return changed(
    await db
      .from('tasks')
      .insert({ ...values, project_id: projectId })
      .select(),
  );
}
export async function deleteTask(projectId: string, id: string) {
  return changed(
    await dataClient()
      .from('tasks')
      .delete()
      .eq('project_id', projectId)
      .eq('id', id)
      .select(),
  );
}
export async function loadTaskChildren(projectId: string, taskId: string) {
  const db = dataClient();
  const parent = result(
    await db
      .from('tasks')
      .select('id')
      .eq('project_id', projectId)
      .eq('id', taskId)
      .maybeSingle(),
  );
  if (!parent) throw new AccessError();
  const [steps, resources] = await Promise.all([
    allRows((a, b) =>
      db
        .from('task_steps')
        .select('*')
        .eq('project_id', projectId)
        .eq('task_id', taskId)
        .order('position')
        .order('id')
        .range(a, b),
    ),
    allRows((a, b) =>
      db
        .from('task_resources')
        .select('*')
        .eq('project_id', projectId)
        .eq('task_id', taskId)
        .order('position')
        .order('id')
        .range(a, b),
    ),
  ]);
  return { steps, resources };
}
export async function saveStep(
  projectId: string,
  taskId: string,
  values: Pick<StepRow, 'title' | 'is_completed' | 'position'>,
  id?: string,
) {
  const db = dataClient();
  return id
    ? changed(
        await db
          .from('task_steps')
          .update(values)
          .eq('project_id', projectId)
          .eq('task_id', taskId)
          .eq('id', id)
          .select(),
      )
    : changed(
        await db
          .from('task_steps')
          .insert({ ...values, project_id: projectId, task_id: taskId })
          .select(),
      );
}
export async function deleteStep(
  projectId: string,
  taskId: string,
  id: string,
) {
  return changed(
    await dataClient()
      .from('task_steps')
      .delete()
      .eq('project_id', projectId)
      .eq('task_id', taskId)
      .eq('id', id)
      .select(),
  );
}
export async function saveResource(
  projectId: string,
  taskId: string,
  values: Pick<ResourceRow, 'title' | 'url' | 'description' | 'position'>,
  id?: string,
) {
  const db = dataClient();
  return id
    ? changed(
        await db
          .from('task_resources')
          .update(values)
          .eq('project_id', projectId)
          .eq('task_id', taskId)
          .eq('id', id)
          .select(),
      )
    : changed(
        await db
          .from('task_resources')
          .insert({ ...values, project_id: projectId, task_id: taskId })
          .select(),
      );
}
export async function deleteResource(
  projectId: string,
  taskId: string,
  id: string,
) {
  return changed(
    await dataClient()
      .from('task_resources')
      .delete()
      .eq('project_id', projectId)
      .eq('task_id', taskId)
      .eq('id', id)
      .select(),
  );
}
export const statusLabels: Record<TaskRow['status'], string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};
export const priorityLabels: Record<TaskRow['priority'], string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
};
