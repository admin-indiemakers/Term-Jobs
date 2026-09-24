import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SEOHead from '../components/SEOHead';
import { LandingPage as LaunchpadLanding } from '../components/landing/LandingPage';

export default function LandingPage({ defaultRoute = '' }) {
  const navigate = useNavigate();

  useEffect(() => {
    // If incoming with #jobs or defaultRoute #jobs, seamlessly navigate to the dedicated Open Roles page
    if (defaultRoute === '#jobs' || window.location.hash === '#jobs') {
      navigate('/open-roles', { replace: true });
    }
  }, [defaultRoute, navigate]);

  return (
    <>
      <SEOHead
        title="TermJobs — The future of contract work is flexible"
        description="TermJobs is a contract workforce platform bringing hiring, verified talent, AI screening, onboarding, timesheets, and billing into one connected view."
        canonicalUrl="https://termjobs.vercel.app/"
      />
      <LaunchpadLanding />
    </>
  );
}
