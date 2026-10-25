# Phase 1 frontend preview

This increment contains nine frontend layouts using static fictional fixtures. No authentication, Supabase client, backend, storage, database migration, or authorization boundary is implemented. All routes are public preview routes. A visible banner identifies mock data. Google login, creation, editing, and membership mutations are disabled; the checklist is a temporary UI demonstration only.

## Run locally

Use Node.js 22.12+ (Node 24 LTS recommended) and npm. On Windows PowerShell with script execution restricted, use `npm.cmd` instead of `npm`.

```sh
npm install
npm run dev
```

No environment configuration is required. `.env.example` documents this intentionally. The Phase 1 plan's proposed Supabase initializer is deferred under the owner's explicit instruction not to implement Supabase yet.

```sh
npm run typecheck
npm run lint
npm run test
npm run build
npm run format:check
```

## Routes

| Layout                | Route                                |
| --------------------- | ------------------------------------ |
| Sign In               | `/login`                             |
| My Tasks              | `/my-tasks`                          |
| My Projects           | `/projects`                          |
| Project Overview      | `/projects/website/overview`         |
| All Tasks             | `/projects/website/tasks`            |
| Task Details          | `/projects/website/tasks/user-flows` |
| Members               | `/projects/website/members`          |
| Deadline Calendar     | `/projects/website/calendar`         |
| Availability Calendar | `/projects/website/availability`     |

`research` is a second mock project for checking project switching and the global task view. Unknown projects/tasks have recovery links, and a task ID cannot display under a different project. `/` redirects to My Tasks for the preview. BrowserRouter requires a future static host to fall back to `index.html` for deep links; no hosting is configured.

## Structure and interaction

- `src/app`: route tree and project context validation.
- `src/components/layout`: responsive sidebar, project selector, shell and mock banner.
- `src/components/ui`: shadcn-style Button with Radix Slot, shared headers and empty state.
- `src/features`: typed project, task and availability fixtures; task tables and filters.
- `src/pages`: nine screen compositions.
- `src/types`, `src/lib`: domain types, class merging, date formatting.
- `src/test`: route rendering and navigation/filter tests.

Filters, project switching, task navigation, month navigation, mobile navigation and temporary checklist toggles operate locally. Creation and persistence are deliberately deferred. Availability uses project-scoped timestamp fixtures rendered in the browser's local timezone; overlap calculations and slot editing are deferred. Deadlines use exact timestamp fixtures; project due dates use date-only formatting. Example dates are in October 2026.

Inter is bundled locally. Styling uses Tailwind v4 and shared compact layout rules. Keyboard focus, semantic tables, labels, a skip link, horizontal overflow, and a mobile navigation toggle are included.

## Design limitation and review gate

The Figma file was reached and its page list returned, but the connected Starter plan exhausted its tool quota before screen metadata, screenshots or design context could be fetched. Implementation therefore follows the documented restrained white workspace, pale gray sidebar, compact rows, subtle borders and nine-screen structure. Pixel-level Figma fidelity is unverified and requires owner review or restored Figma access. No screenshot assets or fabricated design tokens are claimed.

Review the UI baseline before Phase 2. No deployment, commit, push, or hosted database changes are part of this increment.

## Verification performed

- Dependency installation completed; the final Vite 8 / Vitest 5 dependency install reported zero vulnerabilities. The initial older Vitest tree was replaced after its audit reported advisories.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed without warnings.
- `npm.cmd run test`: 20 tests passed after UI refinement, including all nine layouts, navigation, filtering, project switching, invalid deep links, month navigation, global task scope and keyboard operation of More.
- `npm.cmd run build`: passed; production files generated in ignored `dist/`.
- `npm.cmd run format:check`: passed.
- `npm.cmd ls --depth=0`: passed with no invalid direct dependencies.
- `git diff --check`: passed.

Tests and build required execution outside the sandbox because it blocked toolchain child processes (`spawn EPERM`). Node 24/jsdom navigation required matching Node Request and AbortSignal realms in the test setup. No browser surface was available for screenshot, responsive visual, or manual keyboard QA; these remain review limitations. Automated route tests run in jsdom, not a real browser.

## UI refinement

Typography now uses 15px task/table text and sidebar links, with 13–14px secondary text and table headers. Task rows target 54px, with natural growth for wrapped titles. The task-name column uses less of the table width, and tables and calendars have labeled, keyboard-focusable scroll regions.

The selected project appears above relevant page titles at a larger size. My Tasks remains a global list across projects: changing project context there updates the heading and project navigation without filtering tasks. Selection is kept in memory during preview navigation, and project routes remain the source of context when opening deep links. My Projects and Sign In retain global headings.

At widths up to 900px (including 375px and 768px), the desktop sidebar is replaced by fixed bottom navigation: My Tasks, Projects, Calendar and More. More contains Overview, All Tasks, Members, Availability, a project selector and Sign In. The top bar also retains a project selector. Touch targets, content clearance and safe-area padding are included; Escape closes More and restores button focus. At 1440px, the desktop sidebar remains in place.

Responsive CSS was reviewed for these target widths; actual browser rendering, row measurements, safe-area behavior and manual keyboard checks could not be verified because the browser inventory was empty. Keyboard disclosure behavior and navigation were verified with React Testing Library. No dependencies, business requirements, backend work or authorization changes were introduced.
