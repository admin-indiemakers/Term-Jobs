import React from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../api/client';
import AuraChatWorkspace from '../components/aura/AuraChatWorkspace';

/**
 * HiringManagerAuraChat page.
 * Mounted at `/dashboard/hiring-manager` in TermJobs portal.
 * Seamlessly integrates Aura AI Assistant inside DashboardLayout content-area.
 */
export default function HiringManagerAuraChat() {
  const { user, token } = useAuth();

  return (
    <div className="w-full h-full min-h-0 flex-1 flex flex-col overflow-hidden bg-white">
      <AuraChatWorkspace
        apiBaseUrl={API_BASE_URL}
        token={token}
        user={user}
      />
    </div>
  );
}
