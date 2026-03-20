'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { registerAction } from '@/lib/auth/actions'
import { PASSWORD_MIN_LENGTH } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Building2, Lock, Mail, User, Shield, AlertTriangle } from 'lucide-react'

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
          Création en cours...
        </span>
      ) : (
        'Créer le compte administrateur'
      )}
    </Button>
  )
}

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(formData: FormData) {
    setError(null)
    const result = await registerAction(formData)
    if (result?.error) {
      setError(result.error)
    } else if (result?.success) {
      router.push('/login?registered=true')
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
              Configuration initiale de votre institution
            </h2>
            <p className="text-white/70 text-base leading-relaxed">
              Créez le premier compte super-administrateur pour démarrer
              la configuration de votre espace délibérant.
            </p>
          </div>

          <div className="rounded-xl bg-white/10 backdrop-blur-sm p-5 space-y-3">
            <div className="flex items-center gap-2 text-white/90 font-medium text-sm">
              <Shield className="h-4 w-4" />
              <span>Super-administrateur</span>
            </div>
            <ul className="text-white/60 text-sm space-y-2 pl-6">
              <li>Configure l&apos;identité de l&apos;institution</li>
              <li>Crée les instances délibérantes</li>
              <li>Invite les gestionnaires et élus</li>
              <li>Gère les paramètres avancés</li>
            </ul>
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
              Configuration initiale
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Créez le premier compte Super-administrateur
            </p>
          </div>

          <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Cette page n&apos;est accessible que si aucun compte n&apos;existe encore.
              Après la création, les futurs utilisateurs seront invités par email.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form action={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm font-medium">
                Nom complet
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="Prénom Nom"
                  required
                  autoComplete="name"
                  className="pl-10 h-11"
                />
              </div>
            </div>

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
                  minLength={PASSWORD_MIN_LENGTH}
                  autoComplete="new-password"
                  className="pl-10 h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirmer le mot de passe
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Retapez le mot de passe"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  autoComplete="new-password"
                  className="pl-10 h-11"
                />
              </div>
            </div>

            <SubmitButton />
          </form>

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-institutional-blue transition-colors"
            >
              Déjà un compte ?{' '}
              <span className="font-medium text-institutional-blue">
                Se connecter
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
