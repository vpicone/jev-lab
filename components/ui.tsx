import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-accent text-white hover:opacity-90 disabled:opacity-50',
    ghost: 'border border-border text-fg hover:bg-panel-2 disabled:opacity-50',
    danger: 'text-bad hover:bg-panel-2',
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${styles} ${className}`}
    />
  );
}

export function Panel({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-border bg-panel ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0" title={hint}>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="break-words font-mono text-sm tabular-nums">{value}</div>
    </div>
  );
}

export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent' }) {
  const styles = {
    neutral: 'bg-panel-2 text-muted',
    good: 'bg-good/15 text-good',
    warn: 'bg-warn/15 text-warn',
    bad: 'bg-bad/15 text-bad',
    accent: 'bg-accent-soft text-accent',
  }[tone];
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${styles}`}>{children}</span>;
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <pre className="whitespace-pre-wrap rounded-md border border-bad/40 bg-bad/10 p-3 text-xs text-bad">{message}</pre>
  );
}

export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={label}
        className="flex size-4 items-center justify-center rounded-full border border-border text-[10px] leading-none text-muted hover:text-fg focus-visible:text-fg"
      >
        i
      </button>
      <span
        role="tooltip"
        className="invisible absolute right-0 top-6 z-20 w-72 max-w-[calc(100vw-2rem)] break-words rounded-md border border-border bg-panel p-3 text-left text-xs font-normal leading-relaxed text-muted opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}
