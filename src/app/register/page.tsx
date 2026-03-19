'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { registerAction } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full bg-[#1565C0] hover:bg-[#0D2B55]" disabled={pending}>
      {pending ? 'Creation en cours...' : 'Creer le compte administrateur'}
    </Button>
  )
}

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setError(null)
    const result = await registerAction(formData)
    if (result?.error) {
      setError(result.error)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F5F5] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-[#0D2B55]">
            Configuration initiale
          </CardTitle>
          <CardDescription>
            Creez le premier compte Super-administrateur.
            <br />
            <span className="text-xs text-[#E65100]">
              Cette page n&apos;est accessible que si aucun compte n&apos;existe.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nom complet</Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="Prenom Nom"
                required
                autoComplete="name"
              />
            </div>
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
                placeholder="Minimum 12 caracteres"
                required
                minLength={12}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Retapez le mot de passe"
                required
                minLength={12}
                autoComplete="new-password"
              />
            </div>
            <SubmitButton />
          </form>
          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm text-[#1565C0] hover:underline"
            >
              Deja un compte ? Se connecter
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
