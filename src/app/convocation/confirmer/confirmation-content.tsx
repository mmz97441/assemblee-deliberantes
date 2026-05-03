'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { confirmPresence, signalAbsence } from '@/lib/actions/convocations'
import { CheckCircle2, XCircle, Loader2, Building2, RefreshCw, UserX } from 'lucide-react'

type Status = 'loading' | 'success_present' | 'success_absent' | 'absent_form' | 'error'

export function ConfirmationContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const action = searchParams.get('action') as 'present' | 'absent' | null

  const [status, setStatus] = useState<Status>('loading')
  const [seanceTitre, setSeanceTitre] = useState('')
  const [memberNom, setMemberNom] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [motif, setMotif] = useState('')
  const [submittingAbsence, setSubmittingAbsence] = useState(false)

  // Confirmation de présence (action=present par défaut pour rétrocompat
  // avec les anciens emails qui n'ont pas le param action)
  const doConfirm = useCallback(async (t: string) => {
    setStatus('loading')
    setErrorMsg('')
    try {
      const result = await confirmPresence(t)
      if ('error' in result) {
        setStatus('error')
        setErrorMsg(result.error)
      } else {
        setStatus('success_present')
        setSeanceTitre(result.seanceTitre)
        setMemberNom(result.memberNom)
      }
    } catch {
      setStatus('error')
      setErrorMsg(
        'Impossible de joindre le serveur. Vérifiez votre connexion internet et réessayez.'
      )
    }
  }, [])

  // Signaler absence — affiche d'abord un formulaire avec motif optionnel,
  // puis confirme l'enregistrement après clic sur le bouton.
  const doAbsence = useCallback(async (t: string, motifValue: string) => {
    setSubmittingAbsence(true)
    setErrorMsg('')
    try {
      const result = await signalAbsence(t, motifValue.trim() || undefined)
      if ('error' in result) {
        setStatus('error')
        setErrorMsg(result.error)
      } else {
        setStatus('success_absent')
        setSeanceTitre(result.seanceTitre)
        setMemberNom(result.memberNom)
      }
    } catch {
      setStatus('error')
      setErrorMsg(
        'Impossible de joindre le serveur. Vérifiez votre connexion internet et réessayez.'
      )
    } finally {
      setSubmittingAbsence(false)
    }
  }, [])

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMsg('Lien de confirmation invalide — aucun token fourni.')
      return
    }

    if (action === 'absent') {
      // On affiche d'abord le formulaire (l'utilisateur peut saisir un motif
      // optionnel avant de valider).
      setStatus('absent_form')
    } else {
      // Comportement par défaut : confirmer la présence
      doConfirm(token)
    }
  }, [token, action, retryCount, doConfirm])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-white mb-3">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold text-slate-800">
            {process.env.NEXT_PUBLIC_INSTITUTION_NAME || 'Assemblees Deliberantes'}
          </h1>
        </div>

        {/* Card */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          {status === 'loading' && (
            <div className="p-8 text-center">
              <Loader2 className="h-10 w-10 text-slate-400 animate-spin mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-800 mb-1">
                Confirmation en cours...
              </h2>
              <p className="text-sm text-slate-500">
                Veuillez patienter quelques instants.
              </p>
            </div>
          )}

          {status === 'success_present' && (
            <>
              <div className="bg-emerald-50 p-6 text-center border-b border-emerald-100">
                <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
                <h2 className="text-lg font-semibold text-emerald-900">
                  Présence confirmée !
                </h2>
              </div>
              <div className="p-6">
                <p className="text-sm text-slate-600 mb-4">
                  Merci <strong>{memberNom}</strong>, votre présence a été confirmée pour :
                </p>
                <div className="rounded-lg bg-slate-50 border p-4 mb-4">
                  <p className="font-semibold text-slate-800">{seanceTitre}</p>
                </div>
                <p className="text-xs text-slate-400 text-center">
                  Vous pouvez fermer cette page. Un rappel vous sera envoyé avant la séance.
                </p>
              </div>
            </>
          )}

          {status === 'absent_form' && (
            <>
              <div className="bg-amber-50 p-6 text-center border-b border-amber-100">
                <UserX className="h-12 w-12 text-amber-600 mx-auto mb-3" />
                <h2 className="text-lg font-semibold text-amber-900">
                  Signaler mon absence
                </h2>
                <p className="text-sm text-amber-700 mt-1">
                  Confirmez ci-dessous votre absence à la séance.
                </p>
              </div>
              <div className="p-6">
                <label htmlFor="motif" className="block text-sm font-medium text-slate-700 mb-2">
                  Motif de l&rsquo;absence{' '}
                  <span className="text-slate-400 font-normal">(optionnel)</span>
                </label>
                <textarea
                  id="motif"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Ex : empêchement professionnel, raison personnelle…"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 focus:outline-none resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">
                  {motif.length}/500 caractères
                </p>

                <div className="mt-4 p-3 rounded-lg bg-slate-50 border text-xs text-slate-600">
                  <strong>Pour donner procuration</strong> à un autre élu (CGCT L2121-20),
                  contactez le secrétariat de votre institution. Cette démarche nécessite
                  votre signature et l&rsquo;accord du mandataire.
                </div>

                <button
                  type="button"
                  onClick={() => token && doAbsence(token, motif)}
                  disabled={submittingAbsence}
                  className="w-full mt-4 flex items-center justify-center gap-2 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:bg-amber-400 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold text-white transition-colors"
                >
                  {submittingAbsence && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmer mon absence
                </button>
                {errorMsg && (
                  <p className="mt-3 text-xs text-red-600 text-center">{errorMsg}</p>
                )}
              </div>
            </>
          )}

          {status === 'success_absent' && (
            <>
              <div className="bg-amber-50 p-6 text-center border-b border-amber-100">
                <UserX className="h-12 w-12 text-amber-600 mx-auto mb-3" />
                <h2 className="text-lg font-semibold text-amber-900">
                  Absence enregistrée
                </h2>
              </div>
              <div className="p-6">
                <p className="text-sm text-slate-600 mb-4">
                  Merci <strong>{memberNom}</strong>, votre absence a été signalée pour :
                </p>
                <div className="rounded-lg bg-slate-50 border p-4 mb-4">
                  <p className="font-semibold text-slate-800">{seanceTitre}</p>
                </div>
                <p className="text-xs text-slate-400 text-center">
                  Le secrétariat est informé. Vous pouvez fermer cette page.
                </p>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="bg-red-50 p-6 text-center border-b border-red-100">
                <XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
                <h2 className="text-lg font-semibold text-red-900">
                  Erreur
                </h2>
              </div>
              <div className="p-6">
                <p className="text-sm text-slate-600 mb-4">
                  {errorMsg}
                </p>
                {token && (
                  <button
                    type="button"
                    onClick={() => setRetryCount(c => c + 1)}
                    className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors mb-3"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Réessayer
                  </button>
                )}
                <p className="text-xs text-slate-400 text-center">
                  Si le problème persiste, contactez le secrétariat de votre institution.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
