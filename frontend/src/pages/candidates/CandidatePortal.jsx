import { useEffect, useState, useMemo, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import {
  Briefcase, Hash, LogOut, Check, Flag, Clock, Calendar,
  ChevronRight, ArrowRight, AlertCircle, FileText, CheckCircle2,
  Sparkles, Save, Send, RefreshCw, UserCheck, MapPin, User, Info,
  Home, IndianRupee, Layers, CheckSquare, Shield, HelpCircle,
  TrendingUp, PlayCircle, Bell, ChevronLeft, RotateCcw, Wand2,
  Plus, Minus, StickyNote, Lock, CheckCircle, AlertTriangle, Upload,
  X, CheckCheck, Menu, Building, UserCheck2, Compass
} from 'lucide-react';

// Dynamic 7-day initial generator strictly respecting assignment start date and today
const generateInitialSevenDays = () => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const assignmentStartStr = '2026-08-25';
  
  // Calculate Monday of current week
  const dayOfWeek = now.getDay(); // 0: Sun, 1: Mon, ...
  const diffToMon = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon);

  const daysLabels = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const entries = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const isWeekend = i >= 5;
    const isFuture = dateStr > todayStr;
    const isBeforeStart = dateStr < assignmentStartStr;
    
    // Only set hours if date >= start date, <= today, and not weekend
    const hrs = (!isWeekend && !isFuture && !isBeforeStart) ? 8.0 : 0.0;

    entries.push({
      day: daysLabels[i],
      day_number: String(d.getDate()).padStart(2, '0'),
      date: dateStr,
      hours: hrs,
      category: isWeekend ? 'Weekend' : 'Regular',
      note: '',
      task: '',
    });
  }
  return entries;
};

// AI Assistant Dashboard Guide & Suggestions
const AI_SUGGESTIONS = [
  {
    question: 'How do I log and submit my weekly hours?',
    answer:
      'Go to the Timesheet tab. Days from your assignment start date (25 Aug) up to today are unlocked. Use the 0.5h stepper (+ / -) to record hours, select category (Regular / Overtime), and click "Confirm & Submit" when done.',
    actionTab: 'timesheet',
    actionLabel: 'Go to Timesheet',
  },
  {
    question: 'How do I claim travel or project expenses?',
    answer:
      'Go to the Expenses tab. Select an expense date within your active assignment up to today, pick a category (Travel, Meals, Equipment), enter the amount in ?, attach receipts, and submit for manager approval.',
    actionTab: 'expenses',
    actionLabel: 'Go to Expenses',
  },
  {
    question: 'How does the Time Capture meter work?',
    answer:
      'The donut meter calculates your logged hours against the standard 40h weekly expectation. As you record hours on active workdays, the meter dynamically reflects your completion percentage.',
    actionTab: 'dashboard',
    actionLabel: 'View Dashboard',
  },
  {
    question: 'How is monthly Attendance calculated?',
    answer:
      'Attendance tracks your Present Days, Approved Leaves, and Client Holidays for August 2026 to ensure 100% accurate payroll computation.',
    actionTab: 'attendance',
    actionLabel: 'Check Attendance',
  },
  {
    question: 'What if I face an onboarding or equipment blocker?',
    answer:
      'Click the "Raise Issue" button in the sidebar. Select your problem category (Access, Hardware, Training) and submit details directly to operations.',
    actionTab: null,
    actionLabel: null,
  },
];

export default function CandidatePortal() {
  const { user, token, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Navigation tab state: 'dashboard' | 'assignment' | 'timesheet' | 'attendance' | 'expenses'
  const [activeTab, setActiveTab] = useState(() => {
    if (location.pathname.includes('/assignment')) return 'assignment';
    if (location.pathname.includes('/timesheet')) return 'timesheet';
    if (location.pathname.includes('/attendance')) return 'attendance';
    if (location.pathname.includes('/expenses')) return 'expenses';
    return 'dashboard';
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [currentTimesheet, setCurrentTimesheet] = useState(null);
  const [timesheetHistory, setTimesheetHistory] = useState([]);
  const [showRaiseIssue, setShowRaiseIssue] = useState(false);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [aiSelectedTopic, setAiSelectedTopic] = useState(null);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [submittingTs, setSubmittingTs] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [timesheetMsg, setTimesheetMsg] = useState({ type: '', text: '' });
  
  // Note editing modal
  const [activeNoteDay, setActiveNoteDay] = useState(null);
  const [tempNoteText, setTempNoteText] = useState('');

  // Daily entries initialized with real hours respecting start date
  const [dailyEntries, setDailyEntries] = useState(generateInitialSevenDays);

  // Attendance state
  const [selectedMonth, setSelectedMonth] = useState('2026-08');
  const [attendanceData, setAttendanceData] = useState({
    present_days: 0,
    paid_leave_days: 0,
    client_holidays: 0,
    payable_days: 0.0,
    daily_records: [
      { date: '25 Aug', day: 'Tuesday', status: 'Pending', note: 'Assignment start' },
      { date: '26 Aug', day: 'Wednesday', status: 'Pending', note: 'Regular' },
      { date: '27 Aug', day: 'Thursday', status: 'Pending', note: 'Regular' },
      { date: '28 Aug', day: 'Friday', status: 'Pending', note: 'Regular' },
    ],
  });

  // Expense State
  const [expenseForm, setExpenseForm] = useState({
    date: '2026-08-25',
    category: 'Travel',
    amount: '',
    receipt_name: '',
    description: '',
  });
  const [expensesList, setExpensesList] = useState([]);
  const [expenseTotalThisMonth, setExpenseTotalThisMonth] = useState(0);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [expenseFeedback, setExpenseFeedback] = useState({ type: '', text: '' });

  // Auto-dismiss feedback banners after 4 seconds
  useEffect(() => {
    if (timesheetMsg.text) {
      const timer = setTimeout(() => {
        setTimesheetMsg({ type: '', text: '' });
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [timesheetMsg.text]);

  useEffect(() => {
    if (expenseFeedback.text) {
      const timer = setTimeout(() => {
        setExpenseFeedback({ type: '', text: '' });
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [expenseFeedback.text]);

  // Clear lingering banners when switching tabs
  useEffect(() => {
    setTimesheetMsg({ type: '', text: '' });
    setExpenseFeedback({ type: '', text: '' });
  }, [activeTab]);

  // Notifications State & Dropdown
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState('all'); // 'all' | 'unread'
  const [notifications, setNotifications] = useState([
    {
      id: 'notif_1',
      title: 'Assignment Starts Today',
      message: 'Your DevOps Engineer assignment at Bearitt begins on 25 Aug 2026. Review work order & workspace access.',
      category: 'assignment',
      timestamp_label: 'Today · 10:30 AM',
      is_read: false,
      target_tab: 'assignment',
    },
    {
      id: 'notif_2',
      title: 'Timesheet Cycle Active',
      message: 'Weekly timesheet cycle (24–30 Aug) is active. Daily time capture is now available from 25 Aug.',
      category: 'timesheet',
      timestamp_label: 'Today · 09:00 AM',
      is_read: false,
      target_tab: 'timesheet',
    },
    {
      id: 'notif_3',
      title: 'Onboarding Clearance Complete',
      message: 'Background verification, identity KYC, and NDA compliance completed successfully.',
      category: 'compliance',
      timestamp_label: 'Yesterday',
      is_read: true,
      target_tab: 'dashboard',
    },
    {
      id: 'notif_4',
      title: 'Work Order Confirmed',
      message: 'Bridgeon confirmed onboarding paperwork and work order WO-2026-00124.',
      category: 'contract',
      timestamp_label: '22 Aug 2026',
      is_read: true,
      target_tab: 'assignment',
    },
  ]);
  const notifRef = useRef(null);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (notificationFilter === 'unread') {
      return notifications.filter((n) => !n.is_read);
    }
    return notifications;
  }, [notifications, notificationFilter]);

  // Click outside to close notification panel
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  if (!user) return <Navigate to="/candidate/login" replace />;
  if (user.role !== 'Candidate') return <Navigate to="/" replace />;

  const candidateId = user.candidate_id || '';

  // Today's ISO date string
  const todayStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }, []);

  // Dynamic candidate assignment start & end dates from work order or default
  const assignmentStartStr = useMemo(() => {
    if (data?.work_order?.start_date_iso) return data.work_order.start_date_iso;
    if (data?.work_order?.start_date) {
      const parsed = new Date(data.work_order.start_date);
      if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    }
    return '2026-08-25';
  }, [data]);

  const assignmentEndStr = useMemo(() => {
    if (data?.work_order?.end_date_iso) return data.work_order.end_date_iso;
    if (data?.work_order?.end_date) {
      const parsed = new Date(data.work_order.end_date);
      if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    }
    return '2027-02-25';
  }, [data]);

  useEffect(() => {
    loadDashboardData();
    loadNotifications();
  }, [token, candidateId]);

  // Redirect uncompleted candidates to onboarding screen
  useEffect(() => {
    if (data && data.candidate && data.candidate.onboarding_status !== 'completed') {
      navigate('/candidate/onboarding', { replace: true });
    }
  }, [data, navigate]);

  useEffect(() => {
    if (activeTab === 'attendance') {
      loadAttendance(selectedMonth);
    } else if (activeTab === 'expenses') {
      loadExpenses();
    }
  }, [activeTab, selectedMonth, token]);

  async function loadNotifications() {
    try {
      const res = await request('/api/candidate-portal/notifications', { token });
      if (res?.notifications) {
        setNotifications(res.notifications);
      }
    } catch (err) {
      /* ignore */
    }
  }

  async function handleMarkSingleRead(notifId) {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
    );
    try {
      await request(`/api/candidate-portal/notifications/${notifId}/read`, {
        method: 'POST',
        token,
      });
    } catch (err) {
      /* ignore */
    }
  }

  async function handleMarkAllRead() {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await request('/api/candidate-portal/notifications/mark-all-read', {
        method: 'POST',
        token,
      });
    } catch (err) {
      /* ignore */
    }
  }

  const handleNotificationClick = (notif) => {
    handleMarkSingleRead(notif.id);
    if (notif.target_tab) {
      setActiveTab(notif.target_tab);
    }
    setShowNotifications(false);
  };

  async function loadAttendance(monthStr) {
    try {
      const res = await request(`/api/candidate-portal/attendance?month=${monthStr}`, { token });
      if (res?.attendance) {
        setAttendanceData(res.attendance);
      }
    } catch (err) {
      /* fallback to state */
    }
  }

  async function loadExpenses() {
    try {
      const res = await request('/api/candidate-portal/expenses', { token });
      if (res?.expenses) {
        // Filter strictly valid dates: >= start date and <= today
        const validExpenses = res.expenses.filter((e) => {
          const dt = e.date || '';
          return dt >= assignmentStartStr && dt <= todayStr;
        });
        setExpensesList(validExpenses);
        const validSum = validExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
        setExpenseTotalThisMonth(validSum);
      }
    } catch (err) {
      /* fallback to state */
    }
  }

  async function loadDashboardData() {
    setError('');
    try {
      // Primary essential dashboard data
      const [dash, curTs] = await Promise.all([
        request('/api/candidate-portal/dashboard', { token }).catch(() => null),
        request('/api/candidate-portal/timesheet/current', { token }).catch(() => null),
      ]);

      if (dash) setData(dash);
      if (curTs?.timesheet) {
        setCurrentTimesheet(curTs.timesheet);
        if (curTs.timesheet.daily_entries && curTs.timesheet.daily_entries.length === 7) {
          setDailyEntries(curTs.timesheet.daily_entries);
        }
      }
      if (dash?.recent_timesheets && dash.recent_timesheets.length > 0) {
        setTimesheetHistory(dash.recent_timesheets);
      }

      // Asynchronously fetch supplementary expenses and attendance in background without blocking UI
      request('/api/candidate-portal/expenses', { token })
        .then((expRes) => {
          if (expRes?.expenses) {
            const validExpenses = expRes.expenses.filter((e) => {
              const dt = e.date || '';
              return dt >= assignmentStartStr && dt <= todayStr;
            });
            setExpensesList(validExpenses);
            const validSum = validExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
            setExpenseTotalThisMonth(validSum);
          }
        })
        .catch(() => {});

      request('/api/candidate-portal/attendance?month=2026-08', { token })
        .then((attRes) => {
          if (attRes?.attendance) setAttendanceData(attRes.attendance);
        })
        .catch(() => {});
    } catch (err) {
      setError(err.message || 'Failed to load candidate portal data.');
    }
  }

  // Handle Expense Submit with strict Date Window Validation
  const handleExpenseSubmit = async (status = 'Pending') => {
    const amt = parseFloat(expenseForm.amount);
    if (isNaN(amt) || amt <= 0) {
      setExpenseFeedback({ type: 'error', text: 'Please enter a valid expense amount greater than ₹0.' });
      return;
    }

    const expDate = expenseForm.date || assignmentStartStr;
    
    // Strict Date Boundary Validation
    if (expDate < assignmentStartStr) {
      setExpenseFeedback({
        type: 'error',
        text: `Expense date cannot be before your assignment start date (${assignmentStartStr}).`,
      });
      return;
    }

    if (expDate > todayStr) {
      setExpenseFeedback({
        type: 'error',
        text: `Cannot submit expenses for future dates (${expDate}). Expenses can only be logged up to today.`,
      });
      return;
    }

    setSubmittingExpense(true);
    setExpenseFeedback({ type: '', text: '' });
    try {
      const res = await request('/api/candidate-portal/expenses', {
        method: 'POST',
        token,
        body: {
          date: expDate,
          category: expenseForm.category || 'Travel',
          amount: amt,
          receipt_name: expenseForm.receipt_name || 'receipt.pdf',
          description: expenseForm.description || '',
          status,
        },
      });
      setExpenseFeedback({
        type: 'success',
        text: status === 'Draft' ? 'Expense saved as draft.' : 'Expense submitted for manager approval!',
      });
      setExpenseForm({
        date: assignmentStartStr,
        category: 'Travel',
        amount: '',
        receipt_name: '',
        description: '',
      });
      loadExpenses();
    } catch (err) {
      setExpenseFeedback({ type: 'error', text: err.message || 'Failed to submit expense.' });
    } finally {
      setSubmittingExpense(false);
    }
  };

  // Greeting helper
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Calculate live timesheet metrics strictly from dailyEntries sum
  const calculatedMetrics = useMemo(() => {
    let reg = 0;
    let ot = 0;
    const expected = 40;

    dailyEntries.forEach((e) => {
      const hrs = Number(e.hours) || 0;
      if (e.category === 'Overtime') {
        ot += hrs;
      } else if (hrs > 8) {
        reg += 8;
        ot += (hrs - 8);
      } else {
        reg += hrs;
      }
    });

    const total = reg + ot;
    let statusFlag = 'INCOMPLETE';
    let badgeText = total === 0 ? '0h logged' : 'Incomplete hours';
    let summaryText = `Total logged is ${total}h (${expected - total}h remaining for this week).`;

    if (total === expected) {
      statusFlag = 'LOOKS_GOOD';
      badgeText = 'Looks good';
      summaryText = 'Your total hours match the expected weekly hours.';
    } else if (total > expected) {
      statusFlag = 'OVERTIME';
      badgeText = 'Overtime logged';
      summaryText = `Total logged is ${total}h (${total - expected}h overtime entered).`;
    }

    return {
      regularHours: reg,
      overtimeHours: ot,
      totalHours: total,
      expectedHours: expected,
      statusFlag,
      badgeText,
      summaryText,
    };
  }, [dailyEntries]);

  // Stepper handlers
  const handleHourChange = (dayIndex, newHours) => {
    const entry = dailyEntries[dayIndex];
    if (!entry) return;
    
    // Future date lock check
    if (entry.date && entry.date > todayStr) {
      setTimesheetMsg({
        type: 'error',
        text: `Cannot mark or change hours for future date (${entry.date}). Attendance can only be logged up to today.`,
      });
      return;
    }

    // Pre-start date lock check
    if (entry.date && entry.date < assignmentStartStr) {
      setTimesheetMsg({
        type: 'error',
        text: `Assignment starts on ${assignmentStartStr}. Cannot log hours for pre-assignment date (${entry.date}).`,
      });
      return;
    }

    const clamped = Math.max(0, Math.min(24, Math.round(newHours * 2) / 2));
    const updated = [...dailyEntries];
    updated[dayIndex] = {
      ...entry,
      hours: clamped,
    };
    setDailyEntries(updated);
  };

  const handleCategoryChange = (dayIndex, category) => {
    const entry = dailyEntries[dayIndex];
    if (!entry) return;

    if (entry.date && entry.date > todayStr) {
      setTimesheetMsg({
        type: 'error',
        text: `Cannot change attendance category for a future date (${entry.date}).`,
      });
      return;
    }

    const updated = [...dailyEntries];
    updated[dayIndex] = {
      ...entry,
      category,
      hours: category === 'Weekend' ? 0 : (entry.hours === 0 ? 8 : entry.hours),
    };
    setDailyEntries(updated);
  };

  // Restore Usual Week
  const handleRestoreUsualWeek = () => {
    const updated = dailyEntries.map((e, idx) => {
      const isFuture = e.date && e.date > todayStr;
      const isBeforeStart = e.date && e.date < assignmentStartStr;
      if (isFuture || isBeforeStart || idx >= 5) {
        return { ...e, hours: 0.0, category: idx >= 5 ? 'Weekend' : 'Regular' };
      }
      return {
        ...e,
        hours: 8.0,
        category: 'Regular',
      };
    });
    setDailyEntries(updated);
    setTimesheetMsg({ type: 'success', text: 'Restored standard working pattern for active workdays!' });
  };

  // Apply to all workdays
  const handleApplyToAllWorkdays = () => {
    const updated = dailyEntries.map((e, idx) => {
      const isFuture = e.date && e.date > todayStr;
      const isBeforeStart = e.date && e.date < assignmentStartStr;
      if (idx < 5 && !isFuture && !isBeforeStart) {
        return { ...e, hours: 8.0, category: 'Regular' };
      }
      return e;
    });
    setDailyEntries(updated);
    setTimesheetMsg({ type: 'success', text: 'Applied 8h standard workday pattern to active days.' });
  };

  // Note Modal Save
  const handleSaveNote = () => {
    if (activeNoteDay === null) return;
    const updated = [...dailyEntries];
    updated[activeNoteDay] = {
      ...updated[activeNoteDay],
      note: tempNoteText,
    };
    setDailyEntries(updated);
    setActiveNoteDay(null);
    setTempNoteText('');
  };

  // Save Draft
  const handleSaveDraft = async () => {
    setSavingDraft(true);
    setTimesheetMsg({ type: '', text: '' });
    try {
      const res = await request('/api/candidate-portal/timesheets/draft', {
        method: 'POST',
        token,
        body: {
          id: currentTimesheet?.id || 'ts_curr_draft',
          week_start_date: currentTimesheet?.week_start_date || '2026-08-24',
          week_end_date: currentTimesheet?.week_end_date || '2026-08-30',
          period_label: currentTimesheet?.period_label || '24 – 30 August 2026',
          daily_entries: dailyEntries,
        },
      });
      if (res.timesheet) setCurrentTimesheet(res.timesheet);
      setTimesheetMsg({ type: 'success', text: 'Timesheet draft saved successfully!' });
    } catch (err) {
      setTimesheetMsg({ type: 'error', text: err.message || 'Failed to save timesheet draft.' });
    } finally {
      setSavingDraft(false);
    }
  };

  // Submit timesheet
  const handleConfirmSubmit = async () => {
    setSubmittingTs(true);
    setTimesheetMsg({ type: '', text: '' });
    try {
      const res = await request('/api/candidate-portal/timesheets/submit', {
        method: 'POST',
        token,
        body: {
          id: currentTimesheet?.id || 'ts_curr_draft',
          week_start_date: currentTimesheet?.week_start_date || '2026-08-24',
          week_end_date: currentTimesheet?.week_end_date || '2026-08-30',
          period_label: currentTimesheet?.period_label || '24 – 30 August 2026',
          daily_entries: dailyEntries,
        },
      });
      if (res.timesheet) setCurrentTimesheet(res.timesheet);
      setTimesheetMsg({ type: 'success', text: 'Timesheet submitted for manager approval!' });
      loadDashboardData();
    } catch (err) {
      setTimesheetMsg({ type: 'error', text: err.message || 'Failed to submit timesheet.' });
    } finally {
      setSubmittingTs(false);
    }
  };

  // Dynamic candidate & work order fallback
  const cand = data?.candidate || {
    name: user.name || 'Sreehari P S',
    first_name: (user.name || 'Sreehari').split(' ')[0],
    id: candidateId || 'BEAR-c7a70f8a',
    company: 'Bearitt',
    vendor: 'Bridgeon',
    requisition_title: 'DevOps Engineer',
    status: 'ACTIVE',
    active_badge: 'Active candidate',
  };

  const wo = data?.work_order || {
    work_order_number: 'WO-2026-00124',
    requisition_title: cand.requisition_title || 'DevOps Engineer',
    company_name: cand.company || 'Bearitt',
    vendor_name: cand.vendor || 'Bridgeon',
    start_date: '25 Aug 2026',
    end_date: '25 Feb 2027',
    weekly_hours: 40,
    location: 'Bangalore',
    work_arrangement: 'Hybrid',
    reporting_manager: 'Arun Deshpande',
    overtime_policy: 'Allowed',
    engagement_type: 'Contractor',
    status: 'ACTIVE',
  };

  const kpis = data?.kpi_stats || {
    assignment: { label: 'ASSIGNMENT', value: 'ACTIVE', subtext: wo.work_order_number || 'WO-2026-00124' },
    this_week: { label: 'THIS WEEK', value: `${calculatedMetrics.totalHours}h`, subtext: 'of 40 expected' },
    timesheet: { label: 'TIMESHEET', value: '1', subtext: 'action required' },
    expenses: { label: 'EXPENSES', value: `₹${expenseTotalThisMonth.toLocaleString()}`, subtext: 'this month' },
  };

  const timeCap = data?.time_capture || {
    progress_pct: Math.min(100, Math.round((calculatedMetrics.totalHours / 40) * 100)),
    logged_hours: calculatedMetrics.totalHours,
    expected_hours: 40,
    week_range: '24–30 Aug',
    daily_entries: dailyEntries.slice(0, 5).map((e) => ({
      day: e.day,
      hours: e.hours,
      label: e.hours > 0 ? `${e.hours}h` : 'Action needed',
      status: e.hours > 0 ? 'logged' : 'action_needed',
    })),
  };

  const snapshot = data?.assignment_snapshot || {
    work_arrangement: 'Hybrid',
    weekly_expectation: '40h',
    overtime: 'Allowed',
    engagement: 'Contractor',
  };

  const smartActions = data?.smart_actions || {
    ai_title: 'Time Assistant',
    ai_desc: 'Use your work pattern and previous entries to prepare your timesheet. You only confirm the final hours.',
  };

  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timeCap.progress_pct / 100) * circumference;

  return (
    <div
      style={{
        backgroundColor: '#ECECE9',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: '#0A0A0A',
        overscrollBehavior: 'none',
        overscrollBehaviorY: 'none',
      }}
      className="fixed inset-0 w-screen h-screen flex p-3 md:p-5 gap-4 antialiased overflow-hidden select-none"
    >
      {/* Scrollbar-hide and overscroll lock styles */}
      <style>{`
        html, body, #root {
          background-color: #ECECE9 !important;
          overscroll-behavior: none !important;
          overscroll-behavior-y: none !important;
          overflow: hidden !important;
          height: 100% !important;
          max-height: 100vh !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        ::-webkit-scrollbar {
          display: none !important;
          width: 0px !important;
          height: 0px !important;
          background: transparent !important;
        }
        * {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
        .bento-card-hover {
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .bento-card-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px -4px rgba(0, 0, 0, 0.05), 0 2px 8px -2px rgba(0, 0, 0, 0.02);
        }
        .metric-card-underline {
          position: relative !important;
          overflow: hidden !important;
          transition: border-color 0.25s ease-out, box-shadow 0.25s ease-out !important;
        }
        .metric-card-underline::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 2.5px;
          background-color: #0A0A0A;
          transform: scaleX(0);
          transform-origin: left center;
          transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
          border-bottom-left-radius: 20px;
          border-bottom-right-radius: 20px;
          pointer-events: none;
          z-index: 10;
        }
        .metric-card-underline:hover::after {
          transform: scaleX(1);
        }
        .sidebar-nav-btn {
          width: 100% !important;
          background-color: transparent !important;
          color: #737373 !important;
          font-weight: 500 !important;
          transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1) !important;
          cursor: pointer !important;
        }
        .sidebar-nav-btn:hover {
          background-color: #EAEAE6 !important;
          color: #0A0A0A !important;
          font-weight: 600 !important;
        }
        .sidebar-nav-btn.active-nav-tab {
          background-color: #0A0A0A !important;
          color: #FFFFFF !important;
          font-weight: 600 !important;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15) !important;
          position: relative !important;
          overflow: hidden !important;
        }
        .sidebar-nav-btn.active-nav-tab::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3.5px;
          height: 18px;
          background-color: #FFFFFF;
          border-radius: 0 4px 4px 0;
        }
      `}</style>

      {/* ========================================================
          LEFT SIDEBAR (STICKY/FIXED FULL HEIGHT CARD)
         ======================================================== */}
      <aside
        style={{
          width: 250,
          backgroundColor: '#FFFFFF',
          borderRadius: 24,
          border: '1px solid #E2E2DC',
          boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
        }}
        className="h-full shrink-0 flex flex-col justify-between p-5 max-lg:hidden"
      >
        <div>
          {/* Logo / Brand Header */}
          <div className="flex items-center gap-3 pb-6 border-b border-[#F0F0EC]">
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                backgroundColor: '#0A0A0A',
                color: '#FFFFFF',
              }}
              className="flex items-center justify-center font-bold text-[14px] tracking-tight shrink-0 shadow-sm"
            >
              TJ
            </div>
            <div>
              <div className="text-[14.5px] font-bold text-[#0A0A0A] leading-tight tracking-tight">Term Jobs</div>
              <div className="text-[11.5px] text-[#737373] font-medium">Candidate Portal</div>
            </div>
          </div>

          {/* Section Header */}
          <div className="pt-6 pb-2 px-2 text-[10px] font-bold tracking-[0.14em] uppercase text-[#A3A39F]">
            Workspace
          </div>

          {/* Nav Items */}
          <nav className="space-y-1.5 mt-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`sidebar-nav-btn flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] text-left ${
                activeTab === 'dashboard' ? 'active-nav-tab' : ''
              }`}
            >
              <Home size={16} strokeWidth={activeTab === 'dashboard' ? 2.4 : 2} />
              Dashboard
            </button>

            <button
              onClick={() => setActiveTab('assignment')}
              className={`sidebar-nav-btn flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] text-left ${
                activeTab === 'assignment' ? 'active-nav-tab' : ''
              }`}
            >
              <Briefcase size={16} strokeWidth={activeTab === 'assignment' ? 2.4 : 2} />
              My Assignment
            </button>

            <button
              onClick={() => setActiveTab('timesheet')}
              className={`sidebar-nav-btn flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] text-left ${
                activeTab === 'timesheet' ? 'active-nav-tab' : ''
              }`}
            >
              <Clock size={16} strokeWidth={activeTab === 'timesheet' ? 2.4 : 2} />
              Timesheet
            </button>

            <button
              onClick={() => setActiveTab('attendance')}
              className={`sidebar-nav-btn flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] text-left ${
                activeTab === 'attendance' ? 'active-nav-tab' : ''
              }`}
            >
              <CheckSquare size={16} strokeWidth={activeTab === 'attendance' ? 2.4 : 2} />
              Attendance
            </button>

            <button
              onClick={() => setActiveTab('expenses')}
              className={`sidebar-nav-btn flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] text-left ${
                activeTab === 'expenses' ? 'active-nav-tab' : ''
              }`}
            >
              <IndianRupee size={16} strokeWidth={activeTab === 'expenses' ? 2.4 : 2} />
              Expenses
            </button>

            <button
              onClick={() => setShowRaiseIssue(true)}
              className="sidebar-nav-btn flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] text-left"
            >
              <Flag size={16} strokeWidth={2} />
              Raise Issue
            </button>
          </nav>
        </div>

        {/* User Card & Logout at bottom of sidebar */}
        <div className="pt-4 border-t border-[#F0F0EC]">
          <div className="flex items-center gap-3 p-1 rounded-xl">
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                backgroundColor: '#0A0A0A',
                color: '#FFFFFF',
              }}
              className="flex items-center justify-center text-[13px] font-bold shrink-0 shadow-sm"
            >
              {(cand.name || 'S')[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-[#0A0A0A] truncate leading-tight">{cand.name}</div>
              <div className="text-[11px] text-[#737373] truncate mt-0.5">{cand.active_badge || 'Active candidate'}</div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="p-1.5 rounded-lg text-[#737373] hover:text-[#0A0A0A] hover:bg-[#F2F2EE] transition-colors"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ========================================================
          MAIN WORKSPACE CONTENT (ISOLATED OVERSCROLL)
         ======================================================== */}
      <main
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          overscrollBehavior: 'contain',
          overscrollBehaviorY: 'contain',
        }}
        className="flex-1 h-full flex flex-col min-w-0 overflow-y-auto space-y-4"
      >
        {/* Top Breadcrumb & Secure Session Bar with Interactive Notification Bell */}
        <div className="flex items-center justify-between px-2 pt-1 pb-1 relative">
          <div className="flex items-center gap-2.5">
            {/* Mobile Drawer Hamburger Button */}
            <button
              onClick={() => setShowMobileDrawer(true)}
              title="Open Navigation Menu"
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                border: '1px solid #E2E2DC',
                width: 36,
                height: 36,
              }}
              className="flex lg:hidden items-center justify-center text-[#0A0A0A] hover:bg-[#F5F5F2] shadow-sm transition-colors shrink-0"
            >
              <Menu size={18} strokeWidth={2.2} />
            </button>

            <div className="text-[12.5px] text-[#737373] font-medium tracking-tight truncate">
              <span className="font-bold text-[#0A0A0A]">{cand.company.toLowerCase()}</span> / Candidate Portal /{' '}
              <span className="text-[#0A0A0A] font-semibold capitalize">{activeTab}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 relative" ref={notifRef}>
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 9999,
                border: '1px solid #E2E2DC',
              }}
              className="px-3.5 py-1 text-[11px] font-bold tracking-wider uppercase text-[#0A0A0A] flex items-center gap-1.5 shadow-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              Secure Session
            </div>

            {/* Notification Bell Button with Real Unread Dot */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                title="Notifications"
                style={{
                  backgroundColor: showNotifications ? '#0A0A0A' : '#FFFFFF',
                  color: showNotifications ? '#FFFFFF' : '#737373',
                  borderRadius: '50%',
                  border: '1px solid #E2E2DC',
                  width: 34,
                  height: 34,
                }}
                className="flex items-center justify-center hover:text-[#0A0A0A] shadow-sm transition-all relative"
              >
                <Bell size={15} />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      backgroundColor: '#DC2626',
                      color: '#FFFFFF',
                      fontSize: '9.5px',
                      fontWeight: 800,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 9999,
                      border: '2px solid #FFFFFF',
                    }}
                    className="flex items-center justify-center px-1"
                  >
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Popover Flyout */}
              {showNotifications && (
                <div
                  style={{
                    position: 'absolute',
                    top: 44,
                    right: 0,
                    width: 360,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 20,
                    border: '1px solid #E2E2DC',
                    boxShadow: '0 12px 36px rgba(0,0,0,0.12)',
                    zIndex: 99999,
                  }}
                  className="overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                >
                  {/* Flyout Header */}
                  <div className="p-4 pb-3 border-b border-[#F2F2EE] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[13.5px] font-bold text-[#0A0A0A]">Notifications</h3>
                      {unreadCount > 0 && (
                        <span
                          style={{
                            backgroundColor: '#0A0A0A',
                            color: '#FFFFFF',
                            borderRadius: 9999,
                          }}
                          className="px-2 py-0.5 text-[10px] font-bold"
                        >
                          {unreadCount} new
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          className="text-[11px] font-semibold text-[#737373] hover:text-[#0A0A0A] transition-colors flex items-center gap-1"
                          title="Mark all as read"
                        >
                          <CheckCheck size={13} />
                          Mark all read
                        </button>
                      )}
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="text-[#8A8A85] hover:text-[#0A0A0A] p-0.5"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-[#FBFBFA] border-b border-[#F2F2EE]">
                    <button
                      onClick={() => setNotificationFilter('all')}
                      style={{
                        backgroundColor: notificationFilter === 'all' ? '#0A0A0A' : 'transparent',
                        color: notificationFilter === 'all' ? '#FFFFFF' : '#737373',
                        borderRadius: 9999,
                      }}
                      className="px-2.5 py-0.5 text-[11px] font-bold transition-colors"
                    >
                      All ({notifications.length})
                    </button>
                    <button
                      onClick={() => setNotificationFilter('unread')}
                      style={{
                        backgroundColor: notificationFilter === 'unread' ? '#0A0A0A' : 'transparent',
                        color: notificationFilter === 'unread' ? '#FFFFFF' : '#737373',
                        borderRadius: 9999,
                      }}
                      className="px-2.5 py-0.5 text-[11px] font-bold transition-colors"
                    >
                      Unread ({unreadCount})
                    </button>
                  </div>

                  {/* Notification Items List */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-[#F2F2EE]">
                    {filteredNotifications.length > 0 ? (
                      filteredNotifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          style={{
                            backgroundColor: notif.is_read ? '#FFFFFF' : '#F8F8F5',
                          }}
                          className="p-3.5 hover:bg-[#F2F2EE] cursor-pointer transition-colors flex items-start gap-3 relative group"
                        >
                          {!notif.is_read && (
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: '#0A0A0A',
                                position: 'absolute',
                                top: 16,
                                left: 6,
                              }}
                            />
                          )}

                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 10,
                              backgroundColor: notif.is_read ? '#F5F5F2' : '#ECECE9',
                              color: '#0A0A0A',
                            }}
                            className="flex items-center justify-center shrink-0 mt-0.5"
                          >
                            {notif.category === 'timesheet' ? (
                              <Clock size={14} />
                            ) : notif.category === 'assignment' ? (
                              <Briefcase size={14} />
                            ) : notif.category === 'compliance' ? (
                              <Shield size={14} />
                            ) : (
                              <FileText size={14} />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[12.5px] font-bold text-[#0A0A0A] truncate">
                                {notif.title}
                              </span>
                              <span className="text-[10px] text-[#8A8A85] shrink-0">
                                {notif.timestamp_label}
                              </span>
                            </div>
                            <p className="text-[11.5px] text-[#5A5A57] mt-0.5 leading-relaxed line-clamp-2">
                              {notif.message}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-[12px] text-[#8A8A85]">
                        No notifications to display.
                      </div>
                    )}
                  </div>

                  {/* Flyout Footer */}
                  <div className="p-3 bg-[#FBFBFA] border-t border-[#F2F2EE] flex items-center justify-between text-[11px] text-[#737373]">
                    <span>Workspace alerts</span>
                    <span className="font-semibold text-[#0A0A0A]">Active session</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {timesheetMsg.text && (
          <div
            className={`p-3.5 rounded-2xl text-[13px] font-medium flex items-center justify-between gap-2.5 ${
              timesheetMsg.type === 'error'
                ? 'bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B]'
                : 'bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {timesheetMsg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
              {timesheetMsg.text}
            </div>
            <button onClick={() => setTimesheetMsg({ type: '', text: '' })} className="text-[12px] opacity-70 hover:opacity-100">✕</button>
          </div>
        )}

        {/* ========================================================
            VIEW 1: DASHBOARD (MONOCHROME BENTO UI)
           ======================================================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4 pb-4">
            {/* 1. HERO WELCOME CARD */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 22,
                border: '1px solid #E2E2DC',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
              }}
              className="relative p-7 md:p-8 overflow-hidden bento-card-hover"
            >
              <div
                style={{
                  position: 'absolute',
                  right: -40,
                  top: -60,
                  width: 220,
                  height: 220,
                  borderRadius: '50%',
                  border: '1px solid #EDEDE8',
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  right: -10,
                  top: -30,
                  width: 170,
                  height: 170,
                  borderRadius: '50%',
                  border: '1px solid #F0F0EB',
                  pointerEvents: 'none',
                }}
              />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="max-w-2xl">
                  <div className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-[#8A8A85] mb-1.5">
                    Term Jobs · Active Assignment
                  </div>
                  <h1 className="text-[1.75rem] md:text-[2rem] font-extrabold text-[#0A0A0A] tracking-tight leading-tight">
                    {greeting}, {cand.first_name || cand.name}.
                  </h1>
                  <p className="text-[13px] md:text-[13.5px] text-[#5A5A57] mt-2 font-normal leading-relaxed max-w-xl">
                    Your onboarding is complete. Your assignment start date is {wo.start_date || '25 Aug 2026'}, and your workspace is ready.
                  </p>
                </div>

                <div className="text-left md:text-right shrink-0">
                  <div className="text-[1.45rem] md:text-[1.6rem] font-extrabold text-[#0A0A0A] tracking-tight">
                    {wo.start_date || '25 Aug 2026'}
                  </div>
                  <div className="text-[12px] text-[#737373] font-medium mt-0.5">Assignment starts</div>
                </div>
              </div>
            </div>

            {/* 2. FOUR KPI STAT CARDS (WITH LEFT-TO-RIGHT EXPANDING UNDERLINE HOVER EFFECT) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 20,
                  border: '1px solid #E2E2DC',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                }}
                className="p-5 flex flex-col justify-between metric-card-underline cursor-default"
              >
                <div className="text-[10px] font-bold tracking-wider uppercase text-[#8A8A85]">
                  {kpis.assignment.label}
                </div>
                <div className="my-2.5">
                  <div className="text-[1.45rem] font-extrabold text-[#0A0A0A] tracking-tight leading-none">
                    {kpis.assignment.value}
                  </div>
                </div>
                <div className="text-[11.5px] text-[#737373] font-mono">{kpis.assignment.subtext}</div>
              </div>

              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 20,
                  border: '1px solid #E2E2DC',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                }}
                className="p-5 flex flex-col justify-between metric-card-underline cursor-default"
              >
                <div className="text-[10px] font-bold tracking-wider uppercase text-[#8A8A85]">
                  {kpis.this_week.label}
                </div>
                <div className="my-2.5">
                  <div className="text-[1.45rem] font-extrabold text-[#0A0A0A] tracking-tight leading-none">
                    {kpis.this_week.value}
                  </div>
                </div>
                <div className="text-[11.5px] text-[#737373]">{kpis.this_week.subtext}</div>
              </div>

              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 20,
                  border: '1px solid #E2E2DC',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                }}
                className="p-5 flex flex-col justify-between metric-card-underline cursor-default"
              >
                <div className="text-[10px] font-bold tracking-wider uppercase text-[#8A8A85]">
                  {kpis.timesheet.label}
                </div>
                <div className="my-2.5">
                  <div className="text-[1.45rem] font-extrabold text-[#0A0A0A] tracking-tight leading-none">
                    {kpis.timesheet.value}
                  </div>
                </div>
                <div className="text-[11.5px] text-[#737373]">{kpis.timesheet.subtext}</div>
              </div>

              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 20,
                  border: '1px solid #E2E2DC',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                }}
                className="p-5 flex flex-col justify-between metric-card-underline cursor-default"
              >
                <div className="text-[10px] font-bold tracking-wider uppercase text-[#8A8A85]">
                  {kpis.expenses.label}
                </div>
                <div className="my-2.5">
                  <div className="text-[1.45rem] font-extrabold text-[#0A0A0A] tracking-tight leading-none">
                    {kpis.expenses.value}
                  </div>
                </div>
                <div className="text-[11.5px] text-[#737373]">{kpis.expenses.subtext}</div>
              </div>
            </div>

            {/* 3. MAIN SPLIT GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-8 space-y-4">
                {/* Active Assignment (COMPACT BREADTH) */}
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 22,
                    border: '1px solid #E2E2DC',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                  }}
                  className="p-5 md:p-5.5 space-y-3.5 bento-card-hover"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-[0.98rem] font-bold text-[#0A0A0A] tracking-tight">Active Assignment</h2>
                      <span
                        style={{
                          backgroundColor: '#F5F5F2',
                          border: '1px solid #E5E5E0',
                          borderRadius: 9999,
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.2 text-[9.5px] font-bold uppercase tracking-wider text-[#0A0A0A]"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0A0A0A]" />
                        ACTIVE
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveTab('assignment')}
                      className="text-[11.5px] font-semibold text-[#737373] hover:text-[#0A0A0A] transition-colors flex items-center gap-1 underline underline-offset-4"
                    >
                      View work order <ArrowRight size={11} />
                    </button>
                  </div>

                  <div>
                    <h3 className="text-[1.25rem] font-extrabold text-[#0A0A0A] tracking-tight leading-snug">
                      {wo.requisition_title || 'DevOps Engineer'}
                    </h3>
                    <div className="text-[12px] text-[#737373] font-medium mt-0.5">
                      <span>{wo.company_name || 'Bearitt'}</span> <span className="text-[#A3A39F] font-semibold mx-1">/</span> <span>{wo.vendor_name || 'Bridgeon'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#F2F2EE]">
                    <div>
                      <div className="text-[9px] font-bold tracking-wider uppercase text-[#A3A39F]">Start</div>
                      <div className="text-[12px] font-bold text-[#0A0A0A] mt-0.5">{wo.start_date || '25 Aug 2026'}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold tracking-wider uppercase text-[#A3A39F]">End</div>
                      <div className="text-[12px] font-bold text-[#0A0A0A] mt-0.5">{wo.end_date || '25 Feb 2027'}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold tracking-wider uppercase text-[#A3A39F]">Location</div>
                      <div className="text-[12px] font-bold text-[#0A0A0A] mt-0.5">{wo.location || 'Bangalore'}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold tracking-wider uppercase text-[#A3A39F]">Manager</div>
                      <div className="text-[12px] font-bold text-[#0A0A0A] mt-0.5">{wo.reporting_manager || 'Arun Deshpande'}</div>
                    </div>
                  </div>
                </div>

                {/* Time Capture (EXPANDED FULL LENGTH WORKDAY CARDS ACROSS AVAILABLE WIDTH) */}
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 22,
                    border: '1px solid #E2E2DC',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                  }}
                  className="p-5 md:p-6 space-y-4 bento-card-hover"
                >
                  {/* Top Header Row */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-[1rem] font-extrabold text-[#0A0A0A] tracking-tight">Time Capture</h2>
                    <button
                      onClick={() => setActiveTab('timesheet')}
                      className="text-[12px] font-semibold text-[#8A8A85] hover:text-[#0A0A0A] transition-colors flex items-center gap-1.5"
                    >
                      Open timesheet <ArrowRight size={12} />
                    </button>
                  </div>

                  {/* Main Horizontal Content (Circle + 8/40h on left, Expanded Workday Cards filling the right) */}
                  <div className="flex flex-col lg:flex-row items-center gap-6 pt-1">
                    {/* Left Summary: Donut Progress Meter + Big Hours Headline */}
                    <div className="flex items-center gap-3.5 shrink-0 pr-2">
                      {/* SVG Circular Progress Meter */}
                      <div className="relative w-15 h-15 shrink-0 flex items-center justify-center">
                        <svg className="w-15 h-15 -rotate-90 transform" viewBox="0 0 64 64">
                          <circle cx="32" cy="32" r={23} stroke="#EAEAE6" strokeWidth="5.5" fill="transparent" />
                          <circle
                            cx="32"
                            cy="32"
                            r={23}
                            stroke="#0A0A0A"
                            strokeWidth="5.5"
                            strokeDasharray={2 * Math.PI * 23}
                            strokeDashoffset={
                              2 * Math.PI * 23 -
                              (Math.min(100, Math.max(0, Math.round((calculatedMetrics.totalHours / 40) * 100))) / 100) *
                                (2 * Math.PI * 23)
                            }
                            strokeLinecap="round"
                            fill="transparent"
                            className="transition-all duration-700 ease-out"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                          <span className="text-[12.5px] font-extrabold text-[#0A0A0A]">
                            {calculatedMetrics.totalHours}h
                          </span>
                          <span className="text-[9px] font-medium text-[#8A8A85] mt-0.5">
                            {Math.min(100, Math.round((calculatedMetrics.totalHours / 40) * 100))}%
                          </span>
                        </div>
                      </div>

                      {/* Text Headline */}
                      <div>
                        <div className="text-[1.7rem] font-extrabold text-[#0A0A0A] tracking-tight leading-none">
                          {calculatedMetrics.totalHours} / 40h
                        </div>
                        <div className="text-[12px] text-[#8A8A85] font-medium mt-1">
                          Current week / 24-30 Aug
                        </div>
                      </div>
                    </div>

                    {/* Right: 5 Workday Cards expanded across full width without empty space */}
                    <div className="grid grid-cols-5 gap-3 w-full flex-1">
                      {dailyEntries.slice(0, 5).map((entry, dIdx) => {
                        const hrs = Number(entry.hours) || 0;
                        const isFuture = entry.date && entry.date > todayStr;
                        const isToday = entry.date === todayStr;
                        const isBeforeStart = entry.date && entry.date < assignmentStartStr;

                        return (
                          <div key={entry.day || dIdx} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                            <div
                              onClick={() => {
                                if (!isFuture) setActiveTab('timesheet');
                              }}
                              style={{
                                backgroundColor: isToday ? '#FFFFFF' : isFuture ? '#FAFAFA' : '#F9F9F7',
                                borderRadius: 16,
                                border: isToday ? '2px solid #0A0A0A' : '1px solid #E5E5E0',
                                opacity: isFuture ? 0.65 : 1,
                                cursor: isFuture ? 'not-allowed' : 'pointer',
                              }}
                              className={`relative w-full h-[62px] flex flex-col items-center justify-center gap-1 transition-all shadow-2xs ${
                                isFuture ? '' : 'hover:bg-[#F2F2EE] hover:border-[#D5D5D0]'
                              }`}
                              title={
                                isFuture
                                  ? `${entry.day} (${entry.date}) - Not reached yet`
                                  : isToday
                                  ? `Today (${entry.date}) - ${hrs}h logged`
                                  : isBeforeStart
                                  ? `Pre-assignment date (${entry.date})`
                                  : `Click to view ${entry.day} in Timesheet`
                              }
                            >
                              {/* TODAY pill pinned to top border */}
                              {isToday && (
                                <span className="absolute -top-2.5 px-2 py-0.2 text-[8px] font-extrabold uppercase tracking-wider bg-[#0A0A0A] text-[#FFFFFF] rounded-full shadow-xs">
                                  TODAY
                                </span>
                              )}

                              <span className="text-[10px] font-bold text-[#8A8A85] uppercase tracking-wider">
                                {entry.day}
                              </span>

                              {isFuture ? (
                                <span className="text-[11.5px] font-medium text-[#A3A39F] flex items-center gap-1">
                                  <Lock size={11} className="text-[#A3A39F]" /> Locked
                                </span>
                              ) : isBeforeStart ? (
                                <span className="text-[12px] font-bold text-[#A3A39F]">0h</span>
                              ) : hrs > 0 ? (
                                <span className="text-[13px] font-extrabold text-[#0A0A0A] flex items-center gap-1">
                                  <Check size={13} strokeWidth={2.8} className="text-[#0A0A0A]" /> {hrs}h
                                </span>
                              ) : (
                                <span className="text-[12px] font-bold text-[#8A8A85]">0h</span>
                              )}
                            </div>

                            {/* Preview button for active day */}
                            {isToday && (
                              <button
                                type="button"
                                onClick={() => setActiveTab('timesheet')}
                                style={{
                                  border: '1px solid #E5E5E0',
                                  borderRadius: 6,
                                }}
                                className="px-2.5 py-0.5 text-[10px] font-semibold text-[#0A0A0A] bg-white hover:bg-[#F5F5F2] transition-colors"
                              >
                                Preview
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bottom Right Action Button Row */}
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => setActiveTab('timesheet')}
                      style={{
                        backgroundColor: '#0A0A0A',
                        color: '#FFFFFF',
                        borderRadius: 12,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                      }}
                      className="px-5 py-2 text-[12px] font-bold hover:bg-[#262626] transition-colors"
                    >
                      Review & Submit
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column (ASSIGNMENT SNAPSHOT ONLY) */}
              <div className="lg:col-span-4 space-y-4">
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 24,
                    border: '1px solid #E2E2DC',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
                  }}
                  className="p-6 md:p-7 space-y-6 bento-card-hover"
                >
                  {/* Header: Title + ACTIVE badge */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-[1.05rem] font-extrabold text-[#0A0A0A] tracking-tight">
                        Assignment Snapshot
                      </h2>
                      <p className="text-[12px] text-[#8A8A85] mt-0.5">Your current assignment details</p>
                    </div>
                    <span
                      style={{
                        border: '1px solid #E5E5E0',
                        borderRadius: 9999,
                      }}
                      className="px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0A0A0A] bg-white shadow-xs"
                    >
                      ACTIVE
                    </span>
                  </div>

                  {/* Assignment Snapshot Key-Value List */}
                  <div className="divide-y divide-[#F2F2EE] text-[13px] border-t border-[#F2F2EE] pt-1">
                    <div className="py-3 flex items-center justify-between">
                      <span className="text-[#737373]">Work arrangement</span>
                      <span className="font-bold text-[#0A0A0A]">{snapshot.work_arrangement}</span>
                    </div>
                    <div className="py-3 flex items-center justify-between">
                      <span className="text-[#737373]">Weekly expectation</span>
                      <span className="font-bold text-[#0A0A0A]">{snapshot.weekly_expectation}</span>
                    </div>
                    <div className="py-3 flex items-center justify-between">
                      <span className="text-[#737373]">Overtime</span>
                      <span className="font-bold text-[#0A0A0A]">{snapshot.overtime}</span>
                    </div>
                    <div className="py-3 flex items-center justify-between">
                      <span className="text-[#737373]">Engagement</span>
                      <span className="font-bold text-[#0A0A0A]">{snapshot.engagement}</span>
                    </div>
                  </div>

                  {/* Footer / Action Bar */}
                  <div className="pt-3 border-t border-[#F2F2EE] flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11.5px] text-[#737373] font-medium">
                      <span className="w-2 h-2 rounded-full bg-[#0A0A0A]" />
                      <span>Assignment is active</span>
                    </div>
                    <button
                      onClick={() => setActiveTab('assignment')}
                      style={{
                        backgroundColor: '#0A0A0A',
                        color: '#FFFFFF',
                        borderRadius: 12,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                      }}
                      className="px-4 py-2 text-[12px] font-bold hover:bg-[#262626] transition-colors flex items-center gap-1.5"
                    >
                      View Assignment <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            VIEW 2: TIMESHEET (MONOCHROME TIME FLOW ARCHITECTURE)
           ======================================================== */}
        {activeTab === 'timesheet' && (
          <div className="space-y-4 pb-6">
            {/* Page Header */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <h1 className="text-[1.75rem] font-extrabold text-[#0A0A0A] tracking-tight">Timesheet</h1>
                <p className="text-[13px] text-[#737373] mt-0.5">Track and submit your working hours</p>
              </div>

              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 9999,
                  border: '1px solid #E2E2DC',
                }}
                className="px-4 py-1.5 text-[12px] font-bold text-[#0A0A0A] flex items-center gap-2 shadow-sm"
              >
                <Clock size={13} strokeWidth={2.5} />
                {currentTimesheet?.status || 'DRAFT'} · {calculatedMetrics.totalHours}h
              </div>
            </div>

            {/* Main Interactive Timesheet Card */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 22,
                border: '1px solid #E2E2DC',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
              }}
              className="p-6 md:p-7 space-y-6"
            >
              {/* Header inside Card: Range & Restore Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#F4F4F0]">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    title="Back"
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      border: '1px solid #E2E2DC',
                    }}
                    className="flex items-center justify-center text-[#737373] hover:text-[#0A0A0A] hover:bg-[#F9F9F7] transition-colors shrink-0"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div>
                    <div className="flex items-center gap-2 text-[1.15rem] font-extrabold text-[#0A0A0A]">
                      {currentTimesheet?.period_label || '24 – 30 August 2026'}
                      <Calendar size={16} className="text-[#8A8A85]" />
                    </div>
                    <div className="text-[12px] text-[#737373] mt-0.5">
                      {wo.requisition_title} · Work Order {wo.work_order_number}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleRestoreUsualWeek}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E2DC',
                    borderRadius: 9999,
                  }}
                  className="px-4 py-2 text-[12px] font-bold text-[#0A0A0A] flex items-center gap-2 hover:bg-[#F9F9F7] transition-colors self-start sm:self-auto shadow-sm"
                >
                  <RotateCcw size={13} />
                  Restore usual week
                </button>
              </div>

              {/* 7-Day Interactive Columns Grid with Floating Chevrons */}
              <div className="relative flex items-center">
                {/* Left Floating Chevron */}
                <div className="absolute -left-3.5 z-10 hidden xl:flex">
                  <button
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E2DC',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    }}
                    className="flex items-center justify-center text-[#737373] hover:text-[#0A0A0A] transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                </div>

                {/* 7 Columns Row */}
                <div className="w-full grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-3">
                  {dailyEntries.map((dayItem, idx) => {
                    const isToday = dayItem.date === todayStr;
                    const isFuture = dayItem.date && dayItem.date > todayStr;
                    const isBeforeStart = dayItem.date && dayItem.date < assignmentStartStr;

                    return (
                      <div
                        key={dayItem.day || idx}
                        style={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: 20,
                          border: isToday ? '1.5px solid #0A0A0A' : '1px solid #E5E5E0',
                          position: 'relative',
                          marginTop: isToday ? 0 : 0,
                          boxShadow: isToday ? '0 4px 16px rgba(0,0,0,0.04)' : 'none',
                        }}
                        className={`p-3.5 flex flex-col justify-between transition-all ${
                          isFuture ? 'opacity-70 bg-[#FAFAFA]' : 'hover:border-[#C5C5C0]'
                        }`}
                      >
                        {/* TODAY Pill badge pinned strictly to actual current date */}
                        {isToday && (
                          <div
                            style={{
                              backgroundColor: '#0A0A0A',
                              color: '#FFFFFF',
                              borderRadius: '8px 8px 0 0',
                              top: -16,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: '80%',
                            }}
                            className="absolute py-0.5 text-[9.5px] font-extrabold tracking-wider uppercase text-center shadow-sm"
                          >
                            TODAY
                          </div>
                        )}

                        {/* Top: Day and Date Number */}
                        <div className="text-center pt-1.5">
                          <div className="text-[11px] font-bold uppercase text-[#737373] tracking-tight">
                            {dayItem.day} {dayItem.day_number || (24 + idx)}
                          </div>
                          <div className="text-[1.5rem] font-extrabold text-[#0A0A0A] mt-1.5 leading-none">
                            {dayItem.hours}h
                          </div>
                          <div className="text-[11px] text-[#8A8A85] font-medium mt-1">
                            {isBeforeStart ? 'Pre-Start' : (dayItem.category || (idx >= 5 ? 'Weekend' : 'Regular'))}
                          </div>
                        </div>

                        {/* Middle: Stepper Pill */}
                        <div className="my-3.5">
                          {isFuture ? (
                            <div
                              style={{
                                backgroundColor: '#F5F5F2',
                                border: '1px solid #E5E5E0',
                                borderRadius: 12,
                              }}
                              className="py-2 px-1 text-center text-[10.5px] font-semibold text-[#8A8A85] flex items-center justify-center gap-1 cursor-not-allowed"
                              title="Attendance cannot be marked ahead of time for future dates."
                            >
                              <Lock size={11} /> Locked
                            </div>
                          ) : isBeforeStart ? (
                            <div
                              style={{
                                backgroundColor: '#F5F5F2',
                                border: '1px solid #E5E5E0',
                                borderRadius: 12,
                              }}
                              className="py-2 px-1 text-center text-[10.5px] font-semibold text-[#8A8A85] flex items-center justify-center gap-1"
                              title="Assignment starts 25 August 2026."
                            >
                              0.0h
                            </div>
                          ) : (
                            <div
                              style={{
                                backgroundColor: '#FAFAFA',
                                border: '1px solid #E5E5E0',
                                borderRadius: 12,
                              }}
                              className="flex items-center justify-between p-1 shadow-sm"
                            >
                              <button
                                onClick={() => handleHourChange(idx, dayItem.hours - 1)}
                                disabled={dayItem.hours <= 0}
                                style={{ width: 28, height: 28, borderRadius: 8 }}
                                className="flex items-center justify-center text-[#0A0A0A] hover:bg-[#ECECE9] transition-colors disabled:opacity-25"
                              >
                                <Minus size={13} strokeWidth={2.5} />
                              </button>
                              
                              <span className="text-[12px] font-bold text-[#0A0A0A]">
                                {Number(dayItem.hours).toFixed(1)}
                              </span>

                              <button
                                onClick={() => handleHourChange(idx, dayItem.hours + 1)}
                                disabled={dayItem.hours >= 24}
                                style={{ width: 28, height: 28, borderRadius: 8 }}
                                className="flex items-center justify-center text-[#0A0A0A] hover:bg-[#ECECE9] transition-colors disabled:opacity-25"
                              >
                                <Plus size={13} strokeWidth={2.5} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Bottom: Category Dropdown & Add Note */}
                        <div className="space-y-2 pt-2 border-t border-[#F2F2EE]">
                          <select
                            disabled={isFuture || isBeforeStart}
                            value={dayItem.category || (idx >= 5 ? 'Weekend' : 'Regular')}
                            onChange={(e) => handleCategoryChange(idx, e.target.value)}
                            style={{
                              backgroundColor: '#FFFFFF',
                              border: '1px solid #E5E5E0',
                              borderRadius: 10,
                            }}
                            className="w-full text-[11px] font-semibold text-[#0A0A0A] py-1.5 px-2 outline-none cursor-pointer disabled:cursor-not-allowed disabled:bg-[#F5F5F2]"
                          >
                            <option value="Regular">Regular</option>
                            <option value="Overtime">Overtime</option>
                            <option value="Paid Leave">Paid Leave</option>
                            <option value="Holiday">Holiday</option>
                            <option value="Sick Leave">Sick Leave</option>
                            <option value="Weekend">Weekend</option>
                          </select>

                          <button
                            disabled={isFuture || isBeforeStart}
                            onClick={() => {
                              setActiveNoteDay(idx);
                              setTempNoteText(dayItem.note || dayItem.task || '');
                            }}
                            style={{
                              backgroundColor: dayItem.note ? '#F0FDF4' : '#FFFFFF',
                              border: dayItem.note ? '1px solid #BBF7D0' : '1px solid #E5E5E0',
                              borderRadius: 10,
                            }}
                            className="w-full py-1.5 px-2 text-[10.5px] font-medium text-[#525252] hover:text-[#0A0A0A] hover:bg-[#F9F9F7] flex items-center justify-center gap-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <FileText size={11} className={dayItem.note ? 'text-[#16A34A]' : ''} />
                            {dayItem.note ? 'Edit note' : 'Add note'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Right Floating Chevron */}
                <div className="absolute -right-3.5 z-10 hidden xl:flex">
                  <button
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E2DC',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    }}
                    className="flex items-center justify-center text-[#737373] hover:text-[#0A0A0A] transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Subtle Horizontal Slider Track Indicator */}
              <div className="w-full flex justify-center pt-1 pb-1">
                <div
                  style={{
                    backgroundColor: '#E5E5E0',
                    width: '100%',
                    height: 4,
                    borderRadius: 9999,
                    overflow: 'hidden',
                  }}
                  className="flex items-center justify-center"
                >
                  <div
                    style={{
                      backgroundColor: '#8A8A85',
                      width: 140,
                      height: 4,
                      borderRadius: 9999,
                    }}
                  />
                </div>
              </div>

              {/* Bottom Assistant Strip */}
              <div
                style={{
                  backgroundColor: '#F9F9F7',
                  borderRadius: 16,
                  border: '1px solid #E5E5E0',
                }}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 text-[12.5px] text-[#5A5A57]">
                  <Sparkles size={15} className="text-[#0A0A0A] shrink-0" />
                  <span>
                    AI prepared this based on your usual pattern (40h/week). Please review and make changes if needed.
                  </span>
                </div>

                <button
                  onClick={handleApplyToAllWorkdays}
                  style={{
                    backgroundColor: '#0A0A0A',
                    color: '#FFFFFF',
                    borderRadius: 9999,
                  }}
                  className="px-5 py-2 text-[12px] font-bold flex items-center justify-center gap-2 hover:bg-[#262626] transition-colors shrink-0 shadow-sm"
                >
                  <Wand2 size={13} />
                  Apply to all workdays
                </button>
              </div>
            </div>

            {/* Split Section: Metrics & Action Buttons (Left) + Smart Check (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column (8 cols): 3 KPI metric cards + 2 Action buttons */}
              <div className="lg:col-span-8 space-y-4">
                {/* 3 Metric Cards Row (WITH LEFT-TO-RIGHT EXPANDING UNDERLINE HOVER EFFECT) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {/* Metric 1: Regular Hours */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 20,
                      border: '1px solid #E2E2DC',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    }}
                    className="p-5 flex flex-col justify-between metric-card-underline cursor-default"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-[#8A8A85]">REGULAR HOURS</span>
                      <Clock size={15} className="text-[#8A8A85]" />
                    </div>
                    <div className="my-2.5">
                      <span className="text-[1.55rem] font-extrabold text-[#0A0A0A] tracking-tight">
                        {calculatedMetrics.regularHours}h
                      </span>
                      <span className="text-[13px] text-[#8A8A85] font-semibold"> / {calculatedMetrics.expectedHours}h</span>
                    </div>
                    <div className="text-[11.5px] text-[#737373]">Expected</div>
                  </div>

                  {/* Metric 2: Overtime */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 20,
                      border: '1px solid #E2E2DC',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    }}
                    className="p-5 flex flex-col justify-between metric-card-underline cursor-default"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-[#8A8A85]">OVERTIME</span>
                      <Bell size={15} className="text-[#8A8A85]" />
                    </div>
                    <div className="my-2.5">
                      <span className="text-[1.55rem] font-extrabold text-[#0A0A0A] tracking-tight">
                        {calculatedMetrics.overtimeHours}h
                      </span>
                    </div>
                    <div className="text-[11.5px] text-[#737373]">This week</div>
                  </div>

                  {/* Metric 3: Total Hours */}
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 20,
                      border: '1px solid #E2E2DC',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    }}
                    className="p-5 flex flex-col justify-between metric-card-underline cursor-default"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-[#8A8A85]">TOTAL HOURS</span>
                      <PieIcon size={15} className="text-[#8A8A85]" />
                    </div>
                    <div className="my-2.5">
                      <span className="text-[1.55rem] font-extrabold text-[#0A0A0A] tracking-tight">
                        {calculatedMetrics.totalHours}h
                      </span>
                    </div>
                    <div className="text-[11.5px] text-[#737373]">This week</div>
                  </div>
                </div>

                {/* Two Big Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <button
                    onClick={handleSaveDraft}
                    disabled={savingDraft}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 20,
                      border: '1px solid #E2E2DC',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    }}
                    className="p-4 text-center hover:bg-[#F9F9F7] transition-all disabled:opacity-50"
                  >
                    <div className="text-[13.5px] font-bold text-[#0A0A0A] flex items-center justify-center gap-2">
                      <Save size={15} />
                      {savingDraft ? 'Saving...' : 'Save Draft'}
                    </div>
                    <div className="text-[11px] text-[#8A8A85] mt-1">You can continue later</div>
                  </button>

                  <button
                    onClick={handleConfirmSubmit}
                    disabled={submittingTs}
                    style={{
                      backgroundColor: '#0A0A0A',
                      color: '#FFFFFF',
                      borderRadius: 20,
                      boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
                    }}
                    className="p-4 text-center hover:bg-[#262626] transition-all disabled:opacity-50"
                  >
                    <div className="text-[13.5px] font-bold flex items-center justify-center gap-2">
                      <Send size={15} />
                      {submittingTs ? 'Submitting...' : 'Confirm & Submit'}
                    </div>
                    <div className="text-[11px] text-[#A3A39F] mt-1">Submit for approval</div>
                  </button>
                </div>
              </div>

              {/* Right Column (4 cols): Smart Check Card */}
              <div className="lg:col-span-4">
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 22,
                    border: '1px solid #E2E2DC',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                  }}
                  className="p-6 flex flex-col justify-between h-full bento-card-hover"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5 text-[14px] font-bold text-[#0A0A0A]">
                        <Sparkles size={15} />
                        Smart Check
                      </div>
                      <span
                        style={{
                          backgroundColor:
                            calculatedMetrics.statusFlag === 'LOOKS_GOOD'
                              ? '#ECFDF5'
                              : calculatedMetrics.statusFlag === 'OVERTIME'
                              ? '#EFF6FF'
                              : '#FFFBEB',
                          color:
                            calculatedMetrics.statusFlag === 'LOOKS_GOOD'
                              ? '#047857'
                              : calculatedMetrics.statusFlag === 'OVERTIME'
                              ? '#1D4ED8'
                              : '#B45309',
                          border:
                            calculatedMetrics.statusFlag === 'LOOKS_GOOD'
                              ? '1px solid #A7F3D0'
                              : calculatedMetrics.statusFlag === 'OVERTIME'
                              ? '1px solid #BFDBFE'
                              : '1px solid #FDE68A',
                          borderRadius: 9999,
                        }}
                        className="px-2.5 py-0.5 text-[10.5px] font-bold"
                      >
                        {calculatedMetrics.badgeText}
                      </span>
                    </div>

                    <p className="text-[12px] text-[#737373] leading-relaxed mb-4">
                      {calculatedMetrics.summaryText}
                    </p>

                    <div className="divide-y divide-[#F2F2EE] text-[12.5px] border-t border-[#F2F2EE]">
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-[#737373]">Regular</span>
                        <span className="font-bold text-[#0A0A0A]">{calculatedMetrics.regularHours}h</span>
                      </div>
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-[#737373]">Overtime</span>
                        <span className="font-bold text-[#0A0A0A]">{calculatedMetrics.overtimeHours}h</span>
                      </div>
                      <div className="py-2 flex items-center justify-between">
                        <span className="text-[#737373]">Expected</span>
                        <span className="font-bold text-[#0A0A0A]">{calculatedMetrics.expectedHours}h</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent History Table */}
            {timesheetHistory.length > 0 && (
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 22,
                  border: '1px solid #E2E2DC',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                }}
                className="p-6 md:p-7 bento-card-hover"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[1rem] font-bold text-[#0A0A0A] tracking-tight">Recent history</h2>
                  <button className="text-[12px] font-semibold text-[#737373] hover:text-[#0A0A0A] flex items-center gap-1">
                    View all →
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[12.5px]">
                    <thead>
                      <tr className="border-b border-[#F2F2EE] text-[10.5px] font-bold text-[#8A8A85] uppercase tracking-wider">
                        <th className="pb-3 font-bold">Period</th>
                        <th className="pb-3 font-bold">Regular Hours</th>
                        <th className="pb-3 font-bold">Overtime</th>
                        <th className="pb-3 font-bold">Total Hours</th>
                        <th className="pb-3 font-bold">Status</th>
                        <th className="pb-3 font-bold">Submitted On</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F2F2EE]">
                      {timesheetHistory.map((item) => (
                        <tr key={item.id} className="hover:bg-[#FAF9F7] transition-colors">
                          <td className="py-3 font-semibold text-[#0A0A0A]">
                            {item.period_label || `${item.week_start_date} – ${item.week_end_date}`}
                          </td>
                          <td className="py-3 text-[#0A0A0A]">{item.total_regular_hours || 0}h</td>
                          <td className="py-3 text-[#0A0A0A]">{item.total_overtime_hours || 0}h</td>
                          <td className="py-3 font-bold text-[#0A0A0A]">{item.total_hours || 0}h</td>
                          <td className="py-3">
                            <span
                              style={{
                                backgroundColor: '#ECFDF5',
                                border: '1px solid #A7F3D0',
                                color: '#047857',
                                borderRadius: 9999,
                              }}
                              className="px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider inline-block"
                            >
                              {item.status || 'Approved'}
                            </span>
                          </td>
                          <td className="py-3 text-[#737373]">{item.submitted_at || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            VIEW 3: MY ASSIGNMENT (TIMELINE & BENTO BLOCKS)
           ======================================================== */}
        {activeTab === 'assignment' && (
          <div className="space-y-4 pb-6">
            {/* Page Header */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <h1 className="text-[1.75rem] font-extrabold text-[#0A0A0A] tracking-tight">My Assignment</h1>
                <p className="text-[13px] text-[#737373] mt-0.5">Work order details and placement parameters</p>
              </div>

              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 9999,
                  border: '1px solid #E2E2DC',
                }}
                className="px-4 py-1.5 text-[12px] font-bold text-[#0A0A0A] flex items-center gap-2 shadow-sm"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                {wo.status || 'ACTIVE'}
              </div>
            </div>

            {/* Main Assignment Bento Card */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 22,
                border: '1px solid #E2E2DC',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
              }}
              className="p-6 md:p-8 space-y-6 bento-card-hover"
            >
              {/* Header Title & Work Order */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[#F2F2EE]">
                <div>
                  <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[#8A8A85] mb-1">
                    CONTRACT SPECIFICATION
                  </div>
                  <h2 className="text-[1.5rem] font-extrabold text-[#0A0A0A] tracking-tight">
                    {wo.requisition_title || 'DevOps Engineer'}
                  </h2>
                  <div className="text-[13px] text-[#737373] font-medium mt-0.5">
                    {wo.company_name || 'Bearitt'} · {wo.vendor_name || 'Bridgeon'}
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-[#F9F9F7] px-3.5 py-2 rounded-xl border border-[#E5E5E0] self-start sm:self-auto">
                  <FileText size={15} className="text-[#8A8A85]" />
                  <span className="text-[12px] font-mono font-bold text-[#0A0A0A]">{wo.work_order_number}</span>
                </div>
              </div>

              {/* Assignment Timeline Bar */}
              <div className="bg-[#FBFBFA] p-5 rounded-2xl border border-[#E5E5E0] space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#8A8A85]">
                  <span>Timeline</span>
                  <span>Active Contract Duration</span>
                </div>

                {/* Timeline visual bar */}
                <div className="relative pt-2 pb-1">
                  <div className="w-full h-2.5 bg-[#E5E5E0] rounded-full overflow-hidden flex">
                    <div className="h-full bg-[#0A0A0A] rounded-full transition-all duration-700" style={{ width: '15%' }} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[12px] pt-1">
                  <div>
                    <span className="text-[#8A8A85] block text-[10px] uppercase font-bold">Start Date</span>
                    <span className="font-bold text-[#0A0A0A]">{wo.start_date || '25 Aug 2026'}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[#8A8A85] block text-[10px] uppercase font-bold">Current State</span>
                    <span className="font-bold text-[#0A0A0A] px-2 py-0.5 bg-[#FFFFFF] border border-[#E2E2DC] rounded-md text-[11px]">Active</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#8A8A85] block text-[10px] uppercase font-bold">End Date</span>
                    <span className="font-bold text-[#0A0A0A]">{wo.end_date || '25 Feb 2027'}</span>
                  </div>
                </div>
              </div>

              {/* Bento Grid: 8 Parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E5E5E0] space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A85] flex items-center gap-1.5">
                    <Building size={12} /> Client Company
                  </div>
                  <div className="text-[13.5px] font-bold text-[#0A0A0A]">{wo.company_name}</div>
                </div>

                <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E5E5E0] space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A85] flex items-center gap-1.5">
                    <UserCheck2 size={12} /> Staffing Vendor
                  </div>
                  <div className="text-[13.5px] font-bold text-[#0A0A0A]">{wo.vendor_name}</div>
                </div>

                <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E5E5E0] space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A85] flex items-center gap-1.5">
                    <Compass size={12} /> Work Arrangement
                  </div>
                  <div className="text-[13.5px] font-bold text-[#0A0A0A]">{wo.work_arrangement}</div>
                </div>

                <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E5E5E0] space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A85] flex items-center gap-1.5">
                    <User size={12} /> Reporting Manager
                  </div>
                  <div className="text-[13.5px] font-bold text-[#0A0A0A]">{wo.reporting_manager}</div>
                </div>

                <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E5E5E0] space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A85] flex items-center gap-1.5">
                    <Clock size={12} /> Weekly Expectation
                  </div>
                  <div className="text-[13.5px] font-bold text-[#0A0A0A]">{wo.weekly_hours}h / week</div>
                </div>

                <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E5E5E0] space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A85] flex items-center gap-1.5">
                    <Shield size={12} /> Overtime Policy
                  </div>
                  <div className="text-[13.5px] font-bold text-[#0A0A0A]">{wo.overtime_policy}</div>
                </div>

                <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E5E5E0] space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A85] flex items-center gap-1.5">
                    <Briefcase size={12} /> Engagement Type
                  </div>
                  <div className="text-[13.5px] font-bold text-[#0A0A0A]">{wo.engagement_type}</div>
                </div>

                <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E5E5E0] space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A85] flex items-center gap-1.5">
                    <MapPin size={12} /> Location
                  </div>
                  <div className="text-[13.5px] font-bold text-[#0A0A0A]">{wo.location}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            VIEW 4: ATTENDANCE (MONOCHROME BENTO & CALENDAR DATA)
           ======================================================== */}
        {activeTab === 'attendance' && (
          <div className="space-y-4 pb-6">
            {/* Page Header */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <h1 className="text-[1.75rem] font-extrabold text-[#0A0A0A] tracking-tight">Attendance</h1>
                <p className="text-[13px] text-[#737373] mt-0.5">Monthly attendance and payable-day overview</p>
              </div>

              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 9999,
                  border: '1px solid #E2E2DC',
                }}
                className="px-4 py-1.5 text-[12px] font-bold text-[#0A0A0A] flex items-center gap-2 shadow-sm"
              >
                <Calendar size={13} strokeWidth={2.5} />
                {attendanceData.payable_days ?? 0.0} Payable Days
              </div>
            </div>

            {/* Main Attendance Card */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 22,
                border: '1px solid #E2E2DC',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
              }}
              className="p-6 md:p-8 space-y-6 bento-card-hover"
            >
              {/* Month Tabs Bar */}
              <div className="flex items-center gap-6 border-b border-[#E5E5E0]">
                <button
                  onClick={() => setSelectedMonth('2026-08')}
                  style={{
                    color: selectedMonth === '2026-08' ? '#0A0A0A' : '#737373',
                    borderBottom: selectedMonth === '2026-08' ? '2px solid #0A0A0A' : '2px solid transparent',
                  }}
                  className="pb-3 text-[13.5px] font-bold transition-all -mb-[1px]"
                >
                  August 2026
                </button>
                <button
                  onClick={() => setSelectedMonth('2026-07')}
                  style={{
                    color: selectedMonth === '2026-07' ? '#0A0A0A' : '#737373',
                    borderBottom: selectedMonth === '2026-07' ? '2px solid #0A0A0A' : '2px solid transparent',
                  }}
                  className="pb-3 text-[13.5px] font-medium transition-all -mb-[1px] hover:text-[#0A0A0A]"
                >
                  July 2026
                </button>
              </div>

              {/* 4 Metric Cards Grid (WITH LEFT-TO-RIGHT EXPANDING UNDERLINE HOVER EFFECT) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. PRESENT */}
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 20,
                    border: '1px solid #E5E5E0',
                  }}
                  className="p-6 flex flex-col justify-between metric-card-underline cursor-default"
                >
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#8A8A85]">
                    PRESENT
                  </div>
                  <div className="my-3">
                    <div className="text-[2.2rem] font-extrabold text-[#0A0A0A] tracking-tight leading-none">
                      {attendanceData.present_days ?? 0}
                    </div>
                  </div>
                  <div className="text-[12px] text-[#737373]">days</div>
                </div>

                {/* 2. LEAVE */}
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 20,
                    border: '1px solid #E5E5E0',
                  }}
                  className="p-6 flex flex-col justify-between metric-card-underline cursor-default"
                >
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#8A8A85]">
                    LEAVE
                  </div>
                  <div className="my-3">
                    <div className="text-[2.2rem] font-extrabold text-[#0A0A0A] tracking-tight leading-none">
                      {attendanceData.paid_leave_days ?? 0}
                    </div>
                  </div>
                  <div className="text-[12px] text-[#737373]">days</div>
                </div>

                {/* 3. HOLIDAY */}
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 20,
                    border: '1px solid #E5E5E0',
                  }}
                  className="p-6 flex flex-col justify-between metric-card-underline cursor-default"
                >
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#8A8A85]">
                    HOLIDAY
                  </div>
                  <div className="my-3">
                    <div className="text-[2.2rem] font-extrabold text-[#0A0A0A] tracking-tight leading-none">
                      {attendanceData.client_holidays ?? 0}
                    </div>
                  </div>
                  <div className="text-[12px] text-[#737373]">days</div>
                </div>

                {/* 4. PAYABLE */}
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 20,
                    border: '1px solid #E5E5E0',
                  }}
                  className="p-6 flex flex-col justify-between metric-card-underline cursor-default"
                >
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#8A8A85]">
                    PAYABLE
                  </div>
                  <div className="my-3">
                    <div className="text-[2.2rem] font-extrabold text-[#0A0A0A] tracking-tight leading-none">
                      {attendanceData.payable_days ?? 0}
                    </div>
                  </div>
                  <div className="text-[12px] text-[#737373]">days</div>
                </div>
              </div>

              {/* Attendance Table */}
              <div className="overflow-x-auto pt-2">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-[#F2F2EE] text-[10.5px] font-bold text-[#8A8A85] uppercase tracking-wider">
                      <th className="pb-3 font-bold w-1/4">DATE</th>
                      <th className="pb-3 font-bold w-1/4">DAY</th>
                      <th className="pb-3 font-bold w-1/4">STATUS</th>
                      <th className="pb-3 font-bold w-1/4">NOTE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2F2EE]">
                    {(attendanceData.daily_records || []).map((row, rIdx) => {
                      const isPresent = row.status === 'Present';
                      return (
                        <tr key={rIdx} className="hover:bg-[#FAF9F7] transition-colors">
                          <td className="py-3.5 font-medium text-[#0A0A0A]">{row.date}</td>
                          <td className="py-3.5 text-[#5A5A57]">{row.day}</td>
                          <td className="py-3.5">
                            {isPresent ? (
                              <span
                                style={{
                                  backgroundColor: '#ECECE9',
                                  color: '#0A0A0A',
                                  borderRadius: 9999,
                                }}
                                className="px-3.5 py-1 text-[11px] font-bold tracking-wide inline-block shadow-sm"
                              >
                                Present
                              </span>
                            ) : (
                              <span
                                style={{
                                  backgroundColor: '#F5F5F2',
                                  border: '1px solid #E5E5E0',
                                  color: '#737373',
                                  borderRadius: 9999,
                                }}
                                className="px-3.5 py-1 text-[11px] font-semibold tracking-wide inline-block"
                              >
                                {row.status || 'Pending'}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 text-[#737373] font-medium">{row.note || 'Regular'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            VIEW 5: EXPENSES (MONOCHROME BENTO FORM & SUMMARY)
           ======================================================== */}
        {activeTab === 'expenses' && (
          <div className="space-y-4 pb-6">
            {/* Page Header with + New Expense button */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <h1 className="text-[1.75rem] font-extrabold text-[#0A0A0A] tracking-tight">Expenses</h1>
                <p className="text-[13px] text-[#737373] mt-0.5">Track work-related expenses against your active assignment.</p>
              </div>

              <button
                onClick={() => {
                  setExpenseForm({
                    date: assignmentStartStr,
                    category: 'Travel',
                    amount: '',
                    receipt_name: '',
                    description: '',
                  });
                  setExpenseFeedback({ type: '', text: '' });
                }}
                style={{
                  backgroundColor: '#0A0A0A',
                  color: '#FFFFFF',
                  borderRadius: 9999,
                }}
                className="px-4 py-2 text-[12.5px] font-bold hover:bg-[#262626] transition-colors shadow-sm"
              >
                + New Expense
              </button>
            </div>

            {/* Expense Feedback Message Banner */}
            {expenseFeedback.text && (
              <div
                className={`p-3.5 rounded-2xl text-[13px] font-medium flex items-center justify-between gap-2.5 ${
                  expenseFeedback.type === 'error'
                    ? 'bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B]'
                    : 'bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {expenseFeedback.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                  {expenseFeedback.text}
                </div>
                <button onClick={() => setExpenseFeedback({ type: '', text: '' })} className="text-[12px] opacity-70 hover:opacity-100">✕</button>
              </div>
            )}

            {/* 2-Column Split: Submit Expense Form (Left) & This Month Summary (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left Column (8 cols): Submit Expense Card */}
              <div className="lg:col-span-8">
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 22,
                    border: '1px solid #E2E2DC',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                  }}
                  className="p-6 md:p-8 bento-card-hover"
                >
                  <h2 className="text-[1.05rem] font-bold text-[#0A0A0A] mb-5 tracking-tight">Submit Expense</h2>

                  <div className="space-y-4">
                    {/* Row 1: DATE & CATEGORY */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#8A8A85] mb-2">
                          DATE (Eligible: {assignmentStartStr} to {todayStr})
                        </label>
                        <div className="relative">
                          <input
                            type="date"
                            min={assignmentStartStr}
                            max={todayStr}
                            value={expenseForm.date}
                            onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                            style={{
                              backgroundColor: '#FFFFFF',
                              border: '1px solid #E5E5E0',
                              borderRadius: 14,
                            }}
                            className="w-full px-3.5 py-2.5 text-[13px] font-medium text-[#0A0A0A] outline-none focus:border-[#0A0A0A] transition-colors"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#8A8A85] mb-2">
                          CATEGORY
                        </label>
                        <select
                          value={expenseForm.category}
                          onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                          style={{
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #E5E5E0',
                            borderRadius: 14,
                          }}
                          className="w-full px-3.5 py-2.5 text-[13px] font-medium text-[#0A0A0A] outline-none focus:border-[#0A0A0A] transition-colors cursor-pointer"
                        >
                          <option value="Travel">Travel</option>
                          <option value="Broadband & Internet">Broadband & Internet</option>
                          <option value="Client Dinner & Meals">Client Dinner & Meals</option>
                          <option value="Software & Cloud Tools">Software & Cloud Tools</option>
                          <option value="Office Supplies">Office Supplies</option>
                          <option value="Relocation / Transport">Relocation / Transport</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    {/* Row 2: AMOUNT & RECEIPT */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#8A8A85] mb-2">
                          AMOUNT
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13.5px] font-bold text-[#0A0A0A]">
                            ₹
                          </span>
                          <input
                            type="number"
                            placeholder="0"
                            value={expenseForm.amount}
                            onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                            style={{
                              backgroundColor: '#FFFFFF',
                              border: '1px solid #E5E5E0',
                              borderRadius: 14,
                            }}
                            className="w-full pl-8 pr-3.5 py-2.5 text-[13px] font-medium text-[#0A0A0A] outline-none focus:border-[#0A0A0A] transition-colors"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#8A8A85] mb-2">
                          RECEIPT (PDF or Image only)
                        </label>
                        <input
                          type="file"
                          accept=".pdf,image/png,image/jpeg,image/jpg,image/webp,application/pdf,image/*"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;

                            const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
                            const ext = f.name.slice(((f.name.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase();
                            const allowedExts = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];

                            if (!allowedTypes.includes(f.type) && !allowedExts.includes(ext)) {
                              alert('Only PDF and Image files (PNG, JPG, WEBP) are accepted for receipt attachments.');
                              e.target.value = '';
                              return;
                            }

                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              setExpenseForm({
                                ...expenseForm,
                                receipt_name: f.name,
                                receipt_url: evt.target.result,
                              });
                            };
                            reader.readAsDataURL(f);
                          }}
                          style={{
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #E5E5E0',
                            borderRadius: 14,
                          }}
                          className="w-full px-3 py-2 text-[12px] text-[#737373] file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-[#F2F2EE] file:text-[#0A0A0A] hover:file:bg-[#E5E5E0] cursor-pointer"
                        />
                        {expenseForm.receipt_name && (
                          <div className="mt-1 text-[11px] text-[#16a34a] font-medium flex items-center gap-1">
                            ✓ Attached: {expenseForm.receipt_name}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Row 3: DESCRIPTION */}
                    <div>
                      <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#8A8A85] mb-2">
                        DESCRIPTION
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Business purpose..."
                        value={expenseForm.description}
                        onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #E5E5E0',
                          borderRadius: 14,
                        }}
                        className="w-full p-3.5 text-[13px] font-medium text-[#0A0A0A] outline-none focus:border-[#0A0A0A] transition-colors resize-y"
                      />
                    </div>

                    {/* Bottom Right Actions */}
                    <div className="flex items-center justify-end gap-3 pt-3">
                      <button
                        type="button"
                        disabled={submittingExpense}
                        onClick={() => handleExpenseSubmit('Draft')}
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #E5E5E0',
                          borderRadius: 12,
                        }}
                        className="px-4 py-2 text-[12px] font-bold text-[#0A0A0A] hover:bg-[#F9F9F7] transition-colors disabled:opacity-50"
                      >
                        Save Draft
                      </button>
                      <button
                        type="button"
                        disabled={submittingExpense}
                        onClick={() => handleExpenseSubmit('Pending')}
                        style={{
                          backgroundColor: '#0A0A0A',
                          color: '#FFFFFF',
                          borderRadius: 12,
                        }}
                        className="px-5 py-2 text-[12px] font-bold hover:bg-[#262626] transition-colors disabled:opacity-50 shadow-sm"
                      >
                        {submittingExpense ? 'Submitting...' : 'Submit'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column (4 cols): THIS MONTH Summary Card */}
              <div className="lg:col-span-4">
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 22,
                    border: '1px solid #E2E2DC',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                  }}
                  className="p-6 md:p-7 space-y-5 bento-card-hover"
                >
                  {/* Top: Total Header */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A85]">
                      THIS MONTH
                    </div>
                    <div className="text-[2.2rem] font-extrabold text-[#0A0A0A] mt-1.5 leading-none tracking-tight">
                      ₹{expenseTotalThisMonth.toLocaleString()}
                    </div>
                    <div className="text-[12px] text-[#737373] mt-1 font-medium">
                      Submitted expenses
                    </div>
                  </div>

                  {/* List of Submitted Expenses */}
                  <div className="divide-y divide-[#F2F2EE] border-t border-[#F2F2EE] pt-2">
                    {expensesList.length > 0 ? (
                      expensesList.map((exp, eIdx) => (
                        <div key={exp.id || eIdx} className="py-3.5 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-[13px]">
                            <span className="font-bold text-[#0A0A0A]">
                              {exp.category} · {exp.date_label || exp.date}
                            </span>
                            <span className="font-extrabold text-[#0A0A0A]">
                              ₹{Number(exp.amount || 0).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11.5px] text-[#737373]">
                            <span>Status</span>
                            <span
                              style={{
                                backgroundColor:
                                  exp.status === 'Approved'
                                    ? '#ECFDF5'
                                    : exp.status === 'Draft'
                                    ? '#F5F5F2'
                                    : '#FFFBEB',
                                color:
                                  exp.status === 'Approved'
                                    ? '#047857'
                                    : exp.status === 'Draft'
                                    ? '#737373'
                                    : '#92400E',
                                border:
                                  exp.status === 'Approved'
                                    ? '1px solid #A7F3D0'
                                    : exp.status === 'Draft'
                                    ? '1px solid #E5E5E0'
                                    : '1px solid #FDE68A',
                                borderRadius: 9999,
                              }}
                              className="px-2.5 py-0.5 font-bold"
                            >
                              {exp.status || 'Pending'}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-6 text-center text-[12px] text-[#A3A39F]">
                        No expenses submitted yet for this period.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================
          MOBILE NAVIGATION DRAWER (SLIDE-OVER FOR MOBILE/TABLET)
         ======================================================== */}
      {showMobileDrawer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(4px)',
          }}
          className="flex lg:hidden animate-in fade-in duration-200"
          onClick={() => setShowMobileDrawer(false)}
        >
          <div
            style={{
              width: 290,
              maxWidth: '85vw',
              backgroundColor: '#FFFFFF',
              borderRight: '1px solid #E2E2DC',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
            }}
            className="h-full flex flex-col justify-between p-5 animate-in slide-in-from-left duration-250"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-5 border-b border-[#F0F0EC]">
                <div className="flex items-center gap-3">
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      backgroundColor: '#0A0A0A',
                      color: '#FFFFFF',
                    }}
                    className="flex items-center justify-center font-bold text-[14px] tracking-tight shrink-0 shadow-sm"
                  >
                    TJ
                  </div>
                  <div>
                    <div className="text-[14.5px] font-bold text-[#0A0A0A] leading-tight tracking-tight">Term Jobs</div>
                    <div className="text-[11.5px] text-[#737373] font-medium">Candidate Portal</div>
                  </div>
                </div>

                <button
                  onClick={() => setShowMobileDrawer(false)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    border: '1px solid #E5E5E0',
                  }}
                  className="flex items-center justify-center text-[#737373] hover:text-[#0A0A0A] hover:bg-[#F5F5F2] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Workspace Label */}
              <div className="pt-5 pb-2 px-2 text-[10px] font-bold tracking-[0.14em] uppercase text-[#A3A39F]">
                Workspace
              </div>

              {/* Mobile Nav Items */}
              <nav className="space-y-1.5 mt-1">
                <button
                  onClick={() => {
                    setActiveTab('dashboard');
                    setShowMobileDrawer(false);
                  }}
                  className={`sidebar-nav-btn flex items-center gap-3 px-3.5 py-3 rounded-xl text-[14px] text-left ${
                    activeTab === 'dashboard' ? 'active-nav-tab' : ''
                  }`}
                >
                  <Home size={18} strokeWidth={activeTab === 'dashboard' ? 2.4 : 2} />
                  Dashboard
                </button>

                <button
                  onClick={() => {
                    setActiveTab('assignment');
                    setShowMobileDrawer(false);
                  }}
                  className={`sidebar-nav-btn flex items-center gap-3 px-3.5 py-3 rounded-xl text-[14px] text-left ${
                    activeTab === 'assignment' ? 'active-nav-tab' : ''
                  }`}
                >
                  <Briefcase size={18} strokeWidth={activeTab === 'assignment' ? 2.4 : 2} />
                  My Assignment
                </button>

                <button
                  onClick={() => {
                    setActiveTab('timesheet');
                    setShowMobileDrawer(false);
                  }}
                  className={`sidebar-nav-btn flex items-center gap-3 px-3.5 py-3 rounded-xl text-[14px] text-left ${
                    activeTab === 'timesheet' ? 'active-nav-tab' : ''
                  }`}
                >
                  <Clock size={18} strokeWidth={activeTab === 'timesheet' ? 2.4 : 2} />
                  Timesheet
                </button>

                <button
                  onClick={() => {
                    setActiveTab('attendance');
                    setShowMobileDrawer(false);
                  }}
                  className={`sidebar-nav-btn flex items-center gap-3 px-3.5 py-3 rounded-xl text-[14px] text-left ${
                    activeTab === 'attendance' ? 'active-nav-tab' : ''
                  }`}
                >
                  <CheckSquare size={18} strokeWidth={activeTab === 'attendance' ? 2.4 : 2} />
                  Attendance
                </button>

                <button
                  onClick={() => {
                    setActiveTab('expenses');
                    setShowMobileDrawer(false);
                  }}
                  className={`sidebar-nav-btn flex items-center gap-3 px-3.5 py-3 rounded-xl text-[14px] text-left ${
                    activeTab === 'expenses' ? 'active-nav-tab' : ''
                  }`}
                >
                  <IndianRupee size={18} strokeWidth={activeTab === 'expenses' ? 2.4 : 2} />
                  Expenses
                </button>

                <button
                  onClick={() => {
                    setShowRaiseIssue(true);
                    setShowMobileDrawer(false);
                  }}
                  className="sidebar-nav-btn flex items-center gap-3 px-3.5 py-3 rounded-xl text-[14px] text-left"
                >
                  <Flag size={18} strokeWidth={2} />
                  Raise Issue
                </button>
              </nav>
            </div>

            {/* Mobile Bottom Profile Card */}
            <div className="pt-4 border-t border-[#F0F0EC]">
              <div className="flex items-center gap-3 p-1 rounded-xl">
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    backgroundColor: '#0A0A0A',
                    color: '#FFFFFF',
                  }}
                  className="flex items-center justify-center text-[14px] font-bold shrink-0 shadow-sm"
                >
                  {(cand.name || 'S')[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-bold text-[#0A0A0A] truncate leading-tight">{cand.name}</div>
                  <div className="text-[11.5px] text-[#737373] truncate mt-0.5">{cand.active_badge || 'Active candidate'}</div>
                </div>
                <button
                  onClick={logout}
                  title="Sign out"
                  className="p-2 rounded-xl text-[#737373] hover:text-[#0A0A0A] hover:bg-[#F2F2EE] transition-colors"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          DAILY NOTE MODAL
         ======================================================== */}
      {activeNoteDay !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '90%', maxWidth: 440, padding: 24, boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <StickyNote size={18} color="#0A0A0A" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0A0A0A', margin: 0 }}>
                  Daily Work Note ({dailyEntries[activeNoteDay]?.day} {dailyEntries[activeNoteDay]?.day_number})
                </h3>
              </div>
              <button onClick={() => setActiveNoteDay(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
            </div>

            <textarea
              rows={4}
              value={tempNoteText}
              onChange={(e) => setTempNoteText(e.target.value)}
              placeholder="Enter deliverables, sprint tasks or standup notes for this day..."
              style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #D9D8D2', fontSize: '0.84rem', outline: 'none', resize: 'vertical' }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button onClick={() => setActiveNoteDay(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #D9D8D2', background: '#fff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveNote} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#0A0A0A', color: '#fff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>Save Note</button>
            </div>
          </div>
        </div>
      )}

      
      {/* ========================================================
          FLOATING AI ASSISTANT TRIGGER BUTTON & MODAL
         ======================================================== */}
      {/* Floating AI Trigger Button (SOLID BLACK FAB WITH WHITE ICON, ENLARGED & SHIFTED LEFT) */}
      <button
        type="button"
        onClick={() => setShowAiAssistant(!showAiAssistant)}
        style={{
          backgroundColor: '#0A0A0A',
          color: '#FFFFFF',
          borderRadius: '50%',
          boxShadow: '0 8px 26px rgba(0, 0, 0, 0.28)',
          border: '1.5px solid #262626',
        }}
        className="fixed bottom-8 right-12 z-40 w-15 h-15 md:w-16 md:h-16 flex items-center justify-center hover:scale-108 hover:bg-[#1A1A1A] transition-all duration-200 cursor-pointer shadow-xl"
        title="Open AI Dashboard Assistant"
      >
        <div className="flex items-center justify-center text-[#FFFFFF]">
          <Sparkles size={28} strokeWidth={2.2} className="text-[#FFFFFF]" />
        </div>
      </button>

      {/* Backdrop to close assistant when pressing anywhere on dashboard background */}
      {showAiAssistant && (
        <div
          className="fixed inset-0 z-[9999] bg-transparent cursor-default"
          onClick={() => setShowAiAssistant(false)}
        />
      )}

      {/* AI Assistant Popover / Drawer */}
      {showAiAssistant && (
        <div
          style={{
            position: 'fixed',
            bottom: 98,
            right: 48,
            zIndex: 10000,
            width: 390,
            maxWidth: '92vw',
            maxHeight: '78vh',
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            border: '1px solid #E2E2DC',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.18)',
          }}
          className="flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 bg-[#0A0A0A] text-[#FFFFFF] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[#FFFFFF]">
                <Sparkles size={15} />
              </div>
              <div>
                <div className="text-[13.5px] font-bold tracking-tight">Term Jobs AI Assistant</div>
                <div className="text-[10px] text-[#A3A39F] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                  Dashboard Guide & Suggestions
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAiAssistant(false)}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-[#A3A39F] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          {/* Body (Scrollable) */}
          <div className="p-4 space-y-3.5 overflow-y-auto max-h-[58vh]">
            {/* Welcome & Context Banner */}
            <div
              style={{
                backgroundColor: '#F7F7F5',
                border: '1px solid #E5E5E0',
                borderRadius: 16,
              }}
              className="p-3.5 space-y-1.5"
            >
              <div className="text-[12px] font-extrabold text-[#0A0A0A] flex items-center gap-1.5">
                <Sparkles size={12} className="text-[#0A0A0A]" /> Active Onboarding Insight
              </div>
              <p className="text-[11.5px] text-[#737373] leading-relaxed">
                Hi <strong>{cand.name?.split(' ')[0] || 'Hashil'}</strong>, your assignment as <strong>{wo.requisition_title || 'DevOps Engineer'}</strong> at <strong>{wo.company_name || 'Bearitt'}</strong> is active! Here are smart suggestions to help you use your dashboard.
              </p>
            </div>

            {/* Smart Action Suggestions */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A85] mb-2">
                Smart Suggestions & FAQ
              </div>
              <div className="space-y-2">
                {AI_SUGGESTIONS.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: aiSelectedTopic === idx ? '#F5F5F2' : '#FFFFFF',
                      border: aiSelectedTopic === idx ? '1.5px solid #0A0A0A' : '1px solid #E5E5E0',
                      borderRadius: 14,
                    }}
                    className="p-3 transition-all cursor-pointer hover:border-[#B5B5AF]"
                    onClick={() => setAiSelectedTopic(aiSelectedTopic === idx ? null : idx)}
                  >
                    <div className="flex items-center justify-between text-[12px] font-bold text-[#0A0A0A]">
                      <span className="flex items-center gap-2">
                        <span className="text-[10.5px] text-[#8A8A85]">0{idx + 1}.</span>
                        {item.question}
                      </span>
                      <ChevronRight
                        size={13}
                        className={`text-[#8A8A85] transition-transform duration-200 shrink-0 ${
                          aiSelectedTopic === idx ? 'rotate-90 text-[#0A0A0A]' : ''
                        }`}
                      />
                    </div>

                    {aiSelectedTopic === idx && (
                      <div className="mt-2.5 pt-2.5 border-t border-[#E5E5E0] text-[11.5px] text-[#737373] space-y-2 leading-relaxed animate-in fade-in duration-150">
                        <p>{item.answer}</p>
                        {item.actionTab && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTab(item.actionTab);
                              setShowAiAssistant(false);
                            }}
                            style={{
                              backgroundColor: '#0A0A0A',
                              color: '#FFFFFF',
                              borderRadius: 8,
                            }}
                            className="px-3 py-1.5 text-[11px] font-bold hover:bg-[#262626] transition-colors flex items-center gap-1 mt-1 cursor-pointer"
                          >
                            {item.actionLabel} <ArrowRight size={11} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Dashboard Feature Guide Quick Links */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#8A8A85] mb-2">
                Dashboard Workspace Guide
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div
                  onClick={() => { setActiveTab('dashboard'); setShowAiAssistant(false); }}
                  className="p-2.5 rounded-xl border border-[#E5E5E0] hover:bg-[#F9F9F7] cursor-pointer"
                >
                  <div className="font-bold text-[#0A0A0A] flex items-center gap-1">
                    <Home size={12} /> Dashboard
                  </div>
                  <div className="text-[#8A8A85] mt-0.5 text-[10px]">Overview & Live Metrics</div>
                </div>

                <div
                  onClick={() => { setActiveTab('assignment'); setShowAiAssistant(false); }}
                  className="p-2.5 rounded-xl border border-[#E5E5E0] hover:bg-[#F9F9F7] cursor-pointer"
                >
                  <div className="font-bold text-[#0A0A0A] flex items-center gap-1">
                    <Briefcase size={12} /> Assignment
                  </div>
                  <div className="text-[#8A8A85] mt-0.5 text-[10px]">Contract & Manager details</div>
                </div>

                <div
                  onClick={() => { setActiveTab('timesheet'); setShowAiAssistant(false); }}
                  className="p-2.5 rounded-xl border border-[#E5E5E0] hover:bg-[#F9F9F7] cursor-pointer"
                >
                  <div className="font-bold text-[#0A0A0A] flex items-center gap-1">
                    <Clock size={12} /> Timesheet
                  </div>
                  <div className="text-[#8A8A85] mt-0.5 text-[10px]">Log & Submit weekly hours</div>
                </div>

                <div
                  onClick={() => { setActiveTab('expenses'); setShowAiAssistant(false); }}
                  className="p-2.5 rounded-xl border border-[#E5E5E0] hover:bg-[#F9F9F7] cursor-pointer"
                >
                  <div className="font-bold text-[#0A0A0A] flex items-center gap-1">
                    <IndianRupee size={12} /> Expenses
                  </div>
                  <div className="text-[#8A8A85] mt-0.5 text-[10px]">File claims with receipts</div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 bg-[#F9F9F7] border-t border-[#F0F0EC] text-center text-[10.5px] text-[#8A8A85]">
            Need help with your account? Click <strong>Raise Issue</strong> in the sidebar.
          </div>
        </div>
      )}
      {/* ========================================================
          EXISTING RAISE ISSUE MODAL (PRESERVED)
         ======================================================== */}
      {showRaiseIssue && (
        <RaiseIssueModal
          onClose={() => setShowRaiseIssue(false)}
          candidateId={cand.id}
          candidateName={cand.name}
          companyName={cand.company}
          token={token}
        />
      )}
    </div>
  );
}

function PieIcon({ size = 15, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  );
}

function RaiseIssueModal({ onClose, candidateId, candidateName, companyName, token }) {
  const [category, setCategory] = useState('access');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const CATEGORIES = [
    { value: 'access', label: 'Access not provided', desc: 'VPN, email, GitHub, Slack or system access missing' },
    { value: 'equipment', label: 'Equipment not received', desc: 'Laptop, badge or other equipment not delivered' },
    { value: 'training', label: 'Training issue', desc: 'Problem with onboarding training or compliance' },
    { value: 'relocation', label: 'Relocation / logistics', desc: 'Travel, accommodation or relocation support' },
    { value: 'other', label: 'Other', desc: 'Any other onboarding issue' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const selectedCat = CATEGORIES.find((c) => c.value === category);
      await request('/api/onboarding/issues', {
        method: 'POST',
        token,
        body: {
          candidate_id: candidateId,
          candidate_name: candidateName,
          company_name: companyName,
          category,
          category_label: selectedCat?.label || 'Onboarding Issue',
          description,
        },
      });
    } catch (err) {
      /* ignore */
    }
    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', borderRadius: 20, width: '90%', maxWidth: 480, boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}>
        {!submitted ? (
          <form onSubmit={handleSubmit}>
            <div style={{ padding: '24px 28px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F5F5F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Flag size={18} color="#0A0A0A" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0A0A0A', margin: 0 }}>Raise Issue</h3>
                    <p style={{ fontSize: '0.75rem', color: '#8A8A87', margin: 0 }}>Report an onboarding problem</p>
                  </div>
                </div>
                <button type="button" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #EDECE7', background: '#fff', color: '#6B6B67', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            </div>
            <div style={{ padding: '0 28px 24px' }}>
              <label style={{ display: 'block', marginBottom: 16 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#3A3A37', display: 'block', marginBottom: 8 }}>Issue type</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {CATEGORIES.map((cat) => (
                    <div
                      key={cat.value}
                      onClick={() => setCategory(cat.value)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: category === cat.value ? '1.5px solid #0A0A0A' : '1px solid #EDECE7',
                        background: category === cat.value ? '#F7F7F5' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0A0A0A' }}>{cat.label}</div>
                        <div style={{ fontSize: '0.72rem', color: '#8A8A87' }}>{cat.desc}</div>
                      </div>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', border: category === cat.value ? '5px solid #0A0A0A' : '1.5px solid #D9D8D2' }} />
                    </div>
                  ))}
                </div>
              </label>
              <label style={{ display: 'block', marginBottom: 20 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#3A3A37', display: 'block', marginBottom: 6 }}>Details</span>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what's missing or what went wrong..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D9D8D2', fontSize: '0.82rem', outline: 'none', resize: 'vertical' }}
                />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #D9D8D2', background: '#fff', fontSize: '0.82rem', fontWeight: 600, color: '#3A3A37', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#0A0A0A', color: '#fff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                  {submitting ? 'Submitting...' : 'Submit Issue'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div style={{ padding: '36px 28px', textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#F5F5F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Check size={22} color="#0A0A0A" />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0A0A0A', margin: '0 0 6px' }}>Issue Submitted</h3>
            <p style={{ fontSize: '0.8rem', color: '#8A8A87', margin: '0 0 20px', lineHeight: 1.5 }}>
              Your issue has been reported to the HR and IT operations team. They will resolve it and update your access shortly.
            </p>
            <button onClick={onClose} style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: '#0A0A0A', color: '#fff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
