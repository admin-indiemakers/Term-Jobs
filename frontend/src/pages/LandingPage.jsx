import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SEOHead from '../components/SEOHead';
import { LandingPage as LaunchpadLanding } from '../components/landing/LandingPage';

export default function LandingPage({ defaultRoute = '', enabled = true }) {
  const navigate = useNavigate();

  useEffect(() => {
    // If incoming with #jobs or defaultRoute #jobs, seamlessly navigate to the dedicated Open Roles page
    if (defaultRoute === '#jobs' || window.location.hash === '#jobs') {
      navigate('/open-roles', { replace: true });
    }
  }, [defaultRoute, navigate]);

  return (
    <>
      {enabled && (
        <SEOHead
          title="TermJobs – Contract Jobs & Flexible Hiring"
          description="Discover genuine contract and temporary work opportunities, or connect your organization with contract talent through TermJobs' hiring and workforce platform."
          canonicalUrl="https://www.termjobs.in/"
        />
      )}
      <LaunchpadLanding enabled={enabled} />
    </>
  );
}
