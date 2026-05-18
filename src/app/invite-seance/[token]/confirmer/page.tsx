export const dynamic = 'force-dynamic'

import { getInviteByToken } from '@/lib/actions/invites'
import { ConfirmationInviteContent } from './confirmation-invite-content'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function ConfirmerInvitePage({ params }: PageProps) {
  const { token } = await params
  const result = await getInviteByToken(token)

  if ('error' in result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Lien invalide</h1>
          <p className="text-sm text-slate-600">{result.error}</p>
          <p className="text-xs text-slate-400 mt-6">
            Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, contactez le secrétariat de l&apos;institution
            qui vous a envoyé l&apos;invitation.
          </p>
        </div>
      </div>
    )
  }

  return <ConfirmationInviteContent token={token} invite={result.data} />
}
