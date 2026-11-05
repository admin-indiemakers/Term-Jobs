import { useId, useRef, useState } from 'react';
import { Upload, FileText, CheckCircle2, X } from 'lucide-react';

export default function ResumeUploadField({ file, onChange, disabled = false, required = false }) {
  const id = useId();
  const input = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const select = (next) => {
    if (disabled || !next) return;
    if (!/\.(pdf|docx)$/i.test(next.name) || !next.size || next.size > 10 * 1024 * 1024) {
      setError('Choose a PDF or DOCX file under 10 MB that isn’t empty.');
      if (input.current) input.current.value = '';
      return;
    }
    setError('');
    onChange(next);
  };
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <label htmlFor={id} className="font-semibold text-neutral-800">Your resume {required && <span className="text-neutral-400">*</span>}</label>
        <span className="text-neutral-400">PDF or DOCX · Max 10 MB</span>
      </div>
      <div
        onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); select(e.dataTransfer.files?.[0]); }}
        className={`relative rounded-2xl border transition-colors focus-within:ring-2 focus-within:ring-neutral-900/20 ${file ? 'border-emerald-200 bg-emerald-50/40' : dragging ? 'border-neutral-900 bg-neutral-100' : 'border-dashed border-neutral-300 bg-neutral-50 hover:border-neutral-500 hover:bg-neutral-100/60'} ${disabled ? 'opacity-50' : ''}`}
      >
        <input ref={input} id={id} type="file" accept=".pdf,.docx" disabled={disabled} required={required && !file}
          aria-describedby={`${id}-hint`} className="sr-only" onChange={e => select(e.target.files?.[0])} />
        {file ? (
          <div className="flex items-center gap-3 p-4">
            <div className="flex h-11 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700"><FileText size={20} /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-900" title={file.name}>{file.name}</p>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-700"><CheckCircle2 size={12} /> Ready to upload · {file.size < 1024 * 1024 ? `${Math.ceil(file.size / 1024)} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`}</p>
              <label htmlFor={id} className="mt-1 inline-block cursor-pointer text-[11px] font-medium text-neutral-600 underline underline-offset-2">Choose another file</label>
            </div>
            <button type="button" disabled={disabled} aria-label="Remove selected resume" onClick={() => { onChange(null); setError(''); if (input.current) input.current.value = ''; }} className="rounded-full p-2 text-neutral-400 hover:bg-white hover:text-neutral-800"><X size={16} /></button>
          </div>
        ) : (
          <label htmlFor={id} className="flex cursor-pointer flex-col items-center px-5 py-7 text-center">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 shadow-xs"><Upload size={20} /></span>
            <span className="text-sm font-semibold text-neutral-900">Drop your resume here</span>
            <span className="mt-1 text-xs text-neutral-500">or <span className="font-semibold text-neutral-800 underline underline-offset-4">browse files</span></span>
          </label>
        )}
      </div>
      <p id={`${id}-hint`} className="mt-2 text-[11px] leading-relaxed text-neutral-500">Your resume helps hiring teams understand your experience.</p>
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
