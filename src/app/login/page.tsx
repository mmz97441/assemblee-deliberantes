'use client'

import { Suspense, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { loginAction } from '@/lib/auth/actions'
import { PASSWORD_MIN_LENGTH } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      className="w-full bg-institutional-blue hover:bg-institutional-navy"
      disabled={pending}
    >
      {pending ? 'Connexion...' : 'Se connecter'}
    </Button>
  )
}

function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const justRegistered = searchParams.get('registered') === 'true'

  async function handleSubmit(formData: FormData) {
    setError(null)
    const result = await loginAction(formData)
    if (result?.error) {
      setError(result.error)
    } else if (result?.success) {
      router.push('/dashboard')
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-institutional-navy">
          Assemblees Deliberantes
        </CardTitle>
        <CardDescription>
          Connectez-vous a votre espace
        </CardDescription>
      </CardHeader>
      <CardContent>
        {justRegistered && (
          <Alert className="mb-4 border-institutional-success text-institutional-success">
            <AlertDescription>Compte cree avec succes ! Connectez-vous.</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Adresse email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="nom@institution.fr"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder={`Minimum ${PASSWORD_MIN_LENGTH} caracteres`}
              required
              autoComplete="current-password"
            />
          </div>
          <SubmitButton />
        </form>
        <div className="mt-6 text-center">
          <Link
            href="/register"
            className="text-sm text-institutional-blue hover:underline"
          >
            Premiere utilisation ? Creer le compte administrateur
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Suspense fallback={<div />}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
