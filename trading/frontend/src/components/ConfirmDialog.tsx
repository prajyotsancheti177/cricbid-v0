import type { ReactNode } from 'react'

interface Props {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  /** Custom action buttons; if omitted, a Confirm/Cancel pair is rendered. */
  actions?: ReactNode
  onConfirm?: () => void
  confirmLabel?: string
  danger?: boolean
}

export function ConfirmDialog({ open, title, children, onClose, actions, onConfirm, confirmLabel = 'Confirm', danger }: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="card w-full max-w-md border-slate-700 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-lg font-semibold text-slate-100">{title}</h3>
        <div className="mb-5 text-sm text-slate-300">{children}</div>
        <div className="flex justify-end gap-2">
          {actions ?? (
            <>
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>
                {confirmLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
