'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { requestPasswordReset } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Building2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'

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
          Envoi en cours...
        </span>
      ) : (
        'Envoyer le lien de réinitialisation'
      )}
    </Button>
  )
}

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [sentEmail, setSentEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setError(null)
    const email = (formData.get('email') as string)?.trim()

    if (!email) {
      setError('Veuillez saisir votre adresse email.')
      return
    }

    const result = await requestPasswordReset(email)
    if (result?.success) {
      setSentEmail(email)
      setSent(true)
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
              Réinitialisation du mot de passe
            </h2>
            <p className="text-white/70 text-base leading-relaxed">
              Pas de panique ! Saisissez votre adresse email et nous vous enverrons
              un lien pour créer un nouveau mot de passe.
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
              Mot de passe oublié
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Saisissez votre email pour recevoir un lien de réinitialisation
            </p>
          </div>

          {sent ? (
            <div className="space-y-6">
              <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <AlertDescription className="space-y-2">
                  <p className="font-medium">Email envoyé !</p>
                  <p className="text-sm">
                    Si un compte est associé à <strong>{sentEmail}</strong>, vous recevrez
                    un lien de réinitialisation dans quelques instants.
                  </p>
                  <p className="text-xs text-emerald-600 mt-2">
                    Pensez à vérifier vos spams si vous ne trouvez pas l&apos;email.
                  </p>
                </AlertDescription>
              </Alert>

              <div className="text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-sm text-institutional-blue hover:underline transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour à la connexion
                </Link>
              </div>
            </div>
          ) : (
            <>
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
                      autoFocus
                      className="pl-10 h-11"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Saisissez l&apos;adresse email associée à votre compte
                  </p>
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
