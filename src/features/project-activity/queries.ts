import { dataClient, result } from '@/lib/data-client';
import type { ProjectActivityRow } from '@/types/database';
export async function loadProjectActivity(projectId: string, limit = 20) {
  const db = dataClient();
  result(
    await db.from('projects').select('id').eq('id', projectId).maybeSingle(),
  );
  // Fetch one sentinel beyond the visible prefix. Keyset batching avoids
  // duplicate rows if activity arrives while reading more than one API page.
  const rows: ProjectActivityRow[] = [];
  while (rows.length <= limit) {
    const size = Math.min(500, limit + 1 - rows.length);
    let query = db
      .from('project_activities')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });
    const last = rows.at(-1);
    if (last)
      query = query.or(
        `created_at.lt.${last.created_at},and(created_at.eq.${last.created_at},id.lt.${last.id})`,
      );
    const next = result(await query.range(0, size - 1));
    rows.push(...next);
    if (next.length < size) break;
  }
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}
