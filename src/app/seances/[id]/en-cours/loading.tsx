export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0D2B55] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="h-12 w-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
        <p className="text-white/70 text-lg">Chargement de la séance...</p>
      </div>
    </div>
  )
}
