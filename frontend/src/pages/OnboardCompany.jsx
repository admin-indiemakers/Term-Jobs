import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function OnboardCompany() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to superadmin dashboard
    navigate('/dashboard/superadmin', { replace: true });
    // Open the onboard modal
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-onboard-company-modal'));
    }, 100);
  }, [navigate]);

  return null;
}
