import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

export type ToastKind = 'error' | 'success' | 'info'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastApi {
  push: (message: string, kind?: ToastKind) => void
  error: (message: string) => void
  success: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

const KIND_STYLE: Record<ToastKind, string> = {
  error: 'border-red-500/50 bg-red-950/90 text-red-200',
  success: 'border-emerald-500/50 bg-emerald-950/90 text-emerald-200',
  info: 'border-slate-600 bg-slate-800/95 text-slate-200',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const push = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextId.current++
    setToasts((ts) => [...ts, { id, kind, message }])
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 5000)
  }, [])

  const apiRef = useRef<ToastApi>({
    push,
    error: (m) => push(m, 'error'),
    success: (m) => push(m, 'success'),
  })
  apiRef.current.push = push

  return (
    <ToastContext.Provider value={apiRef.current}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-md border px-3 py-2 text-sm shadow-lg backdrop-blur ${KIND_STYLE[t.kind]}`}
            onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
