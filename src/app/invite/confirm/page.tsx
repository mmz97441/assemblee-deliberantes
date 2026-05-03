'use client'

import { useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { acceptInvitationAction } from '@/lib/auth/actions'
import { PASSWORD_MIN_LENGTH } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Building2, Lock, AlertCircle, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super-administrateur',
  president: 'Président(e) de séance',
  gestionnaire: 'Gestionnaire',
  secretaire_seance: 'Secrétaire de séance',
  elu: 'Élu(e) / Membre votant',
  preparateur: 'Préparateur',
}

// Description courte de ce que le rôle pourra faire — pour rassurer
// l'utilisateur dès l'écran d'activation.
const ROLE_DESCRIPTIONS: Record<string, string> = {
  super_admin: 'Vous aurez accès à toutes les fonctionnalités, y compris la configuration de l\'institution.',
  president: 'Vous présiderez les séances, validerez les votes et signerez les procès-verbaux.',
  gestionnaire: 'Vous préparerez les séances, gérerez les convocations et superviserez le déroulement.',
  secretaire_seance: 'Vous tiendrez les notes en séance et préparerez les procès-verbaux.',
  elu: 'Vous serez convoqué aux séances, vous voterez et consulterez les procès-verbaux.',
  preparateur: 'Vous préparerez les dossiers et l\'ordre du jour des séances.',
}

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
          Activation en cours…
        </span>
      ) : (
        <>
          <Sparkles className="h-4 w-4 mr-2" />
          Activer mon compte
        </>
      )}
    </Button>
  )
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null

  let strength = 0
  if (password.length >= PASSWORD_MIN_LENGTH) strength++
  if (/[A-Z]/.test(password)) strength++
  if (/[a-z]/.test(password)) strength++
  if (/\d/.test(password)) strength++
  if (/[^A-Za-z0-9]/.test(password)) strength++

  const labels = ['Très faible', 'Faible', 'Moyen', 'Bon', 'Excellent']
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-400', 'bg-emerald-600']
  const index = Math.min(strength, 4)

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i <= index ? colors[index] : 'bg-muted'}`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Force : <span className="font-medium">{labels[index]}</span>
        {password.length < PASSWORD_MIN_LENGTH && (
          <span className="text-destructive ml-1">
            — {PASSWORD_MIN_LENGTH - password.length} caractère{PASSWORD_MIN_LENGTH - password.length > 1 ? 's' : ''} restant{PASSWORD_MIN_LENGTH - password.length > 1 ? 's' : ''}
          </span>
        )}
      </p>
    </div>
  )
}

export default function InviteConfirmPage() {
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [userInfo, setUserInfo] = useState<{ email: string; fullName: string | null; role: string | null } | null>(null)
  const router = useRouter()

  // Récupérer les infos de l'invité depuis la session établie par /auth/confirm
  // (full_name + role sont dans user_metadata, posés au moment de l'invitation).
  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      if (data?.user) {
        setUserInfo({
          email: data.user.email || '',
          fullName: (data.user.user_metadata?.full_name as string | undefined) || null,
          role: (data.user.user_metadata?.role as string | undefined) || null,
        })
      }
    }
    loadUser()
  }, [])

  const passwordsMatch = password && confirmPassword && password === confirmPassword
  const passwordTooShort = password.length > 0 && password.length < PASSWORD_MIN_LENGTH
  const showMismatch = confirmPassword.length > 0 && password !== confirmPassword

  async function handleSubmit(formData: FormData) {
    setError(null)
    const newPassword = formData.get('password') as string
    const confirm = formData.get('confirmPassword') as string

    if (newPassword !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setError(`Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`)
      return
    }

    const result = await acceptInvitationAction(formData)
    if (result?.error) {
      setError(result.error)
    } else if (result?.success) {
      router.push('/dashboard')
    }
  }

  const roleLabel = userInfo?.role ? (ROLE_LABELS[userInfo.role] || userInfo.role) : null
  const roleDescription = userInfo?.role ? ROLE_DESCRIPTIONS[userInfo.role] : null

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
              {process.env.NEXT_PUBLIC_INSTITUTION_NAME || 'Assemblées Délibérantes'}
            </span>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold leading-tight mb-4" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
              Bienvenue {userInfo?.fullName ? userInfo.fullName.split(' ')[0] : ''} !
            </h2>
            <p className="text-white/70 text-base leading-relaxed">
              Vous avez été invité(e) à rejoindre la plateforme de gestion des assemblées délibérantes.
              Choisissez un mot de passe sécurisé pour activer votre compte.
            </p>
          </div>

          {roleLabel && (
            <div className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-white/70" />
                <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
                  Votre rôle
                </span>
              </div>
              <p className="text-base font-semibold mb-1">{roleLabel}</p>
              {roleDescription && (
                <p className="text-sm text-white/70 leading-relaxed">{roleDescription}</p>
              )}
            </div>
          )}

          <div className="space-y-2 text-sm text-white/70">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-300" />
              <span>Votre adresse <strong className="text-white">{userInfo?.email}</strong> sera votre identifiant.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-300" />
              <span>Mot de passe d&apos;au moins {PASSWORD_MIN_LENGTH} caractères, mélange recommandé.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-300" />
              <span>Vous arriverez ensuite directement sur votre tableau de bord.</span>
            </div>
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
        <div className="w-full max-w-[400px] space-y-6">
          {/* Mobile branding */}
          <div className="lg:hidden flex items-center gap-3 justify-center mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-institutional-navy text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold text-institutional-navy" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
              {process.env.NEXT_PUBLIC_INSTITUTION_NAME || 'Assemblées Délibérantes'}
            </span>
          </div>

          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
              Activez votre compte
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {userInfo?.email
                ? <>Pour l&apos;adresse <strong>{userInfo.email}</strong></>
                : 'Choisissez votre mot de passe pour finaliser l\'inscription'}
            </p>
          </div>

          {/* Mobile : afficher le rôle (sinon caché à droite) */}
          {roleLabel && (
            <div className="lg:hidden rounded-lg border bg-blue-50/50 border-blue-100 p-3">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-4 w-4 text-blue-700" />
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                  Votre rôle
                </span>
              </div>
              <p className="text-sm font-semibold text-foreground">{roleLabel}</p>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form action={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Choisissez un mot de passe
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <PasswordInput
                  id="password"
                  name="password"
                  placeholder={`Minimum ${PASSWORD_MIN_LENGTH} caractères`}
                  required
                  autoComplete="new-password"
                  autoFocus
                  className={`pl-10 h-11 ${passwordTooShort ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <PasswordStrength password={password} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirmer le mot de passe
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="Retapez le mot de passe"
                  required
                  autoComplete="new-password"
                  className={`pl-10 h-11 ${showMismatch ? 'border-destructive focus-visible:ring-destructive' : ''} ${passwordsMatch ? 'border-emerald-500 focus-visible:ring-emerald-500' : ''}`}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {showMismatch && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Les mots de passe ne correspondent pas
                </p>
              )}
              {passwordsMatch && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Les mots de passe correspondent
                </p>
              )}
            </div>

            <SubmitButton />
          </form>

          <p className="text-xs text-muted-foreground text-center">
            En activant votre compte, vous acceptez les conditions d&apos;utilisation
            de votre institution.
          </p>
        </div>
      </div>
    </div>
  )
}
