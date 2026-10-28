import {
  dataClient,
  result,
  allRows,
  changed,
  dataError,
} from '@/lib/data-client';
import type { ProjectRow } from '@/types/database';
export async function loadCatalog(userId: string) {
  const db = dataClient();
  const [projects, memberships, profiles] = await Promise.all([
    allRows((a, b) =>
      db
        .from('projects')
        .select('*')
        .order('created_at')
        .order('id')
        .range(a, b),
    ),
    allRows((a, b) =>
      db
        .from('project_members')
        .select('*')
        .eq('user_id', userId)
        .order('project_id')
        .range(a, b),
    ),
    db.from('profiles').select('*').eq('id', userId).single(),
  ]);
  return { projects, memberships, profile: result(profiles) };
}
export async function createProject(
  values: Pick<ProjectRow, 'name' | 'description' | 'due_date'>,
) {
  return result(
    await dataClient().rpc('create_project', {
      p_name: values.name,
      p_description: values.description,
      p_due_date: values.due_date,
    }),
  );
}
export async function updateProject(
  id: string,
  values: Pick<ProjectRow, 'name' | 'description' | 'due_date'>,
) {
  return changed(
    await dataClient().from('projects').update(values).eq('id', id).select(),
  );
}
export async function deleteProject(id: string) {
  const { error } = await dataClient().rpc('delete_project', {
    p_project_id: id,
  });
  if (error) throw dataError(error);
}
export async function updateDisplayName(id: string, display_name: string) {
  return changed(
    await dataClient()
      .from('profiles')
      .update({ display_name })
      .eq('id', id)
      .select(),
  );
}
