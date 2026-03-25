'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="fr">
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#991b1b', marginBottom: '1rem' }}>
            Erreur critique
          </h1>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem', textAlign: 'center' }}>
            Une erreur grave est survenue. Nos équipes ont été automatiquement notifiées.
          </p>
          <button
            onClick={() => reset()}
            style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem' }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  )
}
