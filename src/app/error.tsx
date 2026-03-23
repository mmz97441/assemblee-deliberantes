'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // TODO Phase 1 Etape 12 : envoyer a Sentry
    console.error('Erreur application:', error.message, error.digest, error.stack)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-institutional-danger">
            Erreur inattendue
          </CardTitle>
          <CardDescription>
            Une erreur est survenue. Nos équipes ont été notifiées.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-1">
            {error.digest && (
              <p className="text-xs text-muted-foreground">
                Code : {error.digest}
              </p>
            )}
            {process.env.NODE_ENV === 'development' && (
              <p className="text-xs text-destructive font-mono break-all">
                {error.message}
              </p>
            )}
          </div>
          <div className="flex justify-center gap-4">
            <Button
              onClick={reset}
              className="bg-institutional-blue hover:bg-institutional-navy"
            >
              Réessayer
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = '/login'}
            >
              Retour à la connexion
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
