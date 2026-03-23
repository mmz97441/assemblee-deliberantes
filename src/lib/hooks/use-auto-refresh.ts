'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface UseAutoRefreshOptions {
  /** Interval between refreshes in milliseconds. */
  intervalMs: number
  /** Whether the auto-refresh is active. Defaults to true. */
  enabled?: boolean
}

interface UseAutoRefreshReturn {
  /** Seconds since the last successful refresh. */
  secondsSinceRefresh: number
  /** Whether a refresh is currently in progress. */
  isRefreshing: boolean
}

/**
 * Hook that auto-refreshes the page at a given interval using router.refresh()
 * and exposes a live counter of seconds since the last refresh.
 */
export function useAutoRefresh({
  intervalMs,
  enabled = true,
}: UseAutoRefreshOptions): UseAutoRefreshReturn {
  const router = useRouter()
  const [secondsSinceRefresh, setSecondsSinceRefresh] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const lastRefreshRef = useRef(Date.now())

  const doRefresh = useCallback(() => {
    setIsRefreshing(true)
    router.refresh()
    // router.refresh() is async internally but returns void;
    // we mark done after a short delay to show the indicator briefly.
    setTimeout(() => {
      lastRefreshRef.current = Date.now()
      setSecondsSinceRefresh(0)
      setIsRefreshing(false)
    }, 300)
  }, [router])

  // Auto-refresh interval
  useEffect(() => {
    if (!enabled) return
    const interval = setInterval(doRefresh, intervalMs)
    return () => clearInterval(interval)
  }, [doRefresh, intervalMs, enabled])

  // Tick the counter every second
  useEffect(() => {
    if (!enabled) return
    const tick = setInterval(() => {
      setSecondsSinceRefresh(Math.floor((Date.now() - lastRefreshRef.current) / 1000))
    }, 1000)
    return () => clearInterval(tick)
  }, [enabled])

  return { secondsSinceRefresh, isRefreshing }
}
