import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Poll an async fetcher on an interval. Keeps the last good value on transient
 * errors and exposes the latest error message. `deps` restarts the poll loop.
 */
export function usePoll<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  deps: unknown[] = [],
): { data: T | null; error: string | null; loading: boolean; refresh: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let alive = true
    let inFlight = false
    const tick = async () => {
      if (inFlight) return
      inFlight = true
      try {
        const result = await fetcherRef.current()
        if (alive) {
          setData(result)
          setError(null)
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e))
      } finally {
        inFlight = false
        if (alive) setLoading(false)
      }
    }
    tick()
    const id = setInterval(tick, intervalMs)
    return () => {
      alive = false
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, nonce, ...deps])

  const refresh = useCallback(() => setNonce((n) => n + 1), [])
  return { data, error, loading, refresh }
}
