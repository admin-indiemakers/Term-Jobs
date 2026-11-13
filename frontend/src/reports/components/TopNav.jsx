import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  TrendingUp, 
  ArrowLeft, 
  Calendar as CalendarIcon, 
  User as UserIcon,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import termjobsLogo from '../../assets/termjobs-logo.png';

export function TopNav({
  activeTab,
  onTabChange,
  user,
  currentDateFormatted,
  period,
  onPeriodChange,
}) {
  const navigate = useNavigate();

  const handleBackToTermJobs = () => {
    // If browser has history, go back; otherwise navigate to dashboard
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/dashboard/admin');
    }
  };

  const displayName = user?.name || user?.full_name || 'Team Member';
  const displayRole = user?.role || 'Admin / Operator';

  return (
    <header className="reports-topnav sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Left: Branding & Back Button */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <button
              type="button"
              onClick={handleBackToTermJobs}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition text-xs font-semibold cursor-pointer"
              title="Return to TermJobs workspace"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Back</span>
            </button>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            <div className="flex items-center gap-2.5">
              <img 
                src={termjobsLogo} 
                alt="TermJobs Logo" 
                className="h-7 w-auto object-contain shrink-0" 
              />
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 text-sm tracking-tight hidden xs:inline">
                  Reports & Growth
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  <Sparkles size={10} className="text-indigo-600" />
                  <span>Module</span>
                </span>
              </div>
            </div>
          </div>

          {/* Center: Segmented Navigation Control (Reports & Progress vs Growth Dashboard) */}
          <div className="flex items-center justify-center">
            <nav 
              className="reports-segmented-tabs shadow-2xs" 
              aria-label="Reports & Growth Navigation"
            >
              <button
                type="button"
                onClick={() => onTabChange('reports')}
                className={`reports-segmented-tab ${activeTab === 'reports' ? 'active shadow-xs text-slate-900 bg-white' : 'text-slate-600 hover:text-slate-900'}`}
              >
                <FileText size={15} className={activeTab === 'reports' ? 'text-indigo-600' : 'text-slate-400'} />
                <span>Reports & Progress</span>
              </button>

              <button
                type="button"
                onClick={() => onTabChange('growth')}
                className={`reports-segmented-tab ${activeTab === 'growth' ? 'active shadow-xs text-slate-900 bg-white' : 'text-slate-600 hover:text-slate-900'}`}
              >
                <TrendingUp size={15} className={activeTab === 'growth' ? 'text-indigo-600' : 'text-slate-400'} />
                <span>Growth Dashboard</span>
              </button>
            </nav>
          </div>

          {/* Right: Date, Reporting Period & User Profile */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Live Date Display */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
              <CalendarIcon size={13} className="text-slate-400" />
              <span>{currentDateFormatted}</span>
            </div>

            {/* Quick Period Selector (when on Growth Dashboard) */}
            {activeTab === 'growth' && onPeriodChange && (
              <select
                value={period}
                onChange={(e) => onPeriodChange(e.target.value)}
                className="hidden sm:inline-block px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 border-0 text-slate-700 transition cursor-pointer focus:ring-2 focus:ring-indigo-500"
              >
                <option value="today">Today</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>
            )}

            {/* User Profile Pill */}
            <div className="flex items-center gap-2 pl-2">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold uppercase shadow-2xs">
                {displayName.charAt(0) || 'U'}
              </div>
              <div className="hidden md:flex flex-col text-left leading-tight">
                <span className="text-xs font-bold text-slate-900 truncate max-w-[120px]">
                  {displayName}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {displayRole}
                </span>
              </div>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
}
