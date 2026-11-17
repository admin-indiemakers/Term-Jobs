import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { TopNav } from './components/TopNav';
import { ReportsProgressView } from './components/ReportsProgressView';
import { GrowthDashboardView } from './components/GrowthDashboardView';
import { Backdrop } from '../components/landing/Backdrop';
import './styles/reports.css';

export default function ReportsModule({ defaultTab = 'reports' }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(defaultTab); // 'reports' | 'growth'
  const [period, setPeriod] = useState('30d'); // for growth dashboard

  // Formatted Current Date (e.g. "Thu, Nov 12, 2026")
  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="reports-module-root min-h-screen text-slate-900 flex flex-col relative selection:bg-slate-900 selection:text-white">
      {/* Signature TermJobs Ambient Light Backdrop (Grid, Mesh, Light Radial) */}
      <Backdrop tone="light" fixed />

      {/* Sleek Top Navigation Bar - NO SIDEBAR */}
      <TopNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        user={user}
        currentDateFormatted={currentDateFormatted}
        period={period}
        onPeriodChange={setPeriod}
      />

      {/* Main Big Container Workspace matching Hiring Manager / Workstation layout */}
      <main className="w-full max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-7 relative z-10 flex-1 flex flex-col min-w-0">
        <div className="reports-big-container bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-[0_4px_32px_rgba(15,23,42,0.04)] flex flex-col flex-1 overflow-hidden transition-all">
          {activeTab === 'reports' ? (
            <ReportsProgressView
              user={user}
              onReportSaved={() => {
                // Optionally trigger background refresh
              }}
            />
          ) : (
            <GrowthDashboardView
              period={period}
              onPeriodChange={setPeriod}
            />
          )}
        </div>
      </main>
    </div>
  );
}
