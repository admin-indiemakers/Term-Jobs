# Database isolation for hosted frontends

QA and dev must use their own backend deployment. Routing a preview frontend to
the production backend also routes it to production's database, regardless of
the frontend's Git branch.

The frontend `/api` function now selects the backend using server-side Vercel
environment variables. Hosted browser code cannot bypass this function using
`VITE_API_URL` or `VITE_API_BASE_URL`.

| Frontend deployment | Backend variable | Required backend cluster |
| --- | --- | --- |
| QA | `QA_BACKEND_URL` | `dev_qa` |
| dev | `DEV_BACKEND_URL` | `dev_qa` |
| Other previews | `DEV_QA_BACKEND_URL` | `dev_qa` |
| main, production environment | `PRODUCTION_BACKEND_URL` (optional) | `main` |

QA defaults to the confirmed backend alias
`https://term-jobs-j8ja-git-qa-i-ndiemakers.vercel.app`.
`QA_BACKEND_URL` overrides that alias; `DEV_QA_BACKEND_URL` is also a fallback
for QA/dev when their specific variable is unset. There is no fallback to
production for previews. Dev requires its own configured backend URL.

## Deployment steps

1. Deploy the backend isolation changes to QA/dev and main. A backend preview
   uses `dev_qa` even when its source branch is main. Only a main production
   deployment can select production.
2. In the frontend Vercel project's Preview environment, set `QA_BACKEND_URL`
   to the QA **backend** HTTPS origin and `DEV_BACKEND_URL` to the dev backend
   origin. Scope each variable to its matching branch, or use
   `DEV_QA_BACKEND_URL` if dev and QA share one isolated backend.
3. Set the QA/dev backend's `MONGODB_URL_DEV_QA` to its nonproduction cluster.
   A QA database URL matching a known production host is refused.
   Remove production MongoDB credentials from Vercel's Preview environment;
   scope `MONGODB_URL_MAIN`/`MONGODB_URL_PROD` to Production only. Production
   has no source-code credential fallback.
4. Redeploy the frontend previews. The proxy verifies `/api/environment`
   reports `dev_qa` before forwarding credentials or mutation bodies.
   If the backend redirects to Vercel login, create an automation bypass secret
   in the backend project's Deployment Protection settings. Set it on the
   frontend project as `BACKEND_PROTECTION_BYPASS_SECRET`, scoped to Preview.
   It is attached only to server-to-server backend requests, never URLs or
   browser bundles. A missing/invalid secret keeps the proxy disabled.
5. Check `/api/environment` through the QA frontend; it must report
   `{"active_cluster":"dev_qa"}`. Missing configuration, a production target,
   or an unverifiable backend yields HTTP 503 without forwarding user data.

The main backend also rejects requests identified as coming from localhost or
the app's QA/dev frontend aliases. Request headers can require a matching
cluster; they cannot switch a backend to another database.

Local Vite development continues using the local backend on port 8000.
