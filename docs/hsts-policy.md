# HTTP Strict Transport Security

All three Vercel deployment configurations set this response header:

```http
Strict-Transport-Security: max-age=31536000
```

The frontend applies it before static file handling, API proxying, and SPA
fallbacks. Both Python API deployment roots also apply it to every path. Browsers
honor HSTS received over HTTPS and remember the policy for one year after each
response. Vercel provides HTTPS termination; this header complements HTTPS
redirects rather than replacing them.

The policy is host-specific. `includeSubDomains` and `preload` are intentionally
omitted until all subdomains have been inventoried and confirmed HTTPS-only.

## Scope of the reported finding

The supplied affected URL is on `fonts.gstatic.com`, which Google operates.
TermJobs cannot set HSTS on Google's font responses, and its own HSTS policy does
not apply to that domain. The supplied report mentions seven instances but lists
only one URL; the ownership of the other six has not been established.

Classify Google-hosted URLs as third-party findings in the scan report. If the
requirement is to eliminate third-party font requests entirely, self-hosting the
licensed fonts is a separate option. Adding HSTS to TermJobs does not resolve a
finding on Google's server.

## Deployment verification

Deploy the frontend and the relevant backend configuration, then inspect HTTPS
response headers for both website hosts, a current asset, and an API endpoint:

```sh
curl -sIL https://termjobs.in/
curl -sIL https://www.termjobs.in/
curl -sI https://www.termjobs.in/open-roles
curl -sI https://www.termjobs.in/assets/ACTUAL-CURRENT-ASSET.js
curl -sI https://www.termjobs.in/api/health
```

Use a real asset path from the deployed HTML and the deployed API health route.
Confirm `Strict-Transport-Security: max-age=31536000` on HTTPS responses, including
redirects and errors where controlled by the deployment. Rerun ZAP scoped to
TermJobs-owned hosts and review external-resource findings separately. Local
tests validate routing configuration, not live CDN response headers.
