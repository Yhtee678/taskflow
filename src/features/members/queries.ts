import { dataClient, allRows, dataError } from '@/lib/data-client';
import type { Member } from '@/types/database';
export async function loadMembers(projectId: string): Promise<Member[]> {
  const db = dataClient();
  const [members, names] = await Promise.all([
    allRows((a, b) =>
      db
        .from('project_members')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at')
        .order('user_id')
        .range(a, b),
    ),
    allRows((a, b) =>
      db
        .rpc('get_project_member_display', { p_project_id: projectId })
        .order('user_id')
        .range(a, b),
    ),
  ]);
  const display = names;
  return members.map((m) => ({
    ...m,
    display_name:
      display.find((n) => n.user_id === m.user_id)?.display_name ||
      'Unnamed member',
  }));
}
export async function addMember(projectId: string, email: string) {
  const { error } = await dataClient().rpc('add_project_member_by_email', {
    p_project_id: projectId,
    p_email: email,
  });
  if (error) throw dataError(error);
}
export async function removeMember(projectId: string, userId: string) {
  const { error } = await dataClient().rpc('remove_project_member', {
    p_project_id: projectId,
    p_user_id: userId,
  });
  if (error) throw dataError(error);
}
