'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { getPublicVoteInfo, verifyOTPAndVote } from '@/lib/actions/votes'
import { CheckCircle2, XCircle, Clock, AlertTriangle, Loader2, Vote } from 'lucide-react'

// ─── OTP Input Component ──────────────────────────────────────────────────────

function OTPInput({
  length = 6,
  value,
  onChange,
  disabled,
}: {
  length?: number
  value: string
  onChange: (val: string) => void
  disabled?: boolean
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const digits = value.padEnd(length, '').split('').slice(0, length)

  const handleChange = (index: number, char: string) => {
    if (!/^\d?$/.test(char)) return
    const newDigits = [...digits]
    newDigits[index] = char
    const newValue = newDigits.join('').replace(/\s/g, '')
    onChange(newValue)
    // Auto-advance to next input
    if (char && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    onChange(pasted)
    // Focus last filled or next empty
    const focusIndex = Math.min(pasted.length, length - 1)
    inputRefs.current[focusIndex]?.focus()
  }

  return (
    <div className="flex gap-2 sm:gap-3 justify-center">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]"
          maxLength={1}
          value={digits[i] || ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          disabled={disabled}
          autoFocus={i === 0}
          className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold
            border-2 border-gray-300 rounded-xl
            focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none
            disabled:bg-gray-100 disabled:text-gray-400
            transition-all"
          aria-label={`Chiffre ${i + 1} du code`}
        />
      ))}
    </div>
  )
}

// ─── Countdown Timer ──────────────────────────────────────────────────────────

function CountdownTimer({ expiresAt }: { expiresAt: Date | null }) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (!expiresAt) return
    const update = () => {
      const diff = expiresAt.getTime() - Date.now()
      setRemaining(Math.max(0, Math.floor(diff / 1000)))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  if (remaining === null) return null

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60

  if (remaining <= 0) {
    return (
      <div className="flex items-center gap-2 text-red-600 text-sm">
        <AlertTriangle className="h-4 w-4" />
        <span>Code expiré</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 text-sm ${remaining < 120 ? 'text-orange-600' : 'text-gray-500'}`}>
      <Clock className="h-4 w-4" />
      <span>Code valable encore {minutes}:{String(seconds).padStart(2, '0')}</span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type PageStep = 'loading' | 'otp' | 'voting' | 'success' | 'error'

export default function PublicVotePage() {
  const params = useParams()
  const voteId = params.voteId as string

  const [step, setStep] = useState<PageStep>('loading')
  const [otpValue, setOtpValue] = useState('')
  const [voteInfo, setVoteInfo] = useState<{
    question: string
    institutionName: string
    seanceTitre: string
    statut: string
    expires_at: string | null
  } | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [memberName, setMemberName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  // OTP expiry timer: from server timestamp, fallback to 8 minutes from page load
  const [otpExpiresAt, setOtpExpiresAt] = useState(() => new Date(Date.now() + 8 * 60 * 1000))

  // Load vote info
  useEffect(() => {
    async function load() {
      const result = await getPublicVoteInfo(voteId)
      if ('error' in result) {
        setErrorMessage(result.error)
        setStep('error')
        return
      }
      if (result.statut !== 'OUVERT') {
        setErrorMessage('Ce vote n\'est plus ouvert.')
        setStep('error')
        return
      }
      setVoteInfo(result)
      if (result.expires_at) {
        setOtpExpiresAt(new Date(result.expires_at))
      }
      setStep('otp')
    }
    load()
  }, [voteId])

  // Auto-submit OTP when 6 digits entered
  const handleOTPSubmit = useCallback(async () => {
    if (otpValue.length !== 6 || isSubmitting || otpVerified) return
    setOtpVerified(true)
    setStep('voting')
  }, [otpValue, isSubmitting, otpVerified])

  useEffect(() => {
    if (otpValue.length === 6 && !otpVerified) {
      handleOTPSubmit()
    }
  }, [otpValue, otpVerified, handleOTPSubmit])

  // Submit vote
  async function handleVote(choice: 'POUR' | 'CONTRE' | 'ABSTENTION') {
    setIsSubmitting(true)
    setErrorMessage('')

    const result = await verifyOTPAndVote(voteId, otpValue, choice)

    if ('error' in result) {
      setIsSubmitting(false)
      if (result.code === 'INVALID_OTP' || result.code === 'EXPIRED') {
        setOtpVerified(false)
        setStep('otp')
        setOtpValue('')
      }
      setErrorMessage(result.error)
      return
    }

    setMemberName(result.memberName)
    setStep('success')
    setIsSubmitting(false)
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
            <Vote className="h-8 w-8 text-blue-600" />
          </div>
          {voteInfo && (
            <>
              <h1 className="text-xl font-bold text-gray-900">{voteInfo.institutionName}</h1>
              <p className="text-sm text-gray-500 mt-1">{voteInfo.seanceTitre}</p>
            </>
          )}
        </div>

        {/* Loading */}
        {step === 'loading' && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-gray-500">Chargement du vote...</p>
          </div>
        )}

        {/* OTP Entry */}
        {step === 'otp' && (
          <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900">Entrez votre code de vote</h2>
              <p className="text-sm text-gray-500 mt-1">
                Code à 6 chiffres reçu par SMS
              </p>
            </div>

            <OTPInput
              value={otpValue}
              onChange={(val) => {
                setOtpValue(val)
                setErrorMessage('')
                setOtpVerified(false)
              }}
              disabled={isSubmitting}
            />

            <div className="flex justify-center">
              <CountdownTimer expiresAt={otpExpiresAt} />
            </div>

            {errorMessage && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <p className="text-xs text-gray-400 text-center">
              Code expiré ? Demandez un nouveau code au gestionnaire de séance.
            </p>
          </div>
        )}

        {/* Vote Choices */}
        {step === 'voting' && voteInfo && (
          <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Votez</h2>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-900">{voteInfo.question}</p>
              </div>
            </div>

            {errorMessage && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => handleVote('POUR')}
                disabled={isSubmitting}
                className="w-full h-16 rounded-xl text-lg font-bold
                  bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700
                  text-white transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center gap-3
                  shadow-md hover:shadow-lg"
              >
                {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : 'POUR'}
              </button>

              <button
                onClick={() => handleVote('CONTRE')}
                disabled={isSubmitting}
                className="w-full h-16 rounded-xl text-lg font-bold
                  bg-red-500 hover:bg-red-600 active:bg-red-700
                  text-white transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center gap-3
                  shadow-md hover:shadow-lg"
              >
                {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : 'CONTRE'}
              </button>

              <button
                onClick={() => handleVote('ABSTENTION')}
                disabled={isSubmitting}
                className="w-full h-16 rounded-xl text-lg font-bold
                  bg-gray-400 hover:bg-gray-500 active:bg-gray-600
                  text-white transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center gap-3
                  shadow-md hover:shadow-lg"
              >
                {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : 'ABSTENTION'}
              </button>
            </div>

            <div className="flex justify-center">
              <CountdownTimer expiresAt={otpExpiresAt} />
            </div>
          </div>
        )}

        {/* Success */}
        {step === 'success' && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Vote enregistré</h2>
            {memberName && (
              <p className="text-sm text-gray-600">
                Merci, {memberName}. Votre vote a bien été pris en compte.
              </p>
            )}
            <p className="text-xs text-gray-400">
              Vous pouvez fermer cette page.
            </p>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100">
              <XCircle className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Impossible de voter</h2>
            <p className="text-sm text-gray-600">{errorMessage}</p>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Télévote sécurisé par code OTP
        </p>
      </div>
    </div>
  )
}
