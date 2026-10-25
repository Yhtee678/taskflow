import { useOutletContext } from 'react-router-dom';
import type { Project } from '@/types/domain';
import { people } from '@/features/projects/mock-data';
import { tasks } from '@/features/tasks/mock-data';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
export function MembersPage() {
  const project = useOutletContext<Project>();
  return (
    <>
      <PageHeader
        title="Project Members"
        description={`${project.name} · ${project.members.length} members`}
      >
        <Button disabled title="Leader-only membership actions are deferred">
          Add member
        </Button>
      </PageHeader>
      <p className="helper">
        All members can collaborate on project tasks. Only the project leader
        manages membership.
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
            {people
              .filter((p) => project.members.includes(p.id))
              .map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="person">
                      <span className="avatar">{p.initials}</span>
                      <span>
                        {p.name}
                        {p.id === 'alex' ? ' (you)' : ''}
                      </span>
                    </span>
                  </td>
                  <td>{p.id === 'alex' ? 'Leader' : 'Member'}</td>
                  <td>
                    {
                      tasks.filter(
                        (t) =>
                          t.projectId === project.id && t.assignee === p.id,
                      ).length
                    }
                  </td>
                  <td>
                    {
                      tasks.filter(
                        (t) =>
                          t.projectId === project.id &&
                          t.assignee === p.id &&
                          t.status === 'done',
                      ).length
                    }
                  </td>
                  <td>
                    {p.id === 'alex' ? (
                      <span className="muted">Project creator</span>
                    ) : (
                      <Button
                        variant="ghost"
                        disabled
                        title="Membership changes are deferred"
                      >
                        Remove
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
