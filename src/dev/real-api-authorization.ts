/** Manually import in Vite dev tools. Never imported by the application/router. */
import { getSupabaseClient } from '@/lib/supabase';
import {
  evaluate,
  isUuid,
  validatePeer,
  type ApiResponse,
  type Evidence,
  type Expected,
  type FixtureDescriptor,
} from './api-authorization-checks';

type Row = Record<string, unknown>;
const rows = (data: unknown): Row[] =>
  Array.isArray(data) ? (data as Row[]) : [];
const nameFor = (run: string, actor: string) =>
  `[TaskFlow Phase2 API] ${run} ${actor}`;
function devOnly() {
  if (
    !import.meta.env.DEV ||
    !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
  ) {
    throw new Error(
      'Authorization harness is available only on a loopback Vite development server.',
    );
  }
}

export async function openAuthorizationHarness(options: {
  runId: string;
  actor: 'A' | 'B';
  expectedProjectRef: string;
}) {
  devOnly();
  if (
    !isUuid(options.runId) ||
    !['A', 'B'].includes(options.actor) ||
    !/^[a-z0-9]{10,40}$/.test(options.expectedProjectRef)
  ) {
    throw new Error(
      'Supply a UUID runId, actor A/B, and the independently confirmed taskflow-test project reference.',
    );
  }
  const configuredUrl = new URL(
    import.meta.env.VITE_SUPABASE_URL ?? 'http://invalid.local',
  );
  if (
    configuredUrl.origin !== `https://${options.expectedProjectRef}.supabase.co`
  ) {
    throw new Error(
      'Configured Supabase URL does not match the explicitly selected test project. No test requests sent.',
    );
  }
  const client = getSupabaseClient();
  // SDK attaches its current session. Never read getSession(), tokens, storage,
  // Authorization headers, raw errors, or the service-role/admin APIs here.
  async function verifiedIdentity() {
    devOnly();
    try {
      const { data, error } = await client.auth.getUser();
      if (
        error ||
        !data.user ||
        !data.user.email ||
        data.user.app_metadata.provider !== 'google'
      ) {
        throw new Error('identity');
      }
      return { id: data.user.id, email: data.user.email };
    } catch {
      throw new Error(
        'A live Google session is required. Sign in through the application and reopen the harness.',
      );
    }
  }
  const identity = await verifiedIdentity();
  const { runId, actor, expectedProjectRef: projectRef } = options;
  const projectName = nameFor(runId, actor);
  const taskTitle = `${projectName} task`;
  const evidence: Evidence[] = [];
  const phases = new Set<string>();
  let fixture: FixtureDescriptor | undefined;
  let createdProjectId: string | undefined;
  let failed = false;
  let busy = false;
  let peerId: string | undefined;

  async function check(
    checkName: string,
    request: PromiseLike<ApiResponse>,
    expected: Expected = 'success',
    predicate: (data: unknown) => boolean = () => true,
  ) {
    let response: ApiResponse;
    try {
      response = await request;
    } catch {
      response = { status: 0, error: { code: 'TRANSPORT_ERROR' }, data: null };
    }
    const entry = evaluate(
      checkName,
      response,
      expected,
      predicate(response.data),
    );
    evidence.push(entry);
    if (entry.result === 'FAIL') {
      failed = true;
      throw new Error(
        `Check failed: ${checkName}. Inspect report() for sanitized status/code/row count; stop and clean up.`,
      );
    }
    return response.data;
  }
  async function action(
    phase: string,
    operation: () => Promise<void>,
    cleanup = false,
  ) {
    devOnly();
    if (busy)
      throw new Error(
        'Wait for the current step; do not run requests concurrently.',
      );
    if (phases.has('cleanup') && !cleanup)
      throw new Error(
        'This run was cleaned up. Start a new UUID run instead of reusing its fixtures.',
      );
    if (failed && !cleanup)
      throw new Error(
        'A check failed. Only cleanup is allowed; use a fresh run for retesting.',
      );
    busy = true;
    try {
      const current = await verifiedIdentity();
      if (current.id !== identity.id || current.email !== identity.email)
        throw new Error(
          'Account changed. Return to the original Google account before continuing or cleanup.',
        );
      await operation();
      phases.add(phase);
      return { phase, result: 'PASS' as const, checks: evidence.length };
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      busy = false;
    }
  }
  function requirePhase(phase: string) {
    if (!phases.has(phase)) throw new Error(`Complete ${phase} first.`);
  }
  function own() {
    if (!fixture)
      throw new Error(
        'Create the fixture first. If setup failed, use cleanupOwnRun().',
      );
    return fixture;
  }
  function peer(value: FixtureDescriptor) {
    const valid = validatePeer(value, own());
    if (peerId && peerId !== valid.userId)
      throw new Error('The peer identity changed during this run.');
    peerId = valid.userId;
    return valid;
  }
  const exactly = (id: string) => (data: unknown) =>
    rows(data).length === 1 && rows(data)[0].id === id;
  const description = `Disposable real-session authorization fixture ${runId}`;
  async function privateProfile(otherUser: string) {
    await check(
      'Peer profile rows (including email) remain private',
      client
        .from('profiles')
        .select('id,email,display_name,created_at')
        .eq('id', otherUser),
      'filtered',
    );
  }

  return {
    // Only explicitly whitelisted IDs/email are shared. No SDK/user/session
    // object can accidentally be serialized through this descriptor.
    descriptor(): FixtureDescriptor {
      return { ...own() };
    },
    report() {
      const required =
        actor === 'A'
          ? [
              'baseline',
              'fixtures',
              'isolation',
              'add-member',
              'verify-member-edit',
              'remove-member',
              'cleanup',
            ]
          : [
              'baseline',
              'fixtures',
              'isolation',
              'member-edit',
              'revocation',
              'cleanup',
            ];
      return {
        runId,
        actor,
        projectRef,
        userId: identity.id,
        complete: !failed && required.every((p) => phases.has(p)),
        failed,
        completedPhases: [...phases],
        missingPhases: required.filter((p) => !phases.has(p)),
        evidence: evidence.map((e) => ({ ...e })),
      };
    },
    baseline() {
      return action('baseline', async () => {
        if (createdProjectId)
          throw new Error('Baseline must precede fixture creation.');
        await check(
          'Auth provisioned exactly one own profile',
          client
            .from('profiles')
            .select('id,email,display_name')
            .eq('id', identity.id),
          'success',
          (data) =>
            exactly(identity.id)(data) &&
            rows(data)[0].email === identity.email.toLowerCase(),
        );
        await check(
          'Fresh-account baseline: no project memberships',
          client
            .from('project_members')
            .select('project_id,user_id,role')
            .eq('user_id', identity.id),
          'filtered',
        );
        // A nonzero baseline is a failed prerequisite, not proof of automatic
        // enrollment. Use accounts with no pre-existing memberships; do not erase them.
      });
    },
    createFixtures() {
      return action('fixtures', async () => {
        requirePhase('baseline');
        if (createdProjectId)
          throw new Error(
            'Fixture creation already attempted. Recover with cleanupOwnRun(); do not create duplicates.',
          );
        const id = await check(
          'Create project through authenticated RPC',
          client.rpc('create_project', {
            p_name: projectName,
            p_description: description,
          }),
          'success',
          isUuid,
        );
        createdProjectId = id as string;
        await check(
          'Created project belongs to actual caller',
          client
            .from('projects')
            .select('id,name,created_by,description')
            .eq('id', createdProjectId),
          'success',
          (data) =>
            exactly(createdProjectId!)(data) &&
            rows(data)[0].created_by === identity.id &&
            rows(data)[0].name === projectName,
        );
        await check(
          'Creator received leader membership',
          client
            .from('project_members')
            .select('user_id,role')
            .eq('project_id', createdProjectId),
          'success',
          (data) =>
            rows(data).length === 1 &&
            rows(data)[0].user_id === identity.id &&
            rows(data)[0].role === 'leader',
        );
        const sectionId = crypto.randomUUID(),
          taskId = crypto.randomUUID();
        await check(
          'Create owned test section',
          client
            .from('sections')
            .insert({
              id: sectionId,
              project_id: createdProjectId,
              name: projectName,
            })
            .select('id'),
          'success',
          exactly(sectionId),
        );
        await check(
          'Create owned test task assigned to caller',
          client
            .from('tasks')
            .insert({
              id: taskId,
              project_id: createdProjectId,
              section_id: sectionId,
              title: taskTitle,
              assignee_id: identity.id,
            })
            .select('id'),
          'success',
          exactly(taskId),
        );
        await check(
          'Create owned test step',
          client
            .from('task_steps')
            .insert({
              project_id: createdProjectId,
              task_id: taskId,
              title: `${projectName} step`,
            })
            .select('id'),
          'success',
          (d) => rows(d).length === 1,
        );
        await check(
          'Create owned test resource',
          client
            .from('task_resources')
            .insert({
              project_id: createdProjectId,
              task_id: taskId,
              title: projectName,
              url: 'https://example.com/taskflow-test',
            })
            .select('id'),
          'success',
          (d) => rows(d).length === 1,
        );
        fixture = {
          runId,
          actor,
          projectRef,
          userId: identity.id,
          email: identity.email,
          projectId: createdProjectId,
          sectionId,
          taskId,
        };
      });
    },
    checkIsolation(value: FixtureDescriptor) {
      return action('isolation', async () => {
        requirePhase('fixtures');
        const other = peer(value);
        const self = own();
        await check(
          'Positive control: own task is visible',
          client.from('tasks').select('id').eq('id', self.taskId),
          'success',
          exactly(self.taskId),
        );
        await check(
          'Peer project SELECT returns 2xx and zero rows',
          client.from('projects').select('id').eq('id', other.projectId),
          'filtered',
        );
        for (const table of [
          'project_members',
          'sections',
          'tasks',
          'task_steps',
          'task_resources',
        ]) {
          await check(
            `${table}: unrelated project SELECT is filtered`,
            client.from(table).select('*').eq('project_id', other.projectId),
            'filtered',
          );
        }
        await privateProfile(other.userId);
        await check(
          'Peer project UPDATE affects zero rows',
          client
            .from('projects')
            .update({ description: `NEGATIVE ${runId}` })
            .eq('id', other.projectId)
            .eq('name', nameFor(runId, other.actor))
            .select('id'),
          'filtered',
        );
        await check(
          'Peer task UPDATE affects zero rows',
          client
            .from('tasks')
            .update({ description: `NEGATIVE ${runId}` })
            .eq('id', other.taskId)
            .eq('project_id', other.projectId)
            .eq('title', `${nameFor(runId, other.actor)} task`)
            .select('id'),
          'filtered',
        );
        await check(
          'Peer section INSERT denied',
          client
            .from('sections')
            .insert({
              id: crypto.randomUUID(),
              project_id: other.projectId,
              name: `NEGATIVE ${runId}`,
            })
            .select('id'),
          'permission',
        );
        await check(
          'Direct self-join denied',
          client
            .from('project_members')
            .insert({
              project_id: other.projectId,
              user_id: identity.id,
              role: 'leader',
            })
            .select('user_id'),
          'permission',
        );
        await check(
          'Non-member cannot add membership by RPC',
          client.rpc('add_project_member_by_email', {
            p_project_id: other.projectId,
            p_email: identity.email,
          }),
          'permission',
        );
        await check(
          'Non-member cannot remove leader by RPC',
          client.rpc('remove_project_member', {
            p_project_id: other.projectId,
            p_user_id: other.userId,
          }),
          'permission',
        );
        await check(
          'Non-member cannot delete peer project by RPC',
          client.rpc('delete_project', { p_project_id: other.projectId }),
          'permission',
        );
        await check(
          'Non-member roster RPC denied',
          client.rpc('get_project_member_display', {
            p_project_id: other.projectId,
          }),
          'permission',
        );
      });
    },
    addMember(value: FixtureDescriptor) {
      return action('add-member', async () => {
        if (actor !== 'A') throw new Error('Only A performs this step.');
        requirePhase('isolation');
        const other = peer(value),
          self = own();
        // Owner rechecks both fixtures after negative probes; zero rows by itself
        // is not sufficient evidence when a target might not exist.
        await check(
          'Owner project untouched by negative probes',
          client
            .from('projects')
            .select('id,description')
            .eq('id', self.projectId),
          'success',
          (d) =>
            exactly(self.projectId)(d) &&
            rows(d)[0].description === description,
        );
        await check(
          'Owner task untouched by negative probes',
          client.from('tasks').select('id,description').eq('id', self.taskId),
          'success',
          (d) => exactly(self.taskId)(d) && rows(d)[0].description === '',
        );
        await check(
          'Leader adds registered peer',
          client.rpc('add_project_member_by_email', {
            p_project_id: self.projectId,
            p_email: other.email,
          }),
        );
        await check(
          'Added peer has member role, never leader',
          client
            .from('project_members')
            .select('user_id,role')
            .eq('project_id', self.projectId)
            .eq('user_id', other.userId),
          'success',
          (d) => rows(d).length === 1 && rows(d)[0].role === 'member',
        );
      });
    },
    exerciseMember(value: FixtureDescriptor) {
      return action('member-edit', async () => {
        if (actor !== 'B') throw new Error('Only B performs this step.');
        requirePhase('isolation');
        const other = peer(value);
        await check(
          'Added member can read A project',
          client.from('projects').select('id').eq('id', other.projectId),
          'success',
          exactly(other.projectId),
        );
        const roster = await check(
          'Member reads minimal teammate roster',
          client.rpc('get_project_member_display', {
            p_project_id: other.projectId,
          }),
          'success',
          (d) =>
            rows(d).length === 2 &&
            rows(d).every(
              (r) =>
                Object.keys(r).sort().join(',') === 'display_name,user_id' &&
                typeof r.display_name === 'string',
            ) &&
            rows(d).some((r) => r.user_id === other.userId) &&
            rows(d).some((r) => r.user_id === identity.id),
        );
        await privateProfile(other.userId);
        await check(
          'Task remains assigned to A before teammate edit',
          client.from('tasks').select('id,assignee_id').eq('id', other.taskId),
          'success',
          (d) =>
            exactly(other.taskId)(d) && rows(d)[0].assignee_id === other.userId,
        );
        await check(
          'Member B edits task assigned to A',
          client
            .from('tasks')
            .update({ guidance: `Member edit ${runId} by B` })
            .eq('project_id', other.projectId)
            .eq('id', other.taskId)
            .select('id'),
          'success',
          exactly(other.taskId),
        );
        await check(
          'Member cannot promote self',
          client
            .from('project_members')
            .update({ role: 'leader' })
            .eq('project_id', other.projectId)
            .eq('user_id', identity.id)
            .select('user_id'),
          'permission',
        );
        await check(
          'Member cannot add membership',
          client.rpc('add_project_member_by_email', {
            p_project_id: other.projectId,
            p_email: identity.email,
          }),
          'permission',
        );
        await check(
          'Member cannot remove leader',
          client.rpc('remove_project_member', {
            p_project_id: other.projectId,
            p_user_id: other.userId,
          }),
          'permission',
        );
        await check(
          'Member cannot delete project',
          client.rpc('delete_project', { p_project_id: other.projectId }),
          'permission',
        );
        await check(
          'Member cannot edit teammate profile',
          client
            .from('profiles')
            // No-op value from the permitted minimal roster: even a broken
            // policy must not replace a real account's display name.
            .update({
              display_name: rows(roster).find((r) => r.user_id === other.userId)
                ?.display_name,
            })
            .eq('id', other.userId)
            .select('id'),
          'filtered',
        );
        await check(
          'Member cannot overwrite Auth-managed profile email',
          client
            .from('profiles')
            .update({ email: identity.email.toLowerCase() })
            .eq('id', identity.id)
            .select('id'),
          'permission',
        );
        const self = own();
        await check(
          'B project survived A negative probes',
          client
            .from('projects')
            .select('id,description')
            .eq('id', self.projectId),
          'success',
          (d) =>
            exactly(self.projectId)(d) &&
            rows(d)[0].description === description,
        );
        await check(
          'B task survived A negative probes',
          client.from('tasks').select('id,description').eq('id', self.taskId),
          'success',
          (d) => exactly(self.taskId)(d) && rows(d)[0].description === '',
        );
      });
    },
    verifyMemberEdit(value: FixtureDescriptor) {
      return action('verify-member-edit', async () => {
        requirePhase('add-member');
        peer(value);
        const self = own();
        await check(
          'A reads B edit through its own session',
          client
            .from('tasks')
            .select('id,guidance,assignee_id')
            .eq('id', self.taskId),
          'success',
          (d) =>
            exactly(self.taskId)(d) &&
            rows(d)[0].guidance === `Member edit ${runId} by B` &&
            rows(d)[0].assignee_id === identity.id,
        );
      });
    },
    removeMember(value: FixtureDescriptor) {
      return action('remove-member', async () => {
        requirePhase('verify-member-edit');
        const other = peer(value),
          self = own();
        await check(
          'Assign disposable task to B before removal',
          client
            .from('tasks')
            .update({ assignee_id: other.userId })
            .eq('project_id', self.projectId)
            .eq('id', self.taskId)
            .select('id'),
          'success',
          exactly(self.taskId),
        );
        await check(
          'Leader removes member by RPC',
          client.rpc('remove_project_member', {
            p_project_id: self.projectId,
            p_user_id: other.userId,
          }),
        );
        await check(
          'Membership is removed',
          client
            .from('project_members')
            .select('user_id')
            .eq('project_id', self.projectId)
            .eq('user_id', other.userId),
          'filtered',
        );
        await check(
          'Removal unassigned task atomically',
          client.from('tasks').select('id,assignee_id').eq('id', self.taskId),
          'success',
          (d) => exactly(self.taskId)(d) && rows(d)[0].assignee_id === null,
        );
        await check(
          'Roster excludes removed peer',
          client.rpc('get_project_member_display', {
            p_project_id: self.projectId,
          }),
          'success',
          (d) => rows(d).length === 1 && rows(d)[0].user_id === identity.id,
        );
      });
    },
    checkRevocation(value: FixtureDescriptor) {
      return action('revocation', async () => {
        requirePhase('member-edit');
        const other = peer(value),
          self = own();
        await check(
          'Positive control: B still accesses its own project',
          client.from('projects').select('id').eq('id', self.projectId),
          'success',
          exactly(self.projectId),
        );
        await check(
          'Removed B cannot read A project',
          client.from('projects').select('id').eq('id', other.projectId),
          'filtered',
        );
        await check(
          'Removed B cannot read formerly edited task',
          client.from('tasks').select('id').eq('id', other.taskId),
          'filtered',
        );
        await check(
          'Removed B cannot edit formerly edited task',
          client
            .from('tasks')
            .update({ guidance: `NEGATIVE revoked ${runId}` })
            .eq('project_id', other.projectId)
            .eq('id', other.taskId)
            .select('id'),
          'filtered',
        );
        await check(
          'Removed B cannot insert into A project',
          client
            .from('sections')
            .insert({
              id: crypto.randomUUID(),
              project_id: other.projectId,
              name: `NEGATIVE revoked ${runId}`,
            })
            .select('id'),
          'permission',
        );
        await check(
          'Removed B cannot read roster',
          client.rpc('get_project_member_display', {
            p_project_id: other.projectId,
          }),
          'permission',
        );
      });
    },
    cleanupOwnRun() {
      return action(
        'cleanup',
        async () => {
          // Works even after refresh, failed setup or a lost create_project response.
          // Exact run name + actual owner + leader role; no broad deletes or peer IDs.
          const candidates = await check(
            'Find only this caller’s exact run projects',
            client
              .from('projects')
              .select('id,name,created_by,description')
              .eq('name', projectName)
              .eq('created_by', identity.id),
          );
          for (const row of rows(candidates)) {
            if (
              !isUuid(row.id) ||
              row.name !== projectName ||
              row.created_by !== identity.id ||
              ![description, `NEGATIVE ${runId}`].includes(
                String(row.description),
              )
            )
              throw new Error(
                'Cleanup marker/ownership mismatch. Stop and inspect; no deletion attempted for this row.',
              );
            const id = row.id;
            await check(
              'Cleanup confirms own leader role',
              client
                .from('project_members')
                .select('user_id,role')
                .eq('project_id', id)
                .eq('user_id', identity.id),
              'success',
              (d) => rows(d).length === 1 && rows(d)[0].role === 'leader',
            );
            await check(
              'Delete only validated owned test project',
              client.rpc('delete_project', { p_project_id: id }),
            );
            await check(
              'Deleted project no longer visible',
              client.from('projects').select('id').eq('id', id),
              'filtered',
            );
          }
          await check(
            'No remaining owned run projects',
            client
              .from('projects')
              .select('id')
              .eq('name', projectName)
              .eq('created_by', identity.id),
            'filtered',
          );
        },
        true,
      );
    },
  };
}
