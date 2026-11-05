import React from 'react';

export function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Reusable NEXUS-styled Panel Card.
 * Ultra-premium pure white canvas, subtle hairline border, and soft elevation.
 */
export function NexusPanel({
  title,
  subtitle,
  action,
  children,
  className = '',
  headerClassName = '',
  bodyClassName = ''
}) {
  return (
    <section className={classNames('rounded-2xl border border-[#EBEBEB] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_6px_20px_-4px_rgba(0,0,0,0.03)] overflow-hidden transition-all', className)}>
      {(title || action) && (
        <header className={classNames('flex items-center justify-between gap-3 border-b border-[#F0F0F0] px-5 sm:px-6 py-4 bg-white', headerClassName)}>
          <div>
            {typeof title === 'string' ? (
              <h2 className="text-sm font-semibold text-[#111111] tracking-tight">{title}</h2>
            ) : (
              title
            )}
            {subtitle && (
              <p className="text-xs text-[#71717A] font-normal mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
        </header>
      )}
      <div className={bodyClassName}>
        {children}
      </div>
    </section>
  );
}

/**
 * Reusable NEXUS-styled Page Header with executive serif typography.
 */
export function NexusPageHeader({
  title,
  subtitle,
  actions,
  badge,
  className = ''
}) {
  return (
    <div className={classNames('mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 shrink-0', className)}>
      <div className="min-w-0">
        {badge && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F4F4F5] text-[10.5px] font-semibold text-[#52525B] border border-[#E4E4E7] uppercase tracking-wider mb-2.5">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            <span>{badge}</span>
          </div>
        )}
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-[42px] font-normal tracking-tight text-[#111111] leading-tight select-none">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-xs sm:text-sm text-[#71717A] font-normal max-w-2xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 sm:pt-0">
          {actions}
        </div>
      )}
    </div>
  );
}

/**
 * Unified Multi-Segment KPI Grid.
 * Crisp pure-white segmented card with refined hairlines and bold tabular metrics.
 */
export function NexusKpiGrid({ items = [], className = '' }) {
  if (!items || items.length === 0) return null;

  return (
    <div className={classNames('rounded-2xl border border-[#EBEBEB] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_6px_20px_-4px_rgba(0,0,0,0.03)] overflow-hidden', className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {(items || []).map((c, i) => {
          const IconComp = c.icon;
          return (
            <div
              key={c.label}
              onClick={c.onClick}
              className={classNames(
                'p-5 sm:p-6 flex flex-col justify-between transition-all bg-white',
                c.onClick && 'cursor-pointer hover:bg-[#FAFAFA] active:scale-[0.99]',
                // Mobile hairline divider
                i > 0 && 'border-t border-[#F0F0F0] sm:border-t-0',
                // Tablet 2x2 dividers
                i % 2 === 1 && 'sm:border-l sm:border-[#F0F0F0]',
                i >= 2 && 'sm:border-t sm:border-[#F0F0F0]',
                // Desktop 4x1 divider lines
                i > 0 && 'lg:border-l lg:border-t-0 lg:border-[#F0F0F0]',
                i === 0 && 'lg:border-l-0'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#71717A]">{c.label}</span>
                {IconComp && (
                  <span className={classNames('flex size-7 items-center justify-center rounded-lg shadow-2xs shrink-0', c.tone || 'bg-[#F4F4F5] border border-[#E4E4E7] text-[#18181B]')}>
                    <IconComp className="size-3.5" />
                  </span>
                )}
              </div>
              <div className="mt-3.5">
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-semibold tabular-nums tracking-tight text-[#111111]">{c.value}</p>
                  {c.badge && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                      {c.badge}
                    </span>
                  )}
                </div>
                {c.sub && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-[#A1A1AA] font-normal truncate">
                    {c.sub}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Segmented Pill Tab Switcher
 */
export function NexusFilterPills({ options = [], active, onChange, className = '' }) {
  return (
    <div className={classNames('inline-flex items-center gap-1 rounded-xl bg-[#F4F4F5] p-1 border border-[#E4E4E7]', className)}>
      {(options || []).map((opt) => {
        const val = opt.value !== undefined ? opt.value : opt;
        const label = opt.label !== undefined ? opt.label : opt;
        const isSelected = active === val;
        return (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            className={classNames(
              'rounded-lg px-2.5 py-1 text-xs transition-all cursor-pointer select-none',
              isSelected
                ? 'bg-white text-[#111111] font-semibold shadow-xs'
                : 'text-[#71717A] hover:text-[#111111]'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
