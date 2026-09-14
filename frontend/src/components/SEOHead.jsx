import { useEffect } from 'react';

/**
 * SEOHead - Lightweight component to dynamically synchronize document title,
 * meta description, canonical URL, and indexing instructions during client-side transitions.
 */
export default function SEOHead({
  title = 'Term Jobs | Flexible Workforce & Contract Hiring Platform',
  description = 'Term Jobs connects enterprise teams with verified contract professionals, trusted staffing vendors, automated timesheet tracking, and transparent billing in one unified platform.',
  canonicalUrl = 'https://termjobs.vercel.app/',
  noindex = false,
}) {
  useEffect(() => {
    // 1. Update document title
    const prevTitle = document.title;
    document.title = title;

    // 2. Update meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    const prevDesc = metaDesc ? metaDesc.getAttribute('content') : '';
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', description);

    // 3. Update canonical URL
    let linkCanonical = document.querySelector('link[rel="canonical"]');
    const prevCanonical = linkCanonical ? linkCanonical.getAttribute('href') : '';
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.rel = 'canonical';
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute('href', canonicalUrl);

    // 4. Update robots if noindex requested
    let metaRobots = document.querySelector('meta[name="robots"]');
    const prevRobots = metaRobots ? metaRobots.getAttribute('content') : '';
    if (noindex) {
      if (!metaRobots) {
        metaRobots = document.createElement('meta');
        metaRobots.name = 'robots';
        document.head.appendChild(metaRobots);
      }
      metaRobots.setAttribute('content', 'noindex, nofollow');
    }

    return () => {
      document.title = prevTitle;
      if (metaDesc && prevDesc) metaDesc.setAttribute('content', prevDesc);
      if (linkCanonical && prevCanonical) linkCanonical.setAttribute('href', prevCanonical);
      if (metaRobots && prevRobots) metaRobots.setAttribute('content', prevRobots);
    };
  }, [title, description, canonicalUrl, noindex]);

  return null;
}
