import { useState, useEffect, useRef, useCallback } from 'react';
import { interviewApi } from '../services/interviewApi';

/**
 * Custom Hook for AI Interview Focus Monitoring & Progressive Malpractice Prevention
 *
 * Implements:
 * - document.visibilitychange (detects hidden tab)
 * - window.blur / window.focus (detects window or app focus loss)
 * - Fullscreen exit detection
 * - Anti-duplication state machine: unified incident tracking prevents duplicate
 *   events from simultaneous visibilitychange and blur fires.
 * - Resilient offline queuing with automatic retry upon network restoration.
 * - Progressive violation levels:
 *     Level 1: Warning banner
 *     Level 2: Strong warning modal (flagged for recruiter review)
 *     Level 3+: Critical warning modal with interview response pause
 */
export function useFocusMonitoring({
  roundId,
  candidateToken = '',
  activeQuestionNumber = 1,
  initialFocusEvents = [],
  enabled = true,
  onViolation = null,
  onFocusLost = null,
  onFocusRestored = null,
}) {
  const storageKey = roundId ? `tj_focus_incidents_${roundId}` : null;
  const initialCacheRef = useRef((() => {
    if (!storageKey || typeof window === 'undefined') return { count: 0, incidents: [] };
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed?.incidents) ? parsed.incidents : [];
        const count = typeof parsed?.incidentCount === 'number' ? parsed.incidentCount : list.length;
        return { count, incidents: list };
      }
    } catch (_) {}
    return { count: 0, incidents: [] };
  })());

  const initialList = initialCacheRef.current.incidents.length > 0
    ? initialCacheRef.current.incidents
    : (Array.isArray(initialFocusEvents) ? initialFocusEvents : []);
  const initialCount = Math.max(initialCacheRef.current.count, initialList.length);

  const [isFocusLost, setIsFocusLost] = useState(false);
  const [incidents, setIncidents] = useState(initialList);
  const [incidentCount, setIncidentCount] = useState(initialCount);
  const [currentViolation, setCurrentViolation] = useState(null);
  const [showReturnToast, setShowReturnToast] = useState(false);

  // Sync incidents to sessionStorage on change
  useEffect(() => {
    if (!storageKey) return;
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          incidentCount,
          incidents,
        })
      );
    } catch (_) {}
  }, [storageKey, incidentCount, incidents]);

  // Sync if initialFocusEvents loads asynchronously from backend
  useEffect(() => {
    if (Array.isArray(initialFocusEvents) && initialFocusEvents.length > 0) {
      setIncidents((prev) => (prev.length >= initialFocusEvents.length ? prev : initialFocusEvents));
      setIncidentCount((prev) => Math.max(prev, initialFocusEvents.length));
    }
  }, [initialFocusEvents]);

  // References for reliable state access inside event listeners
  const incidentActiveRef = useRef(false);
  const incidentStartTimeRef = useRef(null);
  const incidentTypeRef = useRef('tab_hidden');
  const incidentQuestionRef = useRef(activeQuestionNumber);
  incidentQuestionRef.current = activeQuestionNumber;

  const returnDebounceTimerRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const offlineQueueRef = useRef([]);
  const isFlushingRef = useRef(false);

  // Flush queued events to backend API with automatic retry
  const flushQueue = useCallback(async () => {
    if (!roundId || isFlushingRef.current || offlineQueueRef.current.length === 0) return;
    isFlushingRef.current = true;

    const remainingQueue = [];
    while (offlineQueueRef.current.length > 0) {
      const eventItem = offlineQueueRef.current[0];
      try {
        await interviewApi.recordFocusEvent(roundId, eventItem, candidateToken);
        offlineQueueRef.current.shift(); // Successfully sent
      } catch (err) {
        console.warn('[Focus Monitoring] Transient network error, will retry queued incident:', err);
        remainingQueue.push(...offlineQueueRef.current);
        break;
      }
    }
    offlineQueueRef.current = remainingQueue;
    isFlushingRef.current = false;
  }, [roundId, candidateToken]);

  // Handle Focus Loss (starts a single unified incident)
  const handleFocusLoss = useCallback(
    (detectedType = 'tab_hidden') => {
      if (!enabled) return;
      if (incidentActiveRef.current) return; // Prevent duplicate incident while already lost

      incidentActiveRef.current = true;
      incidentStartTimeRef.current = Date.now();
      incidentTypeRef.current = detectedType;

      setIsFocusLost(true);
      setShowReturnToast(false);

      if (onFocusLost) {
        try {
          onFocusLost(detectedType);
        } catch (_) {}
      }
    },
    [enabled, onFocusLost]
  );

  // Handle Focus Regain (resolves the incident)
  const handleFocusRegain = useCallback(() => {
    if (!enabled || !incidentActiveRef.current) return;

    if (returnDebounceTimerRef.current) {
      clearTimeout(returnDebounceTimerRef.current);
    }

    returnDebounceTimerRef.current = setTimeout(async () => {
      if (!incidentActiveRef.current) return;

      const endTime = Date.now();
      const startTime = incidentStartTimeRef.current || endTime;
      const durationSeconds = Math.max(0.1, Math.round(((endTime - startTime) / 1000) * 10) / 10);

      // Filter out accidental micro-flickers under 200ms
      if (durationSeconds < 0.2) {
        incidentActiveRef.current = false;
        incidentStartTimeRef.current = null;
        setIsFocusLost(false);
        return;
      }

      setIncidentCount((prevCount) => {
        const nextSequence = prevCount + 1;
        let violationLevel = 'warning';
        if (nextSequence === 2) {
          violationLevel = 'strong_warning';
        } else if (nextSequence >= 3) {
          violationLevel = 'critical_warning';
        }

        const incidentRecord = {
          client_event_id: `fevt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          event_type: incidentTypeRef.current,
          incident_sequence: nextSequence,
          question_number: incidentQuestionRef.current,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          duration_seconds: durationSeconds,
          violation_level: violationLevel,
        };

        setIncidents((prev) => [...prev, incidentRecord]);
        setCurrentViolation(incidentRecord);

        // Queue for background transmission
        offlineQueueRef.current.push(incidentRecord);
        flushQueue();

        // Show brief Return toast
        setShowReturnToast(true);
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => {
          setShowReturnToast(false);
        }, 4000);

        if (onFocusRestored) {
          try {
            onFocusRestored(incidentRecord);
          } catch (_) {}
        }

        if (onViolation) {
          try {
            onViolation(incidentRecord, nextSequence, violationLevel);
          } catch (_) {}
        }

        return nextSequence;
      });

      incidentActiveRef.current = false;
      incidentStartTimeRef.current = null;
      setIsFocusLost(false);
    }, 150);
  }, [enabled, flushQueue, onFocusRestored, onViolation]);

  // Dismiss currently showing violation modal
  const dismissViolation = useCallback(() => {
    setCurrentViolation(null);
  }, []);

  // Set up browser event listeners
  useEffect(() => {
    if (!enabled) return;

    const onVisibilityChange = () => {
      if (document.hidden) {
        handleFocusLoss('tab_hidden');
      } else {
        handleFocusRegain();
      }
    };

    const onWindowBlur = () => {
      // Only treat as window blur if document is not already hidden (to avoid duplicating tab_hidden)
      if (!document.hidden) {
        handleFocusLoss('window_blur');
      }
    };

    const onWindowFocus = () => {
      handleFocusRegain();
    };

    const onFullscreenChange = () => {
      if (document.fullscreenElement === null && window.sessionStorage.getItem('interview_was_fullscreen')) {
        handleFocusLoss('fullscreen_exit');
      }
    };

    const onOnline = () => {
      flushQueue();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('online', onOnline);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('online', onOnline);
      if (returnDebounceTimerRef.current) clearTimeout(returnDebounceTimerRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [enabled, handleFocusLoss, handleFocusRegain, flushQueue]);

  return {
    isFocusLost,
    incidents,
    incidentCount,
    currentViolation,
    showReturnToast,
    dismissViolation,
  };
}

