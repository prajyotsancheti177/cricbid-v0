// Formatting helpers — Indian rupee grouping, timestamps, P&L coloring.

export function fmtInr(n: number, decimals = 2): string {
  return '₹' + n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function fmtInrCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`
  if (abs >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`
  return `₹${n.toFixed(0)}`
}

export function fmtSigned(n: number, decimals = 2): string {
  const s = fmtInr(Math.abs(n), decimals)
  return n < 0 ? `-${s}` : `+${s}`
}

export function fmtPct(n: number, decimals = 2): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(decimals)}%`
}

/** Tailwind text color class for a signed P&L number. */
export function pnlClass(n: number): string {
  if (n > 0) return 'text-emerald-400'
  if (n < 0) return 'text-red-400'
  return 'text-slate-400'
}

export function fmtTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
