'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { updatePassword } from '@/lib/auth/actions'
import { PASSWORD_MIN_LENGTH } from '@/lib/constants'
import { ROLE_LABELS } from '@/lib/auth/helpers'
import type { UserRole } from '@/lib/supabase/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Lock, CheckCircle2, AlertCircle, User, Mail, Shield } from 'lucide-react'

interface UserProfileProps {
  fullName: string
  email: string
  role: UserRole
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      className="h-11 bg-institutional-navy hover:bg-institutional-blue transition-colors text-sm font-medium"
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

export function UserProfile({ fullName, email, role }: UserProfileProps) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const passwordsMatch = password && confirmPassword && password === confirmPassword
  const passwordTooShort = password.length > 0 && password.length < PASSWORD_MIN_LENGTH
  const showMismatch = confirmPassword.length > 0 && password !== confirmPassword

  const initials = fullName
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  async function handleSubmit(formData: FormData) {
    setError(null)
    setSuccess(false)

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
      setSuccess(true)
      setPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Informations du profil */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informations personnelles</CardTitle>
          <CardDescription>
            Vos informations de compte. Pour modifier votre nom ou votre email, contactez votre gestionnaire.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-institutional-navy text-white text-xl font-bold">
              {initials}
            </div>
            <div>
              <p className="text-lg font-semibold">{fullName}</p>
              <p className="text-sm text-muted-foreground">{ROLE_LABELS[role]}</p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Nom complet</p>
                <p className="text-sm font-medium">{fullName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Adresse email</p>
                <p className="text-sm font-medium">{email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Shield className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rôle</p>
                <p className="text-sm font-medium">{ROLE_LABELS[role]}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modification du mot de passe */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Modifier mon mot de passe
          </CardTitle>
          <CardDescription>
            Choisissez un nouveau mot de passe sécurisé d&apos;au moins {PASSWORD_MIN_LENGTH} caractères.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success && (
            <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800 mb-4">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription>
                Mot de passe modifié avec succès.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Nouveau mot de passe
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder={`Minimum ${PASSWORD_MIN_LENGTH} caractères`}
                  required
                  autoComplete="new-password"
                  className={`pl-10 h-11 ${passwordTooShort ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setSuccess(false) }}
                />
              </div>
              <PasswordStrength password={password} />
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
                  autoComplete="new-password"
                  className={`pl-10 h-11 ${showMismatch ? 'border-destructive focus-visible:ring-destructive' : ''} ${passwordsMatch ? 'border-emerald-500 focus-visible:ring-emerald-500' : ''}`}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setSuccess(false) }}
                />
              </div>
              {showMismatch && (
                <p className="text-xs text-destructive">Les mots de passe ne correspondent pas</p>
              )}
              {passwordsMatch && (
                <p className="text-xs text-emerald-600">Les mots de passe correspondent</p>
              )}
            </div>

            <div className="pt-2">
              <SubmitButton />
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
