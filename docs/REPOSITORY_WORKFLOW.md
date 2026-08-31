# Wova8 Repository and Deployment Order

## Canonical sources

| Responsibility | Canonical source | Rule |
| --- | --- | --- |
| Production CRM code | `main` | `crm.wova8.com` deploys only reviewed commits from this branch. |
| Feature work | `feat/<scope>` | Branch from current `main`; merge back through a reviewed pull request. |
| Emergency fix | `fix/<scope>` | Branch from the active production commit; verify and merge back to `main`. |
| Database migrations | `supabase/migrations` in the same repository | Commit with code, but apply through a separate approved database gate. |
| Public Wova8 website | `main` until a separate repository is deliberately created | Static export/upload is a separate deployment from the CRM runtime. |

`main` is the single source of truth. Long-lived production branches must not be
used because they allow features, branding and security fixes to diverge.

## Ordered change flow

1. Update local `main` from `origin/main` and confirm the worktree is clean.
2. Create a short-lived branch from that exact commit.
3. Make one bounded change and add regression coverage.
4. Run targeted tests, TypeScript, ESLint and a production build.
5. Rebase or merge the latest `main`, then repeat the verification gates.
6. Open a pull request with changed files, migration impact and rollback notes.
7. Merge only after the required checks pass.
8. Deploy `crm.wova8.com` from the exact resulting `main` commit.
9. Verify active commit, health, auth, key routes and runtime logs.
10. Tag the verified commit as `production-YYYYMMDD-HHMM` for rollback clarity.

## Deployment mapping

| Target | Source | Must not be coupled to |
| --- | --- | --- |
| `crm.wova8.com` | GitHub `main`, Next.js build | DNS edits, Meta changes or database mutations |
| `wova8.com` | Reviewed static package | CRM runtime deploy or Supabase changes |
| Supabase | Explicitly approved migrations/configuration | Normal application redeploy |
| Meta / WhatsApp | Explicitly approved external configuration | Code merge or static-site upload |
| DNS / Hostinger domain mapping | Explicitly approved infrastructure change | Routine code deployment |

## Required production checks

- Active branch is `main` and the full server commit SHA matches GitHub.
- Build completes with the configured production environment.
- `/login`, `/auth/callback`, `/dashboard` and `/intelligence` resolve correctly.
- Logged-out workspace routes redirect to `/login`.
- Owner/admin/agent/viewer permissions remain unchanged.
- Wova8 is the visible brand; legacy `crm.sbyt.app` appears only in intentional
  rollback/compatibility configuration.
- Runtime logs show no new host, callback, auth or database errors.

## Rollback

Redeploy the last verified production tag or full commit SHA. Keep the rollback
to application code unless a separately approved migration or infrastructure
change is known to be the cause. Never delete data, rotate credentials or change
DNS as an application rollback shortcut.

## Future repository split

If the public website needs an independent lifecycle, create a separate
`paktechai/wova8-website` repository only after defining ownership, deployment
credentials and rollback. Until then, keep the static package inside this
repository so there is one auditable source rather than two drifting copies.
