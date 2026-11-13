import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { TopNav } from './components/TopNav';
import { ReportsProgressView } from './components/ReportsProgressView';
import { GrowthDashboardView } from './components/GrowthDashboardView';
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
    <div className="reports-module-root min-h-screen bg-slate-50/70 text-slate-900 flex flex-col">
      {/* Sleek Top Navigation Bar - NO SIDEBAR */}
      <TopNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        user={user}
        currentDateFormatted={currentDateFormatted}
        period={period}
        onPeriodChange={setPeriod}
      />

      {/* Main Content Area */}
      <main className="flex-1">
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
      </main>
    </div>
  );
}
