import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function OnboardVendor() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/dashboard/superadmin', { replace: true });
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-onboard-vendor-modal'));
    }, 100);
  }, [navigate]);

  return null;
}
