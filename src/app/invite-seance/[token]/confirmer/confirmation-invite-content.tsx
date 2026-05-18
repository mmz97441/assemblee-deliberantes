'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, Loader2, CalendarDays, MapPin, Clock } from 'lucide-react'
import { confirmInviteAttendance, type PublicInviteView } from '@/lib/actions/invites'

interface Props {
  token: string
  invite: PublicInviteView
}

type Status = 'idle' | 'submitting' | 'success_confirmed' | 'success_declined' | 'error'

function formatLongDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatHeure(h: string | null): string {
  if (!h) return ''
  return h.slice(0, 5).replace(':', 'h')
}

function statutLabel(s: string): string | null {
  if (s === 'CONFIRME') return 'Vous avez déjà confirmé votre présence.'
  if (s === 'DECLINE') return 'Vous avez déjà décliné cette invitation.'
  return null
}

export function ConfirmationInviteContent({ token, invite }: Props) {
  const alreadyAnswered = statutLabel(invite.statut_invitation)
  const [status, setStatus] = useState<Status>(
    invite.statut_invitation === 'CONFIRME'
      ? 'success_confirmed'
      : invite.statut_invitation === 'DECLINE'
        ? 'success_declined'
        : 'idle'
  )
  const [errorMsg, setErrorMsg] = useState('')

  const seanceClotureeOuArchivee =
    invite.seance.statut === 'CLOTUREE' || invite.seance.statut === 'ARCHIVEE'

  const handleChoice = async (choice: 'CONFIRME' | 'DECLINE') => {
    setStatus('submitting')
    setErrorMsg('')
    try {
      const res = await confirmInviteAttendance(token, choice)
      if ('error' in res) {
        setStatus('error')
        setErrorMsg(res.error)
      } else {
        setStatus(choice === 'CONFIRME' ? 'success_confirmed' : 'success_declined')
      }
    } catch {
      setStatus('error')
      setErrorMsg('Impossible de joindre le serveur. Vérifiez votre connexion internet et réessayez.')
    }
  }

  const seanceTitre = invite.seance.titre || `${invite.seance.instance_nom ?? 'Séance'} du ${formatLongDate(invite.seance.date_seance)}`

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-blue-600 text-white px-6 py-5">
            <p className="text-xs uppercase tracking-wider opacity-80 mb-1">Invitation</p>
            <h1 className="text-lg font-semibold">{seanceTitre}</h1>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <p className="text-sm text-slate-500">Destinataire</p>
              <p className="text-base font-medium text-slate-900">
                {invite.civilite === 'MADAME' ? 'Madame' : invite.civilite === 'MONSIEUR' ? 'Monsieur' : ''} {invite.prenom} {invite.nom}
              </p>
              {(invite.qualite || invite.organisation) && (
                <p className="text-sm text-slate-500 italic">
                  {[invite.qualite, invite.organisation].filter(Boolean).join(' — ')}
                </p>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-2">
              <div className="flex items-start gap-3 text-sm text-slate-700">
                <CalendarDays className="h-4 w-4 mt-0.5 text-slate-400" />
                <span>{formatLongDate(invite.seance.date_seance)}</span>
              </div>
              {invite.seance.heure_debut && (
                <div className="flex items-start gap-3 text-sm text-slate-700">
                  <Clock className="h-4 w-4 mt-0.5 text-slate-400" />
                  <span>{formatHeure(invite.seance.heure_debut)}</span>
                </div>
              )}
              {invite.seance.lieu && (
                <div className="flex items-start gap-3 text-sm text-slate-700">
                  <MapPin className="h-4 w-4 mt-0.5 text-slate-400" />
                  <span>{invite.seance.lieu}</span>
                </div>
              )}
            </div>

            <div className="bg-amber-50 border-l-4 border-amber-400 px-4 py-3 rounded-r text-sm text-amber-900">
              Cette invitation est à titre d&apos;observateur(trice) :
              vous n&apos;avez pas droit de vote et n&apos;êtes pas compté(e) dans le quorum.
            </div>

            {seanceClotureeOuArchivee && (
              <div className="bg-slate-100 border border-slate-200 px-4 py-3 rounded text-sm text-slate-700">
                Cette séance est terminée — la confirmation n&apos;est plus possible.
              </div>
            )}

            {!seanceClotureeOuArchivee && status === 'idle' && (
              <div className="space-y-3 pt-2">
                {alreadyAnswered && (
                  <p className="text-xs text-slate-500 text-center">
                    {alreadyAnswered} Vous pouvez modifier votre réponse ci-dessous.
                  </p>
                )}
                <button
                  onClick={() => handleChoice('CONFIRME')}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  Je confirme ma présence
                </button>
                <button
                  onClick={() => handleChoice('DECLINE')}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-sm transition"
                >
                  <XCircle className="h-5 w-5" />
                  Je ne pourrai pas être présent(e)
                </button>
              </div>
            )}

            {status === 'submitting' && (
              <div className="flex items-center justify-center gap-2 py-4 text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Enregistrement...</span>
              </div>
            )}

            {status === 'success_confirmed' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-emerald-900">Votre présence est confirmée</p>
                <p className="text-xs text-emerald-700 mt-1">Merci, le secrétariat a bien reçu votre réponse.</p>
                {!seanceClotureeOuArchivee && (
                  <button
                    onClick={() => setStatus('idle')}
                    className="mt-3 text-xs text-emerald-700 underline hover:text-emerald-900"
                  >
                    Modifier ma réponse
                  </button>
                )}
              </div>
            )}

            {status === 'success_declined' && (
              <div className="bg-slate-50 border border-slate-200 rounded-md p-4 text-center">
                <XCircle className="h-10 w-10 text-slate-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-900">Réponse enregistrée</p>
                <p className="text-xs text-slate-600 mt-1">Merci de nous avoir prévenu.</p>
                {!seanceClotureeOuArchivee && (
                  <button
                    onClick={() => setStatus('idle')}
                    className="mt-3 text-xs text-slate-600 underline hover:text-slate-800"
                  >
                    Modifier ma réponse
                  </button>
                )}
              </div>
            )}

            {status === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm font-medium text-red-900">Une erreur est survenue</p>
                <p className="text-xs text-red-700 mt-1">{errorMsg}</p>
                <button
                  onClick={() => setStatus('idle')}
                  className="mt-3 text-xs text-red-700 underline hover:text-red-900"
                >
                  Réessayer
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-400 text-center mt-4">
          Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, contactez le secrétariat de l&apos;institution.
        </p>
      </div>
    </div>
  )
}
