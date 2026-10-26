import { useEffect } from 'react';

/**
 * SEOHead - Lightweight component to dynamically synchronize document title,
 * meta description, canonical URL, OpenGraph, Twitter, and Schema.org JSON-LD structured data.
 */
export default function SEOHead({
  title = 'TermJobs',
  description = 'Term Jobs connects enterprise teams with verified contract professionals, trusted staffing vendors, automated timesheet tracking, and transparent billing in one unified platform.',
  canonicalUrl = 'https://www.termjobs.in/',
  ogType = 'website',
  ogImage = 'https://www.termjobs.in/logo.png',
  jsonLd = null,
  noindex = false,
}) {
  useEffect(() => {
    // 1. Update document title
    const prevTitle = document.title;
    document.title = title;

    // Helper for meta tags
    const setMetaTag = (selector, name, attr, value) => {
      let el = document.querySelector(selector);
      const prev = el ? el.getAttribute('content') : null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', value);
      return () => {
        if (el) {
          if (prev !== null) el.setAttribute('content', prev);
          else el.remove();
        }
      };
    };

    const cleanupDesc = setMetaTag('meta[name="description"]', 'description', 'name', description);
    const cleanupOgTitle = setMetaTag('meta[property="og:title"]', 'og:title', 'property', title);
    const cleanupOgDesc = setMetaTag('meta[property="og:description"]', 'og:description', 'property', description);
    const cleanupOgUrl = setMetaTag('meta[property="og:url"]', 'og:url', 'property', canonicalUrl);
    const cleanupOgType = setMetaTag('meta[property="og:type"]', 'og:type', 'property', ogType);
    const cleanupOgImage = setMetaTag('meta[property="og:image"]', 'og:image', 'property', ogImage);
    const cleanupTwTitle = setMetaTag('meta[name="twitter:title"]', 'twitter:title', 'name', title);
    const cleanupTwDesc = setMetaTag('meta[name="twitter:description"]', 'twitter:description', 'name', description);

    // 3. Update canonical URL
    let linkCanonical = document.querySelector('link[rel="canonical"]');
    const prevCanonical = linkCanonical ? linkCanonical.getAttribute('href') : null;
    if (!linkCanonical) {
      linkCanonical = document.createElement('link');
      linkCanonical.rel = 'canonical';
      document.head.appendChild(linkCanonical);
    }
    linkCanonical.setAttribute('href', canonicalUrl);

    // 4. Update robots if noindex requested
    let metaRobots = document.querySelector('meta[name="robots"]');
    const prevRobots = metaRobots ? metaRobots.getAttribute('content') : null;
    if (noindex) {
      if (!metaRobots) {
        metaRobots = document.createElement('meta');
        metaRobots.name = 'robots';
        document.head.appendChild(metaRobots);
      }
      metaRobots.setAttribute('content', 'noindex, nofollow');
    }

    // 5. Dynamic JSON-LD injection
    let jsonLdScript = null;
    if (jsonLd) {
      jsonLdScript = document.createElement('script');
      jsonLdScript.type = 'application/ld+json';
      jsonLdScript.setAttribute('data-dynamic-seo', 'true');
      jsonLdScript.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(jsonLdScript);
    }

    return () => {
      document.title = prevTitle;
      cleanupDesc();
      cleanupOgTitle();
      cleanupOgDesc();
      cleanupOgUrl();
      cleanupOgType();
      cleanupOgImage();
      cleanupTwTitle();
      cleanupTwDesc();

      if (linkCanonical) {
        if (prevCanonical) linkCanonical.setAttribute('href', prevCanonical);
        else linkCanonical.remove();
      }
      if (metaRobots) {
        if (prevRobots) metaRobots.setAttribute('content', prevRobots);
        else metaRobots.remove();
      }
      if (jsonLdScript) {
        jsonLdScript.remove();
      }
    };
  }, [title, description, canonicalUrl, ogType, ogImage, jsonLd, noindex]);

  return null;
}

