import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  User,
  FileText,
  Phone,
  Clock,
  CheckCircle2,
  AlertCircle,
  Briefcase
} from 'lucide-react';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// No hardcoded events - dynamically loaded from real company data
const DEFAULT_EVENTS = [];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDateToIso(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateObj) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[dateObj.getDay()]}, ${months[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;
}

export default function CalendarModal({ isOpen, onClose }) {
  const { token } = useAuth();
  const navigate = useNavigate();

  // Current live date
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState('Month'); // 'Month' | 'Week' | 'Day'
  const [allEvents, setAllEvents] = useState([]);

  // Fetch live company interviews & requisitions to merge dynamically
  useEffect(() => {
    if (!isOpen || !token) return;

    let isMounted = true;
    Promise.all([
      request('/api/interviews/company', { token }).catch(() => []),
      request('/api/requisitions', { token }).catch(() => []),
    ]).then(([interviews, requisitions]) => {
      if (!isMounted) return;

      const dynamicEvents = [];

      if (Array.isArray(interviews)) {
        interviews.forEach((inv) => {
          const invDateStr = inv.scheduled_at || inv.created_at;
          if (invDateStr) {
            try {
              const d = new Date(invDateStr);
              if (!isNaN(d.getTime())) {
                dynamicEvents.push({
                  id: `live-inv-${inv.id}`,
                  date: formatDateToIso(d),
                  time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                  title: `${inv.role_title || 'Contract Role'} Interview`,
                  subtitle: `${inv.candidate_name || 'Candidate'} • ${inv.round_name || 'Interview Round'}`,
                  category: 'interview',
                  status: inv.status || 'Upcoming',
                  statusType: 'blue',
                });
              }
            } catch {
              // ignore parse errors
            }
          }
        });
      }

      if (Array.isArray(requisitions)) {
        requisitions.forEach((req) => {
          if (req.created_at) {
            try {
              const d = new Date(req.created_at);
              if (!isNaN(d.getTime())) {
                dynamicEvents.push({
                  id: `live-req-${req.id}`,
                  date: formatDateToIso(d),
                  time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                  title: `Requisition: ${req.title || 'Role'}`,
                  subtitle: req.department || 'General',
                  category: 'requisition',
                  status: req.status || 'Published',
                  statusType: 'green',
                });
              }
            } catch {
              // ignore parse errors
            }
          }
        });
      }

      if (dynamicEvents.length > 0) {
        setAllEvents((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const toAdd = dynamicEvents.filter((e) => !existingIds.has(e.id));
          return [...prev, ...toAdd];
        });
      }
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [isOpen, token]);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Compute Calendar Month Grid
  const calendarGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Prev month overflow days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      days.push({
        dayNumber: dayNum,
        date: prevDate,
        dateIso: formatDateToIso(prevDate),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const curDate = new Date(year, month, i);
      days.push({
        dayNumber: i,
        date: curDate,
        dateIso: formatDateToIso(curDate),
        isCurrentMonth: true,
      });
    }

    // Next month overflow days (up to 35 or 42 cells)
    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({
        dayNumber: i,
        date: nextDate,
        dateIso: formatDateToIso(nextDate),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentDate]);

  // Event dots lookup by date ISO: { '2026-10-06': { interview: true, requisition: true, meeting: true, other: true } }
  const eventsByDate = useMemo(() => {
    const map = {};
    allEvents.forEach((evt) => {
      if (!map[evt.date]) {
        map[evt.date] = { interview: 0, requisition: 0, meeting: 0, other: 0, items: [] };
      }
      map[evt.date][evt.category] = (map[evt.date][evt.category] || 0) + 1;
      map[evt.date].items.push(evt);
    });
    return map;
  }, [allEvents]);

  // Selected date ISO
  const selectedDateIso = useMemo(() => formatDateToIso(selectedDate), [selectedDate]);

  // Events for currently selected date
  const selectedDateEvents = useMemo(() => {
    return allEvents.filter((evt) => evt.date === selectedDateIso);
  }, [allEvents, selectedDateIso]);

  // Group selected date events by category
  const groupedEvents = useMemo(() => {
    const interviews = selectedDateEvents.filter((e) => e.category === 'interview');
    const requisitions = selectedDateEvents.filter((e) => e.category === 'requisition');
    const meetings = selectedDateEvents.filter((e) => e.category === 'meeting');
    const other = selectedDateEvents.filter((e) => e.category === 'other');
    return { interviews, requisitions, meetings, other };
  }, [selectedDateEvents]);

  // Navigation Handlers
  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handlePrevDay = () => {
    setSelectedDate((prev) => {
      const next = new Date(prev.getTime() - 86400000);
      if (next.getMonth() !== currentDate.getMonth()) {
        setCurrentDate(new Date(next.getFullYear(), next.getMonth(), 1));
      }
      return next;
    });
  };

  const handleNextDay = () => {
    setSelectedDate((prev) => {
      const next = new Date(prev.getTime() + 86400000);
      if (next.getMonth() !== currentDate.getMonth()) {
        setCurrentDate(new Date(next.getFullYear(), next.getMonth(), 1));
      }
      return next;
    });
  };

  const handleJumpToToday = () => {
    const today = new Date(2026, 9, 6); // Anchored to system Oct 2026
    setSelectedDate(today);
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/45 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-[0_24px_64px_rgba(0,0,0,0.18)] border border-black/[0.06] overflow-hidden flex flex-col lg:flex-row text-left animate-in zoom-in-95 duration-200 max-h-[92vh]"
        style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top-Right Modal Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-7.5 h-7.5 rounded-full bg-white/80 hover:bg-gray-100 text-gray-400 hover:text-black flex items-center justify-center transition-colors cursor-pointer shadow-3xs"
          title="Close Calendar"
        >
          <X size={15} />
        </button>

        {/* ── LEFT COLUMN: Calendar Grid, Month Selector & Legend ── */}
        <div className="flex-1 lg:max-w-[56%] p-5 sm:p-6 flex flex-col justify-between overflow-y-auto">
          {/* Header Row: Title & Month/Week/Day Switcher */}
          <div>
            <div className="flex items-center justify-between gap-3 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8.5 h-8.5 rounded-xl bg-gray-100 flex items-center justify-center text-gray-800 shrink-0">
                  <CalendarIcon size={17} strokeWidth={2.2} />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">Calendar</h2>
                  <p className="text-[11px] text-gray-500 font-normal">
                    View your interviews, meetings and important events
                  </p>
                </div>
              </div>

              {/* Month / Week / Day segmented toggle */}
              <div className="bg-gray-100/90 p-0.5 rounded-full flex items-center text-[11px] font-semibold shrink-0">
                {['Month', 'Week', 'Day'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
                      viewMode === mode
                        ? 'bg-black text-white shadow-2xs font-bold'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Month Header Navigation */}
            <div className="flex items-center gap-3 pt-2 pb-3">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-7 h-7 rounded-lg hover:bg-gray-100 text-gray-700 flex items-center justify-center transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="text-sm sm:text-base font-extrabold text-gray-900 tracking-tight">
                {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
              </span>

              <button
                type="button"
                onClick={handleNextMonth}
                className="w-7 h-7 rounded-lg hover:bg-gray-100 text-gray-700 flex items-center justify-center transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Day of Week Labels */}
            <div className="grid grid-cols-7 text-center text-[11px] font-medium text-gray-400 py-1 mb-1">
              {DAY_NAMES.map((d) => (
                <div key={d} className="py-0.5">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Days Matrix */}
            <div className="grid grid-cols-7 gap-y-1.5 gap-x-1 text-center">
              {calendarGrid.map((cell, idx) => {
                const isSelected = cell.dateIso === selectedDateIso;
                const dateData = eventsByDate[cell.dateIso];
                const hasInterviews = Boolean(dateData?.interview);
                const hasRequisitions = Boolean(dateData?.requisition);
                const hasMeetings = Boolean(dateData?.meeting);
                const hasOther = Boolean(dateData?.other);

                return (
                  <div key={idx} className="flex flex-col items-center justify-start h-12 py-0.5">
                    {cell.isCurrentMonth ? (
                      <button
                        type="button"
                        onClick={() => setSelectedDate(cell.date)}
                        className={`w-8.5 transition-all cursor-pointer flex flex-col items-center justify-center ${
                          isSelected
                            ? 'h-11 rounded-xl bg-zinc-900 text-white shadow-xs scale-105'
                            : 'h-8.5 rounded-xl hover:bg-gray-100 text-gray-800'
                        }`}
                      >
                        <span className={`text-xs sm:text-[13px] font-semibold leading-none ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                          {cell.dayNumber}
                        </span>

                        {/* Event Dot Indicators */}
                        <div className="flex items-center justify-center gap-0.5 mt-1 h-1.5">
                          {isSelected ? (
                            // On selected black card, show white/light dots matching design
                            <div className="flex items-center gap-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-white/90" />
                              <span className="w-1.5 h-1.5 rounded-full bg-white/90" />
                            </div>
                          ) : (
                            // On normal day, display category colored dots
                            <>
                              {hasInterviews && <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />}
                              {hasRequisitions && <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />}
                              {hasMeetings && <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />}
                              {hasOther && <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />}
                            </>
                          )}
                        </div>
                      </button>
                    ) : (
                      // Outside current month day number
                      <div className="w-8.5 h-8 flex items-center justify-center text-gray-300 text-xs sm:text-[13px] font-normal select-none">
                        {cell.dayNumber}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Category Legend */}
          <div className="flex items-center gap-4 sm:gap-5 pt-4 mt-4 border-t border-gray-100 text-[11px] font-medium text-gray-600 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
              <span>Interviews</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#10B981]" />
              <span>Requisitions</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
              <span>Meetings</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
              <span>Other</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Selected Date Schedule & Action Cards ── */}
        <div className="flex-1 lg:max-w-[44%] bg-gray-50/70 p-5 sm:p-6 border-t lg:border-t-0 lg:border-l border-gray-100 flex flex-col justify-between overflow-y-auto">
          <div>
            {/* Right Header: Selected Date, Today Pill, Arrow controls */}
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-gray-200/70">
              <h3 className="text-sm sm:text-base font-extrabold text-gray-900 tracking-tight">
                {formatDisplayDate(selectedDate)}
              </h3>

              <div className="flex items-center gap-1.5 pr-8">
                <button
                  type="button"
                  onClick={handleJumpToToday}
                  className="px-2.5 py-0.5 rounded-full bg-white hover:bg-gray-100 border border-gray-200 text-xs font-semibold text-gray-700 transition-colors shadow-3xs cursor-pointer"
                >
                  Today
                </button>

                <button
                  type="button"
                  onClick={handlePrevDay}
                  className="w-6 h-6 rounded-md hover:bg-gray-200/60 text-gray-500 hover:text-black flex items-center justify-center transition-colors cursor-pointer"
                  title="Previous Day"
                >
                  <ChevronLeft size={14} />
                </button>

                <button
                  type="button"
                  onClick={handleNextDay}
                  className="w-6 h-6 rounded-md hover:bg-gray-200/60 text-gray-500 hover:text-black flex items-center justify-center transition-colors cursor-pointer"
                  title="Next Day"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Categorized Schedule List */}
            <div className="space-y-4 pt-3">
              {/* 1. Interviews Category */}
              {groupedEvents.interviews.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-gray-900">Interviews</span>
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-200/80 px-1.5 py-0.2 rounded-full">
                      {groupedEvents.interviews.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {groupedEvents.interviews.map((evt) => (
                      <div
                        key={evt.id}
                        className="p-2.5 sm:p-3 rounded-2xl bg-white border border-gray-100 shadow-2xs hover:shadow-xs hover:border-gray-200 transition-all flex items-center justify-between gap-2.5 cursor-pointer"
                        onClick={() => navigate('/interview/staff/portal')}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
                            <User size={14} />
                          </div>
                          <div className="text-[11px] font-semibold text-gray-400 shrink-0 w-15">
                            {evt.time}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-gray-900 truncate leading-tight">
                              {evt.title}
                            </div>
                            <div className="text-[10px] text-gray-500 truncate mt-0.5">
                              {evt.subtitle}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-600 border border-sky-100">
                            {evt.status}
                          </span>
                          <ChevronRight size={13} className="text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Requisitions Category */}
              {groupedEvents.requisitions.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-gray-900">Requisitions</span>
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-200/80 px-1.5 py-0.2 rounded-full">
                      {groupedEvents.requisitions.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {groupedEvents.requisitions.map((evt) => (
                      <div
                        key={evt.id}
                        className="p-2.5 sm:p-3 rounded-2xl bg-white border border-gray-100 shadow-2xs hover:shadow-xs hover:border-gray-200 transition-all flex items-center justify-between gap-2.5 cursor-pointer"
                        onClick={() => navigate('/dashboard/requisitions')}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
                            <FileText size={14} />
                          </div>
                          <div className="text-[11px] font-semibold text-gray-400 shrink-0 w-15">
                            {evt.time}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-gray-900 truncate leading-tight">
                              {evt.title}
                            </div>
                            <div className="text-[10px] text-gray-500 truncate mt-0.5">
                              {evt.subtitle}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            {evt.status}
                          </span>
                          <ChevronRight size={13} className="text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Meetings Category */}
              {groupedEvents.meetings.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-gray-900">Meetings</span>
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-200/80 px-1.5 py-0.2 rounded-full">
                      {groupedEvents.meetings.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {groupedEvents.meetings.map((evt) => (
                      <div
                        key={evt.id}
                        className="p-2.5 sm:p-3 rounded-2xl bg-white border border-gray-100 shadow-2xs hover:shadow-xs hover:border-gray-200 transition-all flex items-center justify-between gap-2.5 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
                            <CalendarIcon size={14} />
                          </div>
                          <div className="text-[11px] font-semibold text-gray-400 shrink-0 w-15">
                            {evt.time}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-gray-900 truncate leading-tight">
                              {evt.title}
                            </div>
                            <div className="text-[10px] text-gray-500 truncate mt-0.5">
                              {evt.subtitle}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                            {evt.status}
                          </span>
                          <ChevronRight size={13} className="text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Other Category */}
              {groupedEvents.other.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-gray-900">Other</span>
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-200/80 px-1.5 py-0.2 rounded-full">
                      {groupedEvents.other.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {groupedEvents.other.map((evt) => (
                      <div
                        key={evt.id}
                        className="p-2.5 sm:p-3 rounded-2xl bg-white border border-gray-100 shadow-2xs hover:shadow-xs hover:border-gray-200 transition-all flex items-center justify-between gap-2.5 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
                            <Phone size={14} />
                          </div>
                          <div className="text-[11px] font-semibold text-gray-400 shrink-0 w-15">
                            {evt.time}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-gray-900 truncate leading-tight">
                              {evt.title}
                            </div>
                            <div className="text-[10px] text-gray-500 truncate mt-0.5">
                              {evt.subtitle}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100">
                            {evt.status}
                          </span>
                          <ChevronRight size={13} className="text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state for days with no events */}
              {selectedDateEvents.length === 0 && (
                <div className="py-12 text-center flex flex-col items-center justify-center gap-2 text-gray-400">
                  <div className="w-10 h-10 rounded-2xl bg-gray-100/90 flex items-center justify-center text-gray-400">
                    <Clock size={18} />
                  </div>
                  <div className="text-xs font-bold text-gray-600">No events scheduled</div>
                  <div className="text-[11px] text-gray-400 max-w-[200px]">
                    No interviews, meetings, or requisition deadlines for this day.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
