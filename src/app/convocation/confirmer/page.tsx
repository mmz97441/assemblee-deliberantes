export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { ConfirmationContent } from './confirmation-content'

export default function ConfirmerConvocationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-500">Verification en cours...</p>
        </div>
      </div>
    }>
      <ConfirmationContent />
    </Suspense>
  )
}
