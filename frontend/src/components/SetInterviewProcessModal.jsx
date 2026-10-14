import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Plus,
  Trash2,
  GripVertical,
  Code,
  Users,
  Shield,
  Flag,
  Search,
  Award,
  ChevronDown,
  ChevronUp,
  Check,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { request } from '../api/client';
import { useAuth } from '../context/AuthContext';

const TEMPLATES = {
  technical: {
    id: 'technical',
    name: 'Technical Hiring',
    summary: 'Technical → HR → Manager → Final',
    rounds: [
      {
        id: 'r-1',
        title: 'Technical Interview',
        description: 'Evaluate technical skills',
        type: 'Technical',
      },
      {
        id: 'r-2',
        title: 'HR Interview',
        description: 'Cultural fit & communication',
        type: 'HR',
      },
      {
        id: 'r-3',
        title: 'Manager Interview',
        description: 'Project discussion & problem-solving',
        type: 'Manager',
      },
      {
        id: 'r-4',
        title: 'Final Review',
        description: 'Hiring decision',
        type: 'Final',
      },
    ],
  },
  non_technical: {
    id: 'non_technical',
    name: 'Non-Technical Hiring',
    summary: 'Screening → HR → Manager',
    rounds: [
      {
        id: 'r-1',
        title: 'Screening Round',
        description: 'Initial qualifications review',
        type: 'Screening',
      },
      {
        id: 'r-2',
        title: 'HR Interview',
        description: 'Cultural fit & communication',
        type: 'HR',
      },
      {
        id: 'r-3',
        title: 'Manager Interview',
        description: 'Role alignment & competencies',
        type: 'Manager',
      },
    ],
  },
  executive: {
    id: 'executive',
    name: 'Executive Hiring',
    summary: 'HR → Manager → Leadership → Final',
    rounds: [
      {
        id: 'r-1',
        title: 'HR Leadership Screening',
        description: 'Executive leadership assessment',
        type: 'HR',
      },
      {
        id: 'r-2',
        title: 'Department Head Interview',
        description: 'Strategy & domain depth',
        type: 'Manager',
      },
      {
        id: 'r-3',
        title: 'Leadership Panel',
        description: 'Executive committee evaluation',
        type: 'Leadership',
      },
      {
        id: 'r-4',
        title: 'Final Executive Review',
        description: 'Board alignment & sign-off',
        type: 'Final',
      },
    ],
  },
  custom: {
    id: 'custom',
    name: 'Custom Process',
    summary: 'Create your own interview rounds',
    rounds: [
      {
        id: 'r-1',
        title: 'Technical Interview',
        description: 'Evaluate technical skills',
        type: 'Technical',
      },
      {
        id: 'r-2',
        title: 'HR Interview',
        description: 'Cultural fit & communication',
        type: 'HR',
      },
      {
        id: 'r-3',
        title: 'Manager Interview',
        description: 'Project discussion & problem-solving',
        type: 'Manager',
      },
      {
        id: 'r-4',
        title: 'Final Review',
        description: 'Hiring decision',
        type: 'Final',
      },
    ],
  },
};

const ROUND_TYPES = ['Technical', 'HR', 'Manager', 'Final', 'Screening', 'Leadership'];

function getRoundIcon(type) {
  switch (type) {
    case 'Technical':
      return <Code size={16} />;
    case 'HR':
      return <Users size={16} />;
    case 'Manager':
      return <Shield size={16} />;
    case 'Final':
      return <Flag size={16} />;
    case 'Screening':
      return <Search size={16} />;
    case 'Leadership':
      return <Award size={16} />;
    default:
      return <Calendar size={16} />;
  }
}

export default function SetInterviewProcessModal({
  requisitionId,
  isOpen,
  onClose,
  requisitionTitle,
  requisitionCode,
  onSave,
}) {
  const { token } = useAuth();
  const [error, setError] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('custom');
  const [rounds, setRounds] = useState(TEMPLATES.custom.rounds);
  const [hasExistingDbRecord, setHasExistingDbRecord] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Drag and drop states
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Inline editing state: { id: string, field: 'title' | 'description' } | null
  const [editingTarget, setEditingTarget] = useState(null);

  // Load configured process from backend DB on mount / open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    async function loadProcessFromDb() {
      try {
        const res = await request(`/api/interviews/process/template?requisition_id=${encodeURIComponent(requisitionId)}`, { token, noCache: true });
        if (!isMounted) return;

        if (res && res.is_saved && Array.isArray(res.rounds) && res.rounds.length > 0) {
          setRounds(res.rounds);
          setSelectedTemplate(res.template || 'custom');
          setHasExistingDbRecord(true);
          return;
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Unable to load interview process.');
      }
    }

    loadProcessFromDb();

    return () => {
      isMounted = false;
    };
  }, [isOpen, requisitionId, token]);

  if (!isOpen) return null;

  // Handle template selection
  const handleSelectTemplate = (tplKey) => {
    setSelectedTemplate(tplKey);
    setRounds(
      TEMPLATES[tplKey].rounds.map((r, i) => ({
        ...r,
        id: `r-${Date.now()}-${i}`,
      }))
    );
  };

  // Update round title or description
  const handleUpdateField = (id, field, value) => {
    setRounds((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return { ...r, [field]: value };
        }
        return r;
      })
    );
    if (selectedTemplate !== 'custom') {
      setSelectedTemplate('custom');
    }
  };

  // Add a new round
  const handleAddRound = () => {
    const nextIdx = rounds.length + 1;
    const newId = `r-${Date.now()}`;
    const newRound = {
      id: newId,
      title: `Interview Round ${nextIdx}`,
      description: 'Custom evaluation criteria',
      type: 'Technical',
    };
    setRounds([...rounds, newRound]);
    if (selectedTemplate !== 'custom') {
      setSelectedTemplate('custom');
    }
    // Set immediate edit mode on the newly added round title
    setEditingTarget({ id: newId, field: 'title' });
  };

  // Delete a round
  const handleDeleteRound = (id) => {
    if (rounds.length <= 1) return;
    setRounds(rounds.filter((r) => r.id !== id));
    if (selectedTemplate !== 'custom') {
      setSelectedTemplate('custom');
    }
  };

  // Change round type
  const handleTypeChange = (id, newType) => {
    setRounds(
      rounds.map((r) => {
        if (r.id === id) {
          return { ...r, type: newType };
        }
        return r;
      })
    );
    if (selectedTemplate !== 'custom') {
      setSelectedTemplate('custom');
    }
  };

  // Move round up / down
  const moveRound = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= rounds.length) return;
    const updated = [...rounds];
    const [movedItem] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, movedItem);
    setRounds(updated);
    if (selectedTemplate !== 'custom') {
      setSelectedTemplate('custom');
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Transparent or standard ghost
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    moveRound(draggedIndex, targetIndex);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Save / Update Process to DB
  const handleSaveOrUpdate = async () => {
    setIsSaving(true);
    const payload = {
      template: selectedTemplate,
      rounds: rounds,
    };

    try {
      await request('/api/interviews/process/template', {
        method: 'POST', token, body: { ...payload, requisition_id: requisitionId },
      });
    } catch (err) {
      setError(err.message || 'Unable to save interview process.');
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    setSaveSuccess(true);
    setHasExistingDbRecord(true);

    if (onSave) {
      onSave(payload);
    }

    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <span className="sr-only">{requisitionTitle} {requisitionCode}</span>
      {error && <p role="alert" className="rounded bg-white p-3 text-red-600">{error}</p>}
      <div
        className="w-full max-w-4xl bg-white border border-black/[0.08] rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── TOP HEADER ── */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-black/[0.06] bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200/80 flex items-center justify-center text-gray-800 shadow-3xs shrink-0">
              <Calendar size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight leading-tight">
                  Set Interview Process
                </h2>
                {hasExistingDbRecord && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <Sparkles size={10} />
                    <span>Active for all requisitions</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 font-normal mt-0.5">
                Define the interview rounds for this requisition. You can customize rounds, order and evaluation type.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-black flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── MAIN CONTENT: TEMPLATES + REORDERABLE INTERVIEW ROUNDS ── */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 no-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Left Column: Default Templates */}
            <div className="md:col-span-4 space-y-3">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-gray-900 tracking-tight">
                  Default Templates
                </h3>
                <p className="text-[11px] text-gray-500 font-normal mt-0.5">
                  Use a template or create custom process.
                </p>
              </div>

              <div className="space-y-2 pt-1">
                {Object.values(TEMPLATES).map((tpl) => {
                  const isSelected = selectedTemplate === tpl.id;

                  return (
                    <div
                      key={tpl.id}
                      onClick={() => handleSelectTemplate(tpl.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${isSelected
                          ? 'bg-gray-50/80 border-black/20 shadow-3xs ring-1 ring-black/10'
                          : 'bg-white hover:bg-gray-50/50 border-gray-200/80'
                        }`}
                    >
                      {/* Radio Check Indicator */}
                      <div className="mt-0.5 shrink-0">
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center shadow-xs">
                            <Check size={11} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-gray-300 bg-white" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-gray-900 tracking-tight">
                          {tpl.name}
                        </div>
                        <div className="text-[11px] text-gray-500 font-medium mt-0.5 leading-tight">
                          {tpl.summary}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Reorderable Interview Rounds */}
            <div className="md:col-span-8 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-gray-900 tracking-tight">
                    Interview Rounds
                  </h3>
                  <span className="text-[10px] text-gray-400 font-medium hidden sm:inline">
                    (Drag cards or use arrows to reorder)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleAddRound}
                  className="px-3.5 py-1.5 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Add Round</span>
                </button>
              </div>

              {/* Movable / Reorderable Rounds Cards List */}
              <div className="space-y-2.5 pt-1">
                {rounds.map((round, idx) => {
                  const isBeingDragged = draggedIndex === idx;
                  const isDragTarget = dragOverIndex === idx && draggedIndex !== idx;

                  return (
                    <div
                      key={round.id}
                      draggable={!editingTarget}
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`bg-white border rounded-2xl p-3 sm:p-3.5 flex items-center gap-3 shadow-3xs transition-all group select-none ${
                        isBeingDragged
                          ? 'opacity-40 border-dashed border-black/40 bg-gray-50 scale-[0.99]'
                          : isDragTarget
                          ? 'border-black ring-2 ring-black/10 bg-gray-50/80'
                          : 'border-gray-200/80 hover:border-gray-300'
                      }`}
                    >
                      {/* Drag Handle & Quick Reorder Controls */}
                      <div className="flex flex-col items-center justify-center gap-0.5 shrink-0">
                        <div
                          className="text-gray-300 group-hover:text-gray-600 cursor-grab active:cursor-grabbing p-1 -m-1"
                          title="Drag to reorder"
                        >
                          <GripVertical size={15} />
                        </div>

                        {/* Quick Up/Down arrows on hover */}
                        <div className="hidden group-hover:flex items-center gap-0.5 text-gray-400">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveRound(idx, idx - 1)}
                            className="hover:text-black disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            <ChevronUp size={11} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === rounds.length - 1}
                            onClick={() => moveRound(idx, idx + 1)}
                            className="hover:text-black disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            <ChevronDown size={11} />
                          </button>
                        </div>
                      </div>

                      {/* Round Index Pill (Dynamically numbered 1, 2, 3...) */}
                      <div className="w-6 h-6 rounded-lg bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>

                      {/* Round Icon Box */}
                      <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200/80 text-gray-800 flex items-center justify-center shrink-0">
                        {getRoundIcon(round.type)}
                      </div>

                      {/* Round Title & Description (Editable on click / multiple press, auto-saves on blur) */}
                      <div className="min-w-0 flex-1">
                        {editingTarget?.id === round.id && editingTarget?.field === 'title' ? (
                          <input
                            type="text"
                            autoFocus
                            defaultValue={round.title}
                            onFocus={(e) => e.target.select()}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val) handleUpdateField(round.id, 'title', val);
                              setEditingTarget(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = e.target.value.trim();
                                if (val) handleUpdateField(round.id, 'title', val);
                                setEditingTarget(null);
                              } else if (e.key === 'Escape') {
                                setEditingTarget(null);
                              }
                            }}
                            className="w-full text-xs font-bold text-gray-900 bg-white border border-black/40 rounded-lg px-2 py-0.5 focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs"
                          />
                        ) : (
                          <div
                            onClick={() => setEditingTarget({ id: round.id, field: 'title' })}
                            onDoubleClick={() => setEditingTarget({ id: round.id, field: 'title' })}
                            className="text-xs font-bold text-gray-900 tracking-tight truncate cursor-text hover:bg-gray-100/80 px-1.5 -mx-1.5 py-0.5 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                            title="Click to edit name"
                          >
                            {round.title}
                          </div>
                        )}

                        {editingTarget?.id === round.id && editingTarget?.field === 'description' ? (
                          <input
                            type="text"
                            autoFocus
                            defaultValue={round.description}
                            onFocus={(e) => e.target.select()}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val) handleUpdateField(round.id, 'description', val);
                              setEditingTarget(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = e.target.value.trim();
                                if (val) handleUpdateField(round.id, 'description', val);
                                setEditingTarget(null);
                              } else if (e.key === 'Escape') {
                                setEditingTarget(null);
                              }
                            }}
                            className="w-full text-[11px] font-medium text-gray-600 bg-white border border-black/40 rounded-lg px-2 py-0.5 focus:outline-hidden focus:ring-1 focus:ring-black shadow-3xs mt-0.5"
                          />
                        ) : (
                          <div
                            onClick={() => setEditingTarget({ id: round.id, field: 'description' })}
                            onDoubleClick={() => setEditingTarget({ id: round.id, field: 'description' })}
                            className="text-[11px] text-gray-500 font-medium truncate mt-0.5 cursor-text hover:bg-gray-100/80 px-1.5 -mx-1.5 py-0.5 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                            title="Click to edit description"
                          >
                            {round.description}
                          </div>
                        )}
                      </div>

                      {/* Round Type Dropdown */}
                      <div className="shrink-0 relative">
                        <select
                          value={round.type}
                          onChange={(e) => handleTypeChange(round.id, e.target.value)}
                          className="appearance-none pl-3 pr-7 py-1.5 bg-gray-50/80 hover:bg-gray-100 border border-gray-200/80 rounded-xl text-xs font-bold text-gray-800 focus:outline-hidden focus:ring-1 focus:ring-black cursor-pointer"
                        >
                          {ROUND_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={12}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                        />
                      </div>

                      {/* Delete Action Button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteRound(round.id)}
                        disabled={rounds.length <= 1}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 ${rounds.length <= 1
                            ? 'text-gray-200 cursor-not-allowed'
                            : 'text-gray-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                          }`}
                        title="Delete round"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── MODAL BOTTOM ACTION BAR (Save / Update Button) ── */}
        <div className="p-4 sm:p-5 border-t border-black/[0.06] bg-white flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:text-black border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-gray-400 hidden sm:inline">
              Applies to all Interviews
            </span>

            <button
              type="button"
              onClick={handleSaveOrUpdate}
              disabled={isSaving}
              className={`px-6 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer ${saveSuccess
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-black hover:bg-gray-800 active:scale-[0.98]'
                } ${isSaving ? 'opacity-80 cursor-wait' : ''}`}
            >
              {isSaving ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <Check size={14} />
                  <span>{hasExistingDbRecord ? 'Updated!' : 'Saved!'}</span>
                </>
              ) : (
                <>
                  <span>{hasExistingDbRecord ? 'Update' : 'Save'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
