export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="h-12 w-12 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground text-lg">Chargement de l&apos;émargement...</p>
      </div>
    </div>
  )
}
