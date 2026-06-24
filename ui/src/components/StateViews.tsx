import type { ReactNode } from 'react'

// ==================== Spinner ====================

interface SpinnerProps {
  size?: 'sm' | 'md'
}

export function Spinner({ size = 'md' }: SpinnerProps) {
  const dim = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'
  return (
    <div
      className={`${dim} border-2 border-accent/20 border-t-accent rounded-full animate-spin`}
    />
  )
}

// ==================== PageLoading ====================

export function PageLoading() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Spinner />
    </div>
  )
}

// ==================== CenteredLoading ====================

/** A small spinner + optional label, horizontally centered with vertical
 *  breathing room. For content blocks that aren't a full-height flex column
 *  (e.g. a market board section) where `PageLoading`'s flex-1 wouldn't
 *  expand. */
export function CenteredLoading({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-20 text-[13px] text-text-muted">
      <Spinner size="sm" />
      {label && <span>{label}</span>}
    </div>
  )
}

// ==================== EmptyState ====================

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-xl bg-bg-secondary border border-border/60 flex items-center justify-center text-text-muted/30 mb-4">
        {icon ?? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 9h.01M15 9h.01M9 15h6" />
          </svg>
        )}
      </div>
      <p className="text-sm font-medium text-text-muted">{title}</p>
      {description && (
        <p className="text-[12px] text-text-muted/60 mt-1.5 max-w-[280px]">{description}</p>
      )}
    </div>
  )
}
