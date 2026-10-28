import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ProjectBundle } from '@/types/database';
import { useAuth } from '@/features/auth/auth-context';
import { useWorkspace } from '@/app/workspace-context';
import { addMember, removeMember } from '@/features/members/queries';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
export function MembersPage() {
  const bundle = useOutletContext<ProjectBundle>();
  const { session } = useAuth();
  const { mutate, pending } = useWorkspace();
  const [adding, setAdding] = useState(false);
  const leader = bundle.members.some(
    (m) => m.user_id === session!.user.id && m.role === 'leader',
  );
  return (
    <>
      <PageHeader
        title="Project Members"
        description={`${bundle.project.name} · ${bundle.members.length} members`}
      >
        {leader && (
          <Button disabled={pending} onClick={() => setAdding(true)}>
            Add member
          </Button>
        )}
      </PageHeader>
      <p className="helper">
        Members can edit all project tasks. Only the leader manages membership.
        Add existing registered users by email; no invitation is sent.
      </p>
      <div
        className="table-scroll"
        role="region"
        aria-label="Project members table"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Project role</th>
              <th>Assigned tasks</th>
              <th>Completed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bundle.members.map((m) => (
              <tr key={m.user_id}>
                <td>
                  {m.display_name}
                  {m.user_id === session!.user.id ? ' (you)' : ''}
                </td>
                <td>{m.role === 'leader' ? 'Leader' : 'Member'}</td>
                <td>
                  {
                    bundle.tasks.filter((t) => t.assignee_id === m.user_id)
                      .length
                  }
                </td>
                <td>
                  {
                    bundle.tasks.filter(
                      (t) => t.assignee_id === m.user_id && t.status === 'done',
                    ).length
                  }
                </td>
                <td>
                  {m.role === 'leader' ? (
                    <span className="muted">Project creator</span>
                  ) : leader ? (
                    <Button
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove ${m.display_name}? Their tasks will be unassigned and availability deleted.`,
                          )
                        )
                          void mutate(
                            () => removeMember(bundle.project.id, m.user_id),
                            'Member removed.',
                          );
                      }}
                    >
                      Remove
                    </Button>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding && (
        <Modal title="Add registered member" onClose={() => setAdding(false)}>
          <form
            className="editor-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const email = String(
                new FormData(e.currentTarget).get('email') ?? '',
              ).trim();
              if (
                await mutate(
                  () => addMember(bundle.project.id, email),
                  'Member added.',
                )
              )
                setAdding(false);
            }}
          >
            <label>
              Registered email
              <input name="email" type="email" required maxLength={320} />
            </label>
            <Button disabled={pending}>Add member</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
