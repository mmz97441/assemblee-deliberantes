'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { confirmPresence } from '@/lib/actions/convocations'
import { CheckCircle2, XCircle, Loader2, Building2 } from 'lucide-react'

type Status = 'loading' | 'success' | 'error'

export function ConfirmationContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<Status>('loading')
  const [seanceTitre, setSeanceTitre] = useState('')
  const [memberNom, setMemberNom] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMsg('Lien de confirmation invalide — aucun token fourni.')
      return
    }

    confirmPresence(token).then(result => {
      if ('error' in result) {
        setStatus('error')
        setErrorMsg(result.error)
      } else {
        setStatus('success')
        setSeanceTitre(result.seanceTitre)
        setMemberNom(result.memberNom)
      }
    })
  }, [token])

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

          {status === 'success' && (
            <>
              <div className="bg-emerald-50 p-6 text-center border-b border-emerald-100">
                <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
                <h2 className="text-lg font-semibold text-emerald-900">
                  Presence confirmee !
                </h2>
              </div>
              <div className="p-6">
                <p className="text-sm text-slate-600 mb-4">
                  Merci <strong>{memberNom}</strong>, votre presence a ete confirmee pour :
                </p>
                <div className="rounded-lg bg-slate-50 border p-4 mb-4">
                  <p className="font-semibold text-slate-800">{seanceTitre}</p>
                </div>
                <p className="text-xs text-slate-400 text-center">
                  Vous pouvez fermer cette page. Un rappel vous sera envoye avant la seance.
                </p>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="bg-red-50 p-6 text-center border-b border-red-100">
                <XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
                <h2 className="text-lg font-semibold text-red-900">
                  Erreur de confirmation
                </h2>
              </div>
              <div className="p-6">
                <p className="text-sm text-slate-600 mb-4">
                  {errorMsg}
                </p>
                <p className="text-xs text-slate-400 text-center">
                  Si le probleme persiste, contactez le secretariat de votre institution.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
