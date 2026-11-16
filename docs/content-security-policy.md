# Content Security Policy

The frontend Vercel deployment (`frontend/vercel.json`) sets an enforced
`Content-Security-Policy` response header before filesystem handling, API proxying,
and SPA fallback routing. Deploy the frontend project to apply it to the website.
The root and backend Vercel configurations serve the Python API, not the frontend.

Scripts are restricted to the same origin and Google Identity Services. The static
JSON-LD block has a SHA-256 allowance; update that hash whenever its contents change.
Executable startup code lives in `frontend/public/startup.js`, and inline event
handlers are blocked. WebAssembly compilation is allowed for voice detection;
JavaScript `eval` is not.

Google Fonts, Google authentication, the AI provider configuration checks, and
LiveKit Cloud connections have explicit allowances. Same-origin and blob frames
support document previews. Inline styles remain allowed for existing React styles
and animations. HTTPS images remain allowed because company logos and user avatars
can use externally supplied URLs. These are deliberate compatibility exceptions.
Self-hosted LiveKit or other new external services require their exact origins to
be added before use; do not broaden script or connection sources to all HTTPS sites.

Validate locally with:

```sh
cd frontend
node --test tests/content-security-policy.test.mjs tests/asset-routing.test.mjs tests/landing-startup.test.mjs
npm run build
```

After deployment, inspect the final response headers on both domains and a deep link:

```sh
curl -sIL https://termjobs.in/
curl -sIL https://www.termjobs.in/
curl -sIL https://www.termjobs.in/open-roles
```

Confirm the final HTML response contains `Content-Security-Policy`, then check the
browser console while exercising sign-in, job browsing, document previews, and
interview media. Rerun OWASP ZAP against the deployed site. Local configuration
checks do not establish that production has received the header.
