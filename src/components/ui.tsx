import React, { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cx } from '../lib/utils';
import { useApp } from '../store/AppStore';

/* ------------------------------- branding -------------------------------- */

export const Logo: React.FC<{ size?: number; withText?: boolean; light?: boolean; className?: string }> = ({
  size = 44,
  withText = false,
  light = false,
  className,
}) => (
  <div className={cx('flex items-center gap-3', className)}>
    <img
      src="/logo.png"
      alt="Eastbridge International School crest"
      width={size}
      height={size}
      className="rounded-xl object-contain drop-shadow-sm"
      style={{ width: size, height: size }}
    />
    {withText && (
      <div className="leading-tight">
        <div className={cx('font-display font-bold text-base sm:text-lg', light ? 'text-white' : 'text-navy-700')}>
          Eastbridge
        </div>
        <div className={cx('text-[11px] font-bold uppercase tracking-[0.14em]', light ? 'text-gold-300' : 'text-gold-600')}>
          Quiz Arcade
        </div>
      </div>
    )}
  </div>
);

/* -------------------------------- buttons -------------------------------- */

type BtnVariant = 'primary' | 'gold' | 'teal' | 'ghost' | 'danger';

export const Btn = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: BtnVariant;
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    icon?: React.ReactNode;
  }
>(({ variant = 'primary', size = 'md', loading, icon, className, children, ...rest }, ref) => (
  <button
    ref={ref}
    className={cx(
      `btn-${variant}`,
      size === 'sm' && 'btn-sm',
      size === 'lg' && 'btn-lg',
      className,
    )}
    {...rest}
  >
    {loading ? <Spinner size={18} /> : icon}
    {children}
  </button>
));
Btn.displayName = 'Btn';

export const Spinner: React.FC<{ size?: number; className?: string }> = ({ size = 20, className }) => (
  <span
    role="status"
    aria-label="Loading"
    className={cx('inline-block animate-spin rounded-full border-2 border-current border-t-transparent', className)}
    style={{ width: size, height: size }}
  />
);

/* --------------------------------- layout -------------------------------- */

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { pad?: boolean }> = ({
  pad = true,
  className,
  children,
  ...rest
}) => (
  <div className={cx('card', pad && 'card-pad', className)} {...rest}>
    {children}
  </div>
);

export const SectionHeader: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, action, icon, className }) => (
  <div className={cx('flex flex-wrap items-start justify-between gap-3 mb-4', className)}>
    <div className="flex items-start gap-3">
      {icon && <div className="mt-0.5">{icon}</div>}
      <div>
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="text-sm text-navy-300 mt-1 max-w-2xl">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

export const Stat: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'navy' | 'gold' | 'teal' | 'sage' | 'red';
  icon?: React.ReactNode;
}> = ({ label, value, hint, tone = 'navy', icon }) => {
  const tones: Record<string, string> = {
    navy: 'bg-navy-50 text-navy-600',
    gold: 'bg-gold-100 text-gold-600',
    teal: 'bg-teal-100 text-teal-700',
    sage: 'bg-sage-100 text-sage-500',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="card p-4 flex items-start gap-3">
      {icon && <div className={cx('rounded-xl p-2.5 text-lg leading-none', tones[tone])}>{icon}</div>}
      <div className="min-w-0">
        <div className="text-xs font-bold uppercase tracking-wide text-navy-300">{label}</div>
        <div className="font-display text-2xl font-bold text-navy-700 leading-tight">{value}</div>
        {hint && <div className="text-xs text-navy-300 mt-0.5">{hint}</div>}
      </div>
    </div>
  );
};

export const ProgressBar: React.FC<{ value: number; tone?: 'navy' | 'gold' | 'teal' | 'sage' | 'red'; label?: string }> = ({
  value,
  tone = 'teal',
  label,
}) => {
  const pct = Math.max(0, Math.min(100, value));
  const colors: Record<string, string> = {
    navy: 'bg-navy-600',
    gold: 'bg-gold-500',
    teal: 'bg-teal-500',
    sage: 'bg-sage-500',
    red: 'bg-red-500',
  };
  return (
    <div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-navy-100"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
      >
        <div className={cx('h-full rounded-full transition-all duration-500', colors[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export const EmptyState: React.FC<{
  emoji?: string;
  title: string;
  body?: string;
  action?: React.ReactNode;
}> = ({ emoji = '🪶', title, body, action }) => (
  <div className="text-center py-12 px-4">
    <div className="text-5xl mb-3" aria-hidden="true">
      {emoji}
    </div>
    <h3 className="font-display text-lg font-bold text-navy-700">{title}</h3>
    {body && <p className="text-sm text-navy-300 mt-1 max-w-md mx-auto">{body}</p>}
    {action && <div className="mt-5 flex justify-center">{action}</div>}
  </div>
);

export const Tabs: React.FC<{
  tabs: Array<{ id: string; label: string; count?: number }>;
  value: string;
  onChange: (id: string) => void;
  className?: string;
}> = ({ tabs, value, onChange, className }) => (
  <div role="tablist" className={cx('flex gap-1.5 overflow-x-auto no-scrollbar p-1 bg-navy-50 rounded-2xl', className)}>
    {tabs.map((t) => (
      <button
        key={t.id}
        role="tab"
        aria-selected={value === t.id}
        onClick={() => onChange(t.id)}
        className={cx(
          'px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition',
          value === t.id ? 'bg-white text-navy-700 shadow-sm' : 'text-navy-500 hover:bg-white/60',
        )}
      >
        {t.label}
        {typeof t.count === 'number' && (
          <span className={cx('ml-2 rounded-full px-1.5 py-0.5 text-[11px]', value === t.id ? 'bg-navy-50' : 'bg-white/70')}>
            {t.count}
          </span>
        )}
      </button>
    ))}
  </div>
);

/* --------------------------------- modal --------------------------------- */

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  dark?: boolean;
}> = ({ open, onClose, title, children, footer, size = 'md', dark }) => {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const nodes = ref.current.querySelectorAll<HTMLElement>(
          'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
        );
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector<HTMLElement>('button,input,select,textarea')?.focus(), 60);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-navy-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            initial={{ y: 24, opacity: 0, scale: 0.99 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            className={cx(
              'relative w-full rounded-t-3xl sm:rounded-3xl shadow-lift max-h-[92dvh] overflow-y-auto',
              dark ? 'bg-arcade-800 text-white border border-white/10' : 'bg-cream-50',
              size === 'sm' && 'sm:max-w-sm',
              size === 'md' && 'sm:max-w-lg',
              size === 'lg' && 'sm:max-w-2xl',
              size === 'xl' && 'sm:max-w-4xl',
            )}
          >
            <div className="flex items-start justify-between gap-4 p-5 pb-0">
              {title && (
                <h2 id={titleId} className={cx('font-display text-xl font-bold', dark ? 'text-white' : 'text-navy-700')}>
                  {title}
                </h2>
              )}
              <button
                onClick={onClose}
                aria-label="Close dialog"
                className={cx(
                  'ml-auto rounded-full w-10 h-10 inline-flex items-center justify-center text-xl',
                  dark ? 'hover:bg-white/10 text-white' : 'hover:bg-navy-50 text-navy-500',
                )}
              >
                ✕
              </button>
            </div>
            <div className="p-5">{children}</div>
            {footer && <div className={cx('p-5 pt-0 flex flex-wrap justify-end gap-2')}>{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, body, confirmLabel = 'Confirm', destructive, onConfirm, onCancel }) => (
  <Modal open={open} onClose={onCancel} title={title} size="sm">
    {body && <p className="text-sm text-navy-500">{body}</p>}
    <div className="flex justify-end gap-2 mt-5">
      <Btn variant="ghost" onClick={onCancel}>
        Cancel
      </Btn>
      <Btn variant={destructive ? 'danger' : 'primary'} onClick={onConfirm}>
        {confirmLabel}
      </Btn>
    </div>
  </Modal>
);

/* --------------------------------- toasts -------------------------------- */

export const Toasts: React.FC = () => {
  const { toasts, dismissToast } = useApp();
  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[min(92vw,420px)]"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            className={cx(
              'flex items-start gap-3 rounded-2xl px-4 py-3 shadow-lift text-sm font-semibold',
              t.kind === 'success' && 'bg-navy-600 text-white',
              t.kind === 'error' && 'bg-red-600 text-white',
              t.kind === 'info' && 'bg-teal-500 text-white',
            )}
          >
            <span aria-hidden="true">{t.kind === 'success' ? '✅' : t.kind === 'error' ? '⚠️' : 'ℹ️'}</span>
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

/* -------------------------------- selectors ------------------------------- */

export const Field: React.FC<{
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
}> = ({ label, hint, error, htmlFor, children, required }) => (
  <div>
    <label className="label" htmlFor={htmlFor}>
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {error ? (
      <p className="text-xs text-red-600 mt-1 font-semibold">{error}</p>
    ) : (
      hint && <p className="hint">{hint}</p>
    )}
  </div>
);

export const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, description, disabled }) => (
  <label className="flex items-start justify-between gap-4 cursor-pointer py-2">
    <span>
      <span className="block text-sm font-bold text-navy-700">{label}</span>
      {description && <span className="block text-xs text-navy-300 mt-0.5">{description}</span>}
    </span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-7 w-12 shrink-0 rounded-full transition-colors mt-0.5',
        checked ? 'bg-teal-500' : 'bg-navy-100',
        disabled && 'opacity-50',
      )}
    >
      <span
        className={cx(
          'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all',
          checked ? 'left-[22px]' : 'left-0.5',
        )}
      />
    </button>
  </label>
);

/* ------------------------------- image + zoom ----------------------------- */

export const ZoomableImage: React.FC<{
  src?: string;
  alt?: string;
  className?: string;
  emoji?: string;
}> = ({ src, alt, className, emoji }) => {
  const { settings } = useApp();
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  if (!src || broken || settings.hideImages) return null;
  if (settings.hideImages) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cx('group relative block overflow-hidden rounded-2xl bg-navy-50 focus-visible:ring-4', className)}
        aria-label={`Enlarge image: ${alt || 'question picture'}`}
      >
        <img
          src={src}
          alt={alt || ''}
          loading="lazy"
          onError={() => setBroken(true)}
          className="w-full h-full max-h-[38vh] object-contain transition group-hover:scale-[1.02]"
        />
        <span className="absolute bottom-1.5 right-1.5 rounded-lg bg-navy-900/70 px-2 py-1 text-[10px] font-bold text-white opacity-0 group-hover:opacity-100">
          🔍 Zoom
        </span>
        {emoji && !src && <span className="text-3xl">{emoji}</span>}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={alt || 'Picture'} size="xl">
        <img src={src} alt={alt || ''} className="w-full rounded-xl max-h-[70vh] object-contain" />
        {alt && <p className="text-sm text-navy-300 mt-3">{alt}</p>}
      </Modal>
    </>
  );
};

/* ------------------------------- countdown -------------------------------- */

export const CountdownRing: React.FC<{ remaining: number; total: number; size?: number; label?: string }> = ({
  remaining,
  total,
  size = 64,
  label,
}) => {
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeOpacity={0.15} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={pct > 0.5 ? '#2A7F8F' : pct > 0.25 ? '#C8973A' : '#dc2626'}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 0.25s linear' }}
        />
      </svg>
      <span className="absolute font-display font-bold text-sm">{label ?? Math.ceil(remaining)}</span>
    </div>
  );
};
