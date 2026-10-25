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
import { projects } from '@/features/projects/mock-data';
import { SelectedProjectContext } from './project-context';
export function AppShell() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(projects[0].id);
  const moreButton = useRef<HTMLButtonElement>(null);
  const selected =
    projects.find((p) => p.id === (projectId ?? selectedId)) ?? projects[0];
  useEffect(() => {
    if (open) document.getElementById('more-project-picker')?.focus();
  }, [open]);
  useEffect(() => {
    if (projects.some((p) => p.id === projectId)) setSelectedId(projectId!);
  }, [projectId]);
  const switchProject = (id: string) => {
    setSelectedId(id);
    // Global screens retain their cross-project scope when context changes.
    if (projectId) navigate(`/projects/${id}/overview`);
  };
  const closeMore = () => {
    setOpen(false);
    document.getElementById('main')?.focus();
  };
  const base = `/projects/${selected.id}`;
  const globalLinks = [
    { to: '/my-tasks', label: 'My Tasks', icon: CheckSquare },
    { to: '/projects', label: 'My Projects', icon: FolderOpen },
  ];
  const projectLinks = [
    { to: `${base}/overview`, label: 'Overview', icon: LayoutList },
    { to: `${base}/tasks`, label: 'All Tasks', icon: CheckSquare },
    { to: `${base}/members`, label: 'Members', icon: Users },
    { to: `${base}/calendar`, label: 'Deadline Calendar', icon: CalendarDays },
    { to: `${base}/availability`, label: 'Availability', icon: Clock3 },
  ];
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
          <label className="sr-only" htmlFor="mobile-project-picker">
            Mobile selected project
          </label>
          <select
            id="mobile-project-picker"
            value={selected.id}
            onChange={(e) => switchProject(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
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
            <label className="sr-only" htmlFor="project-picker">
              Selected project
            </label>
            <select
              id="project-picker"
              value={selected.id}
              onChange={(e) => {
                switchProject(e.target.value);
                setOpen(false);
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
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
            <span className="avatar">AT</span>
            <div>
              <strong>Alex Tan</strong>
              <small>Demo profile</small>
            </div>
            <Link to="/login">Sign in</Link>
          </div>
        </aside>
        <div className="workspace">
          <div className="demo-banner">
            Frontend preview · Mock data only · Changes are not saved
          </div>
          <main id="main" tabIndex={-1}>
            <Outlet />
          </main>
          <footer className="workspace-footer">
            TaskFlow · Phase 1 frontend preview
          </footer>
        </div>
        {open && (
          <section
            id="mobile-more"
            className="mobile-more"
            aria-label="More navigation"
          >
            <h2>Project navigation</h2>
            <label htmlFor="more-project-picker">Selected project</label>
            <select
              id="more-project-picker"
              value={selected.id}
              onChange={(e) => {
                switchProject(e.target.value);
                setOpen(false);
                moreButton.current?.focus();
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <nav aria-label="More project navigation">
              {projectLinks
                .filter((link) => link.label !== 'Deadline Calendar')
                .map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to} onClick={closeMore}>
                    <Icon size={20} />
                    {label}
                  </NavLink>
                ))}
            </nav>
            <Link to="/login" onClick={closeMore}>
              Sign in
            </Link>
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
          <NavLink to={`${base}/calendar`} onClick={closeMore}>
            <CalendarDays size={21} />
            <span>Calendar</span>
          </NavLink>
          <button
            ref={moreButton}
            type="button"
            aria-expanded={open}
            aria-controls="mobile-more"
            className={
              open ||
              projectLinks.some(
                (link) =>
                  link.label !== 'Deadline Calendar' &&
                  pathname.startsWith(link.to),
              )
                ? 'active'
                : ''
            }
            onClick={() => setOpen(!open)}
          >
            <Menu size={21} />
            <span>More</span>
          </button>
        </nav>
      </div>
    </SelectedProjectContext.Provider>
  );
}
