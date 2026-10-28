// Tests alone use these fixtures; runtime components never import mock data.
import { beforeEach, vi } from 'vitest';
import {
  projects as legacyProjects,
  people,
} from '@/features/projects/mock-data';
import { tasks as legacyTasks } from '@/features/tasks/mock-data';
import { testSession } from './auth-fixtures';
import type {
  CommentRow,
  ProjectActivityRow,
  ProjectDiscussionRow,
  BusyEventRow,
  BusyOccurrence,
  BusyPeriod,
  ProjectBundle,
  ProjectRow,
  TaskRow,
  SectionRow,
  Member,
  StepRow,
  ResourceRow,
  SlotRow,
} from '@/types/database';
const now = '2026-10-26T00:00:00Z';
const uid = testSession.user.id;
const personId = (id: string | null) => (id === 'alex' ? uid : id);
export let testProjects: ProjectRow[] = [];
export let testTasks: TaskRow[] = [];
export let testSections: SectionRow[] = [];
export let testMembers: Member[] = [];
export let testSteps: StepRow[] = [];
export let testResources: ResourceRow[] = [];
export let testSlots: SlotRow[] = [];
const copy = <T>(v: T): T => structuredClone(v);
export let testBusyEvents: BusyEventRow[] = [];
export let testBusyOccurrences: BusyOccurrence[] = [];
export let testTeamBusy: BusyPeriod[] = [];
export let testComments: CommentRow[] = [];
export let testProjectActivities: ProjectActivityRow[] = [];
export let testDiscussion: ProjectDiscussionRow[] = [];
vi.mock('@/features/project-activity/queries', () => ({
  loadProjectActivity: vi.fn(async (projectId: string, limit = 20) => {
    const rows = copy(
      testProjectActivities.filter((a) => a.project_id === projectId),
    ).sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
    );
    return { items: rows.slice(0, limit), hasMore: rows.length > limit };
  }),
}));
vi.mock('@/features/project-discussion/queries', () => ({
  loadDiscussion: vi.fn(async (projectId: string) =>
    copy(
      testDiscussion
        .filter((c) => c.project_id === projectId)
        .sort(
          (a, b) =>
            a.created_at.localeCompare(b.created_at) ||
            a.id.localeCompare(b.id),
        ),
    ),
  ),
  addDiscussionComment: vi.fn(async (projectId: string, body: string) => {
    const row = {
      id: crypto.randomUUID(),
      project_id: projectId,
      author_id: uid,
      author_name: 'Test User',
      body,
      created_at: new Date().toISOString(),
    };
    testDiscussion.push(row);
    return copy(row);
  }),
  deleteDiscussionComment: vi.fn(
    async (projectId: string, id: string, userId: string) => {
      testDiscussion = testDiscussion.filter(
        (c) =>
          c.project_id !== projectId || c.id !== id || c.author_id !== userId,
      );
    },
  ),
}));
export let testNotifications: import('@/features/notifications/queries').InboxItem[] =
  [];
vi.mock('@/features/comments/queries', () => ({
  loadComments: vi.fn(async (projectId: string, taskId: string) =>
    copy(
      testComments.filter(
        (c) => c.project_id === projectId && c.task_id === taskId,
      ),
    ),
  ),
  addComment: vi.fn(async (projectId: string, taskId: string, body: string) => {
    const row = {
      id: crypto.randomUUID(),
      project_id: projectId,
      task_id: taskId,
      body,
      author_id: uid,
      author_name: 'Test User',
      created_at: new Date().toISOString(),
    };
    testComments.push(row);
    return copy(row);
  }),
  deleteComment: vi.fn(
    async (_p: string, _t: string, id: string, userId: string) => {
      testComments = testComments.filter(
        (c) => c.id !== id || c.author_id !== userId,
      );
    },
  ),
}));
vi.mock('@/features/notifications/queries', () => ({
  loadInbox: vi.fn(async () => copy(testNotifications)),
  markNotificationRead: vi.fn(async (userId: string, id: string) => {
    const n = testNotifications.find(
      (n) => n.user_id === userId && n.id === id,
    );
    if (n) n.read_at = new Date().toISOString();
  }),
}));
vi.mock('@/features/calendar/queries', async () => ({
  ...(await vi.importActual<typeof import('@/features/calendar/queries')>(
    '@/features/calendar/queries',
  )),
  loadPersonalCalendar: vi.fn(async () =>
    copy({ events: testBusyEvents, occurrences: testBusyOccurrences }),
  ),
  loadTeamBusy: vi.fn(async () => copy(testTeamBusy)),
  saveBusyEvent: vi.fn(async () => {}),
  deleteBusyEvent: vi.fn(async () => {}),
}));
export function resetData() {
  testProjectActivities = [];
  testDiscussion = [];
  testComments = [];
  testNotifications = [];
  testBusyEvents = [];
  testBusyOccurrences = [];
  testTeamBusy = [];
  testProjects = legacyProjects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    due_date: p.due,
    created_by: uid,
    created_at: now,
  }));
  testSections = [
    ...new Set(legacyTasks.map((t) => `${t.projectId}:${t.section}`)),
  ].map((id, i) => ({
    id,
    project_id: id.split(':')[0],
    name: id.split(':')[1],
    position: i,
    created_at: now,
  }));
  testTasks = legacyTasks.map((t, i) => ({
    id: t.id,
    project_id: t.projectId,
    section_id: `${t.projectId}:${t.section}`,
    title: t.title,
    description: t.description,
    guidance: t.guidance,
    status: t.status,
    priority: 'normal',
    assignee_id: personId(t.assignee),
    due_at: t.due,
    position: i,
    created_at: now,
  }));
  testMembers = legacyProjects.flatMap((p) =>
    p.members.map((id) => ({
      project_id: p.id,
      user_id: personId(id)!,
      display_name: people.find((n) => n.id === id)!.name,
      role: id === 'alex' ? ('leader' as const) : ('member' as const),
      created_at: now,
    })),
  );
  testSteps = [
    {
      id: 'step-1',
      project_id: 'website',
      task_id: 'user-flows',
      title: 'Draft the journeys',
      position: 0,
      is_completed: false,
      created_at: now,
    },
  ];
  testResources = [];
  testSlots = [];
}
export function bundle(id: string): ProjectBundle {
  const project = testProjects.find((p) => p.id === id);
  if (!project) throw new Error('Project unavailable');
  return copy({
    project,
    sections: testSections.filter((s) => s.project_id === id),
    tasks: testTasks.filter((t) => t.project_id === id),
    members: testMembers.filter((m) => m.project_id === id),
  });
}
beforeEach(() => {
  resetData();
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
});
vi.mock('@/features/projects/queries', () => ({
  loadCatalog: vi.fn(async () =>
    copy({
      projects: testProjects,
      memberships: testMembers.filter((m) => m.user_id === uid),
      profile: {
        id: uid,
        email: testSession.user.email!,
        display_name: 'Test User',
        created_at: now,
      },
    }),
  ),
  createProject: vi.fn(
    async (values: Pick<ProjectRow, 'name' | 'description' | 'due_date'>) => {
      const id = crypto.randomUUID();
      testProjects.push({ ...values, id, created_by: uid, created_at: now });
      testMembers.push({
        project_id: id,
        user_id: uid,
        role: 'leader',
        display_name: 'Test User',
        created_at: now,
      });
      return id;
    },
  ),
  updateProject: vi.fn(async (id: string, values: Partial<ProjectRow>) => {
    const p = testProjects.find((p) => p.id === id)!;
    Object.assign(p, values);
    return copy(p);
  }),
  deleteProject: vi.fn(async (id: string) => {
    testProjects = testProjects.filter((p) => p.id !== id);
  }),
  updateDisplayName: vi.fn(async () => {}),
}));
vi.mock('@/features/tasks/queries', async () => ({
  ...(await vi.importActual<typeof import('@/features/tasks/queries')>(
    '@/features/tasks/queries',
  )),
  loadProject: vi.fn(async (id: string) => bundle(id)),
  loadMyTasks: vi.fn(async (userId: string) =>
    copy(testTasks.filter((t) => t.assignee_id === userId)),
  ),
  loadTaskChildren: vi.fn(async (projectId: string, taskId: string) =>
    copy({
      steps: testSteps.filter(
        (s) => s.project_id === projectId && s.task_id === taskId,
      ),
      resources: testResources.filter(
        (r) => r.project_id === projectId && r.task_id === taskId,
      ),
    }),
  ),
  saveTask: vi.fn(
    async (projectId: string, values: Partial<TaskRow>, id?: string) => {
      if (id) {
        const task = testTasks.find(
          (t) => t.id === id && t.project_id === projectId,
        )!;
        Object.assign(task, values);
        return copy(task);
      }
      const task = {
        id: crypto.randomUUID(),
        project_id: projectId,
        created_at: now,
        ...values,
      } as TaskRow;
      testTasks.push(task);
      return copy(task);
    },
  ),
  deleteTask: vi.fn(async (projectId: string, id: string) => {
    testTasks = testTasks.filter(
      (t) => t.id !== id || t.project_id !== projectId,
    );
  }),
  saveSection: vi.fn(
    async (
      projectId: string,
      values: Pick<SectionRow, 'name' | 'position'>,
      id?: string,
    ) => {
      const s = testSections.find((s) => s.id === id);
      if (s) Object.assign(s, values);
      else
        testSections.push({
          ...values,
          id: crypto.randomUUID(),
          project_id: projectId,
          created_at: now,
        });
    },
  ),
  deleteSection: vi.fn(async (projectId: string, id: string) => {
    testSections = testSections.filter((s) => s.id !== id);
    testTasks = testTasks.filter(
      (t) => t.project_id !== projectId || t.section_id !== id,
    );
  }),
  reorderSections: vi.fn(async (_pid: string, ids: string[]) => {
    ids.forEach((id, i) => {
      testSections.find((s) => s.id === id)!.position = i;
    });
    testSections.sort((a, b) => a.position - b.position);
  }),
  saveStep: vi.fn(
    async (
      projectId: string,
      taskId: string,
      values: Partial<StepRow>,
      id?: string,
    ) => {
      const s = testSteps.find((s) => s.id === id);
      if (s) Object.assign(s, values);
      else
        testSteps.push({
          id: crypto.randomUUID(),
          project_id: projectId,
          task_id: taskId,
          created_at: now,
          ...values,
        } as StepRow);
    },
  ),
  deleteStep: vi.fn(async (_p: string, _t: string, id: string) => {
    testSteps = testSteps.filter((s) => s.id !== id);
  }),
  saveResource: vi.fn(
    async (
      projectId: string,
      taskId: string,
      values: Partial<ResourceRow>,
      id?: string,
    ) => {
      const r = testResources.find((r) => r.id === id);
      if (r) Object.assign(r, values);
      else
        testResources.push({
          id: crypto.randomUUID(),
          project_id: projectId,
          task_id: taskId,
          created_at: now,
          ...values,
        } as ResourceRow);
    },
  ),
  deleteResource: vi.fn(async (_p: string, _t: string, id: string) => {
    testResources = testResources.filter((r) => r.id !== id);
  }),
}));
vi.mock('@/features/members/queries', () => ({
  loadMembers: vi.fn(async (id: string) =>
    copy(testMembers.filter((m) => m.project_id === id)),
  ),
  addMember: vi.fn(async () => {}),
  removeMember: vi.fn(async (projectId: string, userId: string) => {
    testMembers = testMembers.filter(
      (m) => m.project_id !== projectId || m.user_id !== userId,
    );
    testTasks.forEach((t) => {
      if (t.project_id === projectId && t.assignee_id === userId)
        t.assignee_id = null;
    });
  }),
}));
vi.mock('@/features/availability/queries', async () => ({
  ...(await vi.importActual<typeof import('@/features/availability/queries')>(
    '@/features/availability/queries',
  )),
  loadSlots: vi.fn(async (projectId: string, start: string, end: string) =>
    copy(
      testSlots.filter(
        (s) =>
          s.project_id === projectId && s.starts_at < end && s.ends_at > start,
      ),
    ),
  ),
  saveSlot: vi.fn(
    async (
      projectId: string,
      userId: string,
      start: string,
      end: string,
      id?: string,
    ) => {
      const s = testSlots.find((s) => s.id === id);
      if (s) {
        s.starts_at = start;
        s.ends_at = end;
      } else
        testSlots.push({
          id: crypto.randomUUID(),
          project_id: projectId,
          user_id: userId,
          starts_at: start,
          ends_at: end,
          created_at: now,
        });
    },
  ),
  deleteSlot: vi.fn(async (_p: string, _u: string, id: string) => {
    testSlots = testSlots.filter((s) => s.id !== id);
  }),
}));
