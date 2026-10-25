# TaskFlow Requirements (MVP)

**Status:** Product scope agreed; detailed UI behavior and data constraints to be confirmed during implementation.

## Goal
Help a small USM group manage multiple university assignments with clear ownership, deadlines, and progress. Prioritize usability, responsiveness, and maintainability over extensibility.

## Actors
- **Approved member:** signs in, views shared assignments, manages tasks and steps according to agreed group rules.
- **Group maintainer:** initially configures approved members and can manage membership through a simple administrative process.

## Functional requirements
- **FR-01 Authentication:** Google sign-in through Supabase Auth.
- **FR-02 Membership:** only approved signed-in members may access group data. Membership is not fixed at five users.
- **FR-03 Projects:** create, view, rename, and archive assignments/projects within one shared workspace.
- **FR-04 Sections:** organize each project into ordered sections.
- **FR-05 Tasks:** create, view, edit, assign, reorder where supported, complete, and archive tasks; support description, status, and optional due date.
- **FR-06 Steps:** add, edit, reorder where supported, and check off task steps.
- **FR-07 Views:** My Tasks, All Tasks, and Overview using the same authoritative data.
- **FR-08 Feedback:** show loading, success, validation, and error states clearly.

## Nonfunctional requirements
- **NFR-01 Access control:** database policies deny unauthorized access, including direct client queries.
- **NFR-02 Responsiveness:** common interactions should feel responsive; measure before adding optimization mechanisms.
- **NFR-03 Maintainability:** simple, readable TypeScript and small, documented data structures.
- **NFR-04 Reliability:** mutations must report failures; do not silently lose edits.
- **NFR-05 Cost:** use free/low-cost services initially and monitor quotas.

## Deferred / excluded
- Public signup, self-service workspace creation, invites, and multi-tenant SaaS: **excluded**.
- Availability calendar, realtime collaboration, and reminders: **deferred**.
- Complex admin roles, billing, mobile apps, and enterprise features: **excluded**.

## Open decisions (do not silently assume)
- Exact task status values and ordering UX.
- How the maintainer approves/adds/removes members.
- Whether the first MVP needs drag-and-drop.
- Which existing Figma screens to implement first.
