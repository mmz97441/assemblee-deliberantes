export default function MembresLoading() {
  return (
    <div className="animate-pulse space-y-6 px-8 py-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-4 w-48 bg-muted rounded" />
        <div className="h-8 w-64 bg-muted rounded" />
        <div className="h-4 w-80 bg-muted rounded" />
      </div>

      {/* Filters skeleton */}
      <div className="flex gap-3">
        <div className="h-10 w-64 bg-muted rounded-md" />
        <div className="h-10 w-40 bg-muted rounded-md" />
        <div className="h-10 w-40 bg-muted rounded-md" />
        <div className="ml-auto h-10 w-44 bg-muted rounded-md" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border">
        <div className="h-12 bg-muted/50 rounded-t-lg" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-t">
            <div className="h-9 w-9 bg-muted rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-40 bg-muted rounded" />
              <div className="h-3 w-56 bg-muted rounded" />
            </div>
            <div className="h-5 w-20 bg-muted rounded-full" />
            <div className="h-5 w-16 bg-muted rounded-full" />
            <div className="h-5 w-32 bg-muted rounded-full" />
            <div className="h-8 w-8 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
