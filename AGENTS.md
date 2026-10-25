# TaskFlow Agent Instructions

## Product and scope
TaskFlow is a small, private USM group assignment planner, **not** a public SaaS product. One shared workspace can contain many assignments/projects; member count must not be hard-coded to five. Follow `docs/requirements.md` and the current approved phase.

## Stack
React + TypeScript + Vite; Tailwind CSS + shadcn/ui; Supabase Auth + PostgreSQL + RLS. Prefer simple components and a small number of modules. Do not introduce Next.js, Express, Prisma, Drizzle, Redux, Docker, or another backend without explicit approval.

## Development rules
1. Read relevant files before changing them. State a short plan and the intended files.
2. Implement only the requested phase; avoid speculative features, layers, and dependencies.
3. Keep UI, data access, and validation understandable. Favor clear names over clever abstractions.
4. Use TypeScript strict mode. Validate untrusted inputs and handle loading/error/empty states.
5. Enforce access control in Supabase RLS, not only in the UI. All group data must be accessible only to approved authenticated members.
6. Never put a service-role key or other secret in browser code or commit secrets. Use `.env.example` with placeholders.
7. Use versioned SQL migrations for schema and policy changes. Test unauthorized access as well as authorized access.
8. Keep database calls limited and efficient. Do not build custom RPC, caching, locking, or conflict frameworks without evidence of need.
9. Write focused tests for business rules and regressions. Run available lint, typecheck, tests, and build checks.
10. Keep README and requirements accurate. Label planned features as planned, not implemented.
11. Preserve the legacy repository separately. Do not copy Google Apps Script or Google Sheets infrastructure.
12. Do not push, merge, deploy, change production resources, or make external service changes without explicit approval.

## Completion report
Summarize changes, files touched, commands run with results, manual steps, limitations, and what remains for the next phase. Distinguish actual verification from assumptions.
