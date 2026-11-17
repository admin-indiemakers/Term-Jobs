import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Printer, 
  Calendar, 
  CheckCircle2, 
  FileSpreadsheet, 
  FileText,
  Clock
} from 'lucide-react';
import { reportsApi } from '../services/reportsApi';
import { exportToExcel, exportToPdf } from '../services/exportReports';

export function ExportDateRangeModal({ isOpen, onClose, exportFormat = 'excel', analyticsData = null, onExportComplete }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState('2026-11-06'); // Default from Friday Nov 06 onwards
  const [endDate, setEndDate] = useState(todayStr);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const setPreset = (type) => {
    const end = todayStr;
    let start = todayStr;
    const d = new Date();

    if (type === 'friday_onwards') {
      start = '2026-11-06';
    } else if (type === '7d') {
      d.setDate(d.getDate() - 7);
      start = d.toISOString().slice(0, 10);
    } else if (type === '30d') {
      d.setDate(d.getDate() - 30);
      start = d.toISOString().slice(0, 10);
    } else if (type === 'all') {
      start = '2026-11-01';
    }

    setStartDate(start);
    setEndDate(end);
  };

  const handleExport = async (e) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    setLoading(true);

    try {
      const res = await reportsApi.getReports({ limit: 100 });
      const allReports = res?.reports || [];

      // Filter reports within selected [startDate, endDate]
      const filteredReports = allReports.filter((r) => {
        const d = r.report_date || '';
        return d >= startDate && d <= endDate;
      });

      const filename = `TermJobs_Reports_${startDate}_to_${endDate}.${exportFormat === 'excel' ? 'csv' : 'pdf'}`;

      if (exportFormat === 'excel') {
        exportToExcel(filteredReports, analyticsData, filename, { startDate, endDate });
      } else {
        exportToPdf();
      }

      if (onExportComplete) {
        onExportComplete(`Exported ${filteredReports.length} report(s) from ${startDate} to ${endDate}`);
      }
      onClose();
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setLoading(false);
    }
  };

  const isExcel = exportFormat === 'excel';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-left">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isExcel ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
              {isExcel ? <FileSpreadsheet size={18} /> : <FileText size={18} />}
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                {isExcel ? 'Download Excel (.csv)' : 'Export Report (PDF)'}
              </h3>
              <p className="text-[11px] text-slate-400">Choose date coverage for your export</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleExport} className="mt-4 space-y-4">
          {/* Quick Preset Buttons */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
              Quick Range Presets
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setPreset('friday_onwards')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-left transition border cursor-pointer ${
                  startDate === '2026-11-06'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                ★ From Friday (Nov 6)
              </button>
              <button
                type="button"
                onClick={() => setPreset('7d')}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition cursor-pointer"
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => setPreset('30d')}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition cursor-pointer"
              >
                Last 30 Days
              </button>
              <button
                type="button"
                onClick={() => setPreset('all')}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition cursor-pointer"
              >
                All History
              </button>
            </div>
          </div>

          {/* Date Range Inputs */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">From Date</label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800 shadow-2xs cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">To Date</label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800 shadow-2xs cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Info pill */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
            <Clock size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              All team reports, business KPIs, milestones, and marketing posts between <strong>{startDate}</strong> and <strong>{endDate}</strong> will be included.
            </span>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isExcel ? <Download size={14} /> : <Printer size={14} />}
              <span>{loading ? 'Preparing...' : isExcel ? 'Download Excel (.csv)' : 'Print / Export PDF'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

