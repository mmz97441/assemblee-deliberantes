'use client'

import { useState, useEffect } from 'react'

/**
 * Returns the current date only on the client side to avoid hydration mismatches.
 * During SSR, returns null. After mount, returns new Date().
 * Updates every `refreshMs` milliseconds if provided.
 */
export function useClientDate(refreshMs?: number): Date | null {
  const [date, setDate] = useState<Date | null>(null)

  useEffect(() => {
    setDate(new Date())

    if (refreshMs && refreshMs > 0) {
      const interval = setInterval(() => setDate(new Date()), refreshMs)
      return () => clearInterval(interval)
    }
  }, [refreshMs])

  return date
}

/**
 * Returns the current year safely (no hydration mismatch).
 * Falls back to the provided fallback during SSR.
 */
export function useCurrentYear(): number {
  const [year, setYear] = useState(2026) // safe SSR fallback

  useEffect(() => {
    setYear(new Date().getFullYear())
  }, [])

  return year
}
