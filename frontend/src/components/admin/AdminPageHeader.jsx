import React from 'react';
import { Link } from 'react-router-dom';

export function AdminMetric({ label, value, detail, icon: Icon, href }) {
  const Tag = href ? Link : 'div';
  return <Tag className="admin-metric" {...(href ? { to: href } : {})}>
    <div className="admin-metric-label"><span>{label}</span>{Icon && <Icon size={17} aria-hidden="true" />}</div>
    <div className="admin-metric-value">{value ?? '—'}</div>
    {detail && <div className="admin-metric-detail">{detail}</div>}
  </Tag>;
}

export default function AdminPageHeader({ title, description, section = 'Platform', children }) {
  return (
    <header className="admin-page-header">
      <div className="min-w-0">
        <p className="admin-eyebrow">Super Admin <span aria-hidden="true">/</span> {section}</p>
        <h1 className="admin-page-title">{title}</h1>
        {description && <p className="admin-page-description">{description}</p>}
      </div>
      {children && <div className="admin-page-actions" role="group" aria-label={`${typeof title === 'string' ? title : section} actions`}>{children}</div>}
    </header>
  );
}
