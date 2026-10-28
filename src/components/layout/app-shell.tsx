import { useEffect, useRef, useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useNavigate,
  useParams,
  useLocation,
} from 'react-router-dom';
import {
  CalendarDays,
  CheckCheck,
  CheckSquare,
  Clock3,
  FolderOpen,
  LayoutList,
  Menu,
  Users,
} from 'lucide-react';
import { useWorkspace } from '@/app/workspace-context';
import { RemoteState } from '@/components/ui/remote-state';
import { Modal } from '@/components/ui/modal';
import { updateDisplayName } from '@/features/projects/queries';
import { text } from '@/lib/data-client';
import { SelectedProjectContext } from './project-context';
import { useAuth } from '@/features/auth/auth-context';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { AccountMenu } from './account-menu';
import { ProjectPicker } from './project-picker';
import { FeedbackToast } from '@/components/ui/feedback-toast';
export function AppShell() {
  const { session, signOut, busy, error } = useAuth();
  const { catalog, refresh, mutate, pending } = useWorkspace();
  const projects = catalog.data?.projects ?? [];
  const [editProfile, setEditProfile] = useState(false);
  const name =
    catalog.data?.profile.display_name ||
    session?.user.email ||
    'Signed-in user';
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part: string) => part[0])
    .join('')
    .toUpperCase();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const activeProjectId =
    projectId ??
    (pathname === '/calendar'
      ? new URLSearchParams(search).get('project')
      : null);
  const [open, setOpen] = useState(false);
  const storageKey = `taskflow:selected-project:${session!.user.id}`;
  const [selectedId, setSelectedId] = useState(() => {
    try {
      return localStorage.getItem(storageKey) ?? '';
    } catch {
      return '';
    }
  });
  const moreButton = useRef<HTMLButtonElement>(null);
  const selected =
    (activeProjectId
      ? projects.find((p) => p.id === activeProjectId)
      : (projects.find((p) => p.id === selectedId) ?? projects[0])) ?? null;
  useEffect(() => {
    if (open) document.getElementById('more-project-picker')?.focus();
  }, [open]);
  useEffect(() => {
    if (selected) {
      setSelectedId(selected.id);
      try {
        localStorage.setItem(storageKey, selected.id);
      } catch {
        /* Browser storage is optional. */
      }
    }
  }, [selected, storageKey]);
  const switchProject = (id: string) => {
    setSelectedId(id);
    // Global screens retain their cross-project scope when context changes.
    if (activeProjectId) navigate(`/projects/${id}/overview`);
  };
  const closeMore = () => {
    setOpen(false);
    document.getElementById('main')?.focus();
  };
  const base = selected ? `/projects/${selected.id}` : '/projects';
  const globalLinks = [
    { to: '/my-tasks', label: 'My Tasks', icon: CheckSquare },
    { to: '/projects', label: 'My Projects', icon: FolderOpen },
    { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  ];
  const projectLinks = selected
    ? [
        { to: `${base}/overview`, label: 'Overview', icon: LayoutList },
        { to: `${base}/tasks`, label: 'All Tasks', icon: CheckSquare },
        { to: `${base}/members`, label: 'Members', icon: Users },
        { to: `${base}/availability`, label: 'Availability', icon: Clock3 },
      ]
    : [];
  return (
    <SelectedProjectContext.Provider value={selected}>
      <div
        className="app-shell"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            setOpen(false);
            moreButton.current?.focus();
          }
        }}
      >
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <div className="mobile-bar">
          <Link to="/my-tasks" className="brand">
            <CheckCheck size={22} />
            TaskFlow
          </Link>
          <ProjectPicker
            id="mobile-project-picker"
            label="Mobile selected project"
            selected={selected}
            projects={projects}
            onChange={switchProject}
          />
        </div>
        <aside className="sidebar">
          <Link to="/my-tasks" className="brand">
            <CheckCheck size={25} />
            TaskFlow
          </Link>
          <nav aria-label="Main navigation">
            {globalLinks.map(({ to, label, icon: Icon }) => (
              <NavLink end key={to} to={to} onClick={() => setOpen(false)}>
                <Icon size={17} />
                {label}
              </NavLink>
            ))}
            <div className="nav-label">PROJECT</div>
            <ProjectPicker
              id="project-picker"
              label="Selected project"
              selected={selected}
              projects={projects}
              onChange={(id) => {
                switchProject(id);
                setOpen(false);
              }}
            />
            {projectLinks.map(({ to, label, icon: Icon }) => (
              <NavLink
                end={label === 'All Tasks'}
                key={to}
                to={to}
                onClick={() => setOpen(false)}
              >
                <Icon size={17} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-footer">
            <AccountMenu
              id="desktop-account-menu"
              name={name}
              initials={initials}
              busy={busy}
              onEdit={() => setEditProfile(true)}
              onSignOut={signOut}
            />
          </div>
        </aside>
        <div className="workspace">
          <div className="workspace-toolbar">
            <span>Project workspace</span>
            <div className="workspace-actions">
              <NotificationBell />
              <Button variant="ghost" onClick={refresh} disabled={pending}>
                Refresh data
              </Button>
            </div>
          </div>
          <main id="main" tabIndex={-1}>
            {error && <p role="alert">{error}</p>}
            {catalog.data ? (
              <Outlet />
            ) : (
              <RemoteState state={catalog} retry={refresh} />
            )}
          </main>
          <footer className="workspace-footer">TaskFlow</footer>
        </div>
        {open && (
          <section
            id="mobile-more"
            className="mobile-more"
            aria-label="More navigation"
          >
            <h2>Project navigation</h2>
            <AccountMenu
              id="mobile-account-menu"
              name={name}
              initials={initials}
              busy={busy}
              onEdit={() => {
                setEditProfile(true);
                setOpen(false);
              }}
              onSignOut={signOut}
            />
            <ProjectPicker
              id="more-project-picker"
              label="Selected project"
              selected={selected}
              projects={projects}
              onChange={(id) => {
                switchProject(id);
                setOpen(false);
                moreButton.current?.focus();
              }}
            />
            <nav aria-label="More project navigation">
              {projectLinks.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} onClick={closeMore}>
                  <Icon size={20} />
                  {label}
                </NavLink>
              ))}
            </nav>
          </section>
        )}
        <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
          <NavLink to="/my-tasks" onClick={closeMore}>
            <CheckSquare size={21} />
            <span>My Tasks</span>
          </NavLink>
          <NavLink end to="/projects" onClick={closeMore}>
            <FolderOpen size={21} />
            <span>Projects</span>
          </NavLink>
          <NavLink to="/calendar" onClick={closeMore}>
            <CalendarDays size={21} />
            <span>Calendar</span>
          </NavLink>
          <button
            ref={moreButton}
            type="button"
            aria-expanded={open}
            aria-controls="mobile-more"
            className={
              open || projectLinks.some((link) => pathname.startsWith(link.to))
                ? 'active'
                : ''
            }
            onClick={() => setOpen(!open)}
          >
            <Menu size={21} />
            <span>More</span>
          </button>
        </nav>
        {editProfile && (
          <Modal
            title="Edit display name"
            onClose={() => setEditProfile(false)}
          >
            <form
              className="editor-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                if (
                  await mutate(
                    () =>
                      updateDisplayName(
                        session!.user.id,
                        text(form.get('display_name'), 200, true),
                      ),
                    'Display name updated.',
                  )
                )
                  setEditProfile(false);
              }}
            >
              <label>
                Display name
                <input
                  name="display_name"
                  required
                  maxLength={200}
                  defaultValue={catalog.data?.profile.display_name ?? ''}
                />
              </label>
              <p>Google manages your sign-in identity and email.</p>
              <Button disabled={pending}>Save name</Button>
            </form>
          </Modal>
        )}
        <FeedbackToast />
      </div>
    </SelectedProjectContext.Provider>
  );
}
