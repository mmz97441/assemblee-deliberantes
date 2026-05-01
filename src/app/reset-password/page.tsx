'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updatePassword } from '@/lib/auth/actions'
import { PASSWORD_MIN_LENGTH } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Building2, Lock, ArrowLeft, AlertCircle } from 'lucide-react'

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
          Modification en cours...
        </span>
      ) : (
        'Modifier le mot de passe'
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
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= index ? colors[index] : 'bg-muted'
            }`}
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

export default function ResetPasswordPage() {
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const router = useRouter()

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

    const result = await updatePassword(newPassword)
    if (result?.error) {
      setError(result.error)
    } else if (result?.success) {
      router.push('/login?password_reset=true')
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
              Nouveau mot de passe
            </h2>
            <p className="text-white/70 text-base leading-relaxed">
              Choisissez un mot de passe sécurisé d&apos;au moins {PASSWORD_MIN_LENGTH} caractères.
              Mélangez lettres, chiffres et caractères spéciaux pour plus de sécurité.
            </p>
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
              Nouveau mot de passe
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Choisissez votre nouveau mot de passe
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form action={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Nouveau mot de passe
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
                <p className="text-xs text-destructive">Les mots de passe ne correspondent pas</p>
              )}
              {passwordsMatch && (
                <p className="text-xs text-emerald-600">Les mots de passe correspondent</p>
              )}
            </div>

            <SubmitButton />
          </form>

          <div className="text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-institutional-blue transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
