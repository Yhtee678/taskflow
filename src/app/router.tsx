import { createBrowserRouter, Link, Navigate } from 'react-router-dom';
import { AuthenticatedApp } from './workspace-provider';
import { EmptyState } from '@/components/ui/page-header';
import { ProjectRoute, RouteError } from './route-boundaries';
import { LoginPage } from '@/pages/login-page';
import { MyTasksPage } from '@/pages/my-tasks-page';
import { ProjectsPage } from '@/pages/projects-page';
import { OverviewPage } from '@/pages/overview-page';
import { AllTasksPage } from '@/pages/all-tasks-page';
import { TaskDetailPage } from '@/pages/task-detail-page';
import { MembersPage } from '@/pages/members-page';
import { DeadlineCalendarPage } from '@/pages/deadline-calendar-page';
import { AvailabilityPage } from '@/pages/availability-page';
import { CalendarPage } from '@/pages/calendar-page';
import { ProtectedRoute, AuthCallbackPage } from '@/features/auth/auth-routes';
export const routes = [
  {
    errorElement: <RouteError />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/auth/callback', element: <AuthCallbackPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AuthenticatedApp />,
            children: [
              { path: '/', element: <Navigate to="/my-tasks" replace /> },
              { path: '/my-tasks', element: <MyTasksPage /> },
              { path: '/calendar', element: <CalendarPage /> },
              {
                path: '/projects/:projectId/calendar',
                element: <DeadlineCalendarPage />,
              },
              { path: '/projects', element: <ProjectsPage /> },
              {
                path: '/projects/:projectId',
                element: <ProjectRoute />,
                children: [
                  { index: true, element: <Navigate to="overview" replace /> },
                  { path: 'overview', element: <OverviewPage /> },
                  { path: 'tasks', element: <AllTasksPage /> },
                  { path: 'tasks/:id', element: <TaskDetailPage /> },
                  { path: 'members', element: <MembersPage /> },
                  { path: 'availability', element: <AvailabilityPage /> },
                ],
              },
              {
                path: '*',
                element: (
                  <EmptyState title="Page not found">
                    <Link to="/my-tasks">Return to My Tasks</Link>
                  </EmptyState>
                ),
              },
            ],
          },
        ],
      },
    ],
  },
];
export const router = createBrowserRouter(routes);
