import { useMemo } from 'react';
import { marked } from 'marked';

export default function JdPreview({ markdown }) {
  const html = useMemo(() => {
    if (!markdown) return '';
    return marked.parse(markdown, { gfm: true, breaks: true });
  }, [markdown]);

  if (!markdown) {
    return <p className="muted">No JD generated yet.</p>;
  }

  return (
    <div className="jd-preview">
      <div className="jd-preview-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
