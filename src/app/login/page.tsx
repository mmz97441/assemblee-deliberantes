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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Building2, Lock, Mail, CheckCircle2 } from 'lucide-react'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      className="w-full h-11 bg-institutional-navy hover:bg-institutional-blue transition-colors text-sm font-medium"
      disabled={pending}
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          Connexion...
        </span>
      ) : (
        'Se connecter'
      )}
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
    <div className="flex min-h-screen">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-[45%] auth-brand-panel flex-col justify-between p-12 text-white relative">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
              Assemblées Délibérantes
            </span>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold leading-tight mb-4" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
              Gérez vos séances délibérantes en toute sérénité
            </h2>
            <p className="text-white/70 text-base leading-relaxed">
              Convocations, présences, votes, procès-verbaux — tout est centralisé
              dans un outil conçu pour les institutions publiques françaises.
            </p>
          </div>

          <div className="space-y-4">
            {[
              'Convocations et ordres du jour dématérialisés',
              'Votes conformes au CGCT',
              'Procès-verbaux générés automatiquement',
            ].map((feature, i) => (
              <div key={i} className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-white/60 shrink-0 mt-0.5" />
                <span className="text-white/80 text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-xs text-white/30">
            Solution conforme RGPD — Hébergement souverain
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-[400px] space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 justify-center mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-institutional-navy text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold text-institutional-navy" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
              Assemblées Délibérantes
            </span>
          </div>

          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
              Connexion
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Accédez à votre espace de gestion
            </p>
          </div>

          {justRegistered && (
            <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription>
                Compte créé avec succès ! Connectez-vous.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form action={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Adresse email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="nom@institution.fr"
                  required
                  autoComplete="email"
                  className="pl-10 h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Mot de passe
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={`Minimum ${PASSWORD_MIN_LENGTH} caractères`}
                  required
                  autoComplete="current-password"
                  className="pl-10 h-11"
                />
              </div>
            </div>

            <SubmitButton />
          </form>

          <div className="text-center">
            <Link
              href="/register"
              className="text-sm text-muted-foreground hover:text-institutional-blue transition-colors"
            >
              Première utilisation ?{' '}
              <span className="font-medium text-institutional-blue">
                Créer le compte administrateur
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><span className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" /></div>}>
      <LoginForm />
    </Suspense>
  )
}
