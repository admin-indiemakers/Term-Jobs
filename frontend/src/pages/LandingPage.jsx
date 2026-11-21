import React from 'react';
import SEOHead from '../components/SEOHead';
import NewLandingPage from '../components/landing/NewLandingPage';

export default function LandingPage({ enabled = true }) {
  return (
    <>
      {enabled && (
        <SEOHead
          title="TermJobs – Contract Jobs & Flexible Hiring"
          description="Discover genuine contract and temporary work opportunities, or connect your organization with contract talent through TermJobs' hiring and workforce platform."
          canonicalUrl="https://www.termjobs.in/"
        />
      )}
      <NewLandingPage enabled={enabled} />
    </>
  );
}
