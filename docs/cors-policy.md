# CORS policy

The frontend Vercel asset route explicitly sets `Access-Control-Allow-Origin` to
`https://www.termjobs.in`, overriding the permissive static hosting default reported
by ZAP. Same-origin asset loads continue working on the apex domain and preview
deployments; the header only governs cross-origin browser reads. Public JavaScript
is still publicly downloadable, and CORS is not authentication.

The API uses the exact origins in `backend/modules/shared/cors.py`. Arbitrary
Vercel projects and hostname substring matches are no longer trusted. Production
and preview frontends use their same-origin API proxy. If a frontend genuinely
needs direct cross-origin API access, add its exact trusted origin to the list.
Preflights are handled by Starlette's CORS middleware; custom routing middleware
must not reflect request origins or bypass preflight validation. Error responses
use the same allowlist and vary by Origin.

Deploy both frontend and backend changes, then check an existing asset URL from
the newly deployed page (old hashed assets may return 404):

```sh
curl -sI 'https://termjobs.in/assets/ACTUAL-CURRENT-ASSET.js' -H 'Origin: https://evil.example'
curl -si -X OPTIONS 'https://termjobs.in/api/auth/me' -H 'Origin: https://evil.example' -H 'Access-Control-Request-Method: GET'
curl -si -X OPTIONS 'https://termjobs.in/api/auth/me' -H 'Origin: https://www.termjobs.in' -H 'Access-Control-Request-Method: GET'
```

Expect the asset header to contain only the canonical domain, the untrusted API
preflight to return 400 without an allow-origin header, and the trusted preflight
to return 200 with its exact origin. Repeat on `www.termjobs.in` and rerun ZAP.
Verify the edge emits a single allow-origin header, with no additional wildcard.
