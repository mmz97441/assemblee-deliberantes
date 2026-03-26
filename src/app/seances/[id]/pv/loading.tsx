import { Loader2 } from 'lucide-react'

export default function PVLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">Chargement du procès-verbal...</p>
      </div>
    </div>
  )
}
