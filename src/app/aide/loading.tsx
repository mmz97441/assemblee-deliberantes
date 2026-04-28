export default function AideLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header skeleton */}
        <div className="text-center space-y-4 mb-10 animate-pulse">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-muted" />
          <div className="h-8 w-48 bg-muted rounded mx-auto" />
          <div className="h-4 w-72 bg-muted rounded mx-auto" />
          <div className="h-12 w-full max-w-md bg-muted rounded-xl mx-auto mt-6" />
        </div>

        {/* Role cards skeleton */}
        <div className="mb-12 animate-pulse">
          <div className="h-5 w-40 bg-muted rounded mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[88px] rounded-xl bg-muted" />
            ))}
          </div>
        </div>

        {/* FAQ skeleton */}
        <div className="animate-pulse">
          <div className="h-5 w-48 bg-muted rounded mb-6" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-muted" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
