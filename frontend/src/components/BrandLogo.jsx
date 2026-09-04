import React from 'react';
import logoImg from '../assets/logo.png';

export default function BrandLogo({ size = 36, className = '', showText = false, textClass = '' }) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src={logoImg}
        alt="TermJobs Logo"
        style={{ width: size, height: size, objectFit: 'contain' }}
        className="shrink-0 transition-transform duration-200 hover:scale-105"
      />
      {showText && (
        <span className={`font-black tracking-tight ${textClass || 'text-base text-gray-900'}`}>
          TERMJOBS
        </span>
      )}
    </div>
  );
}
