import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { API_BASE_URL } from '../api/client';

export default function ResumePreviewModal({ token, filename, extractedText, onClose }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl;
    async function loadResume() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/candidate-profile/resume`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Could not load your uploaded resume. Please try again.');
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setPreview({ url: objectUrl, isPdf: blob.type === 'application/pdf' || /\.pdf$/i.test(filename) });
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      }
    }
    loadResume();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, filename]);

  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-3 sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Uploaded resume preview"
        className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-neutral-900">Uploaded Resume</h2>
            <p className="truncate text-xs text-neutral-500">{filename}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close resume preview"
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100">Close</button>
        </div>
        <div className="min-h-0 flex-1 bg-neutral-100">
          {error ? <p role="alert" className="p-5 text-sm text-red-700">{error}</p>
            : !preview ? <p role="status" className="p-5 text-sm text-neutral-600">Loading resume…</p>
            : preview.isPdf ? <iframe title="Uploaded resume" src={preview.url} className="h-full w-full border-0" />
            : <div className="h-full overflow-auto p-5">
                <p className="mb-3 text-xs text-neutral-500">Text preview of the uploaded Word document</p>
                {extractedText ? <pre className="whitespace-pre-wrap break-words rounded-xl bg-white p-5 text-sm text-neutral-800">{extractedText}</pre>
                  : <p className="text-sm text-neutral-700">A text preview is unavailable for this document. You can download the original file below.</p>}
              </div>}
        </div>
        {preview && <div className="flex justify-end border-t p-3">
          <a href={preview.url} download={filename || 'resume'}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold text-white">Download original</a>
        </div>}
      </div>
    </div>,
    document.body,
  );
}
