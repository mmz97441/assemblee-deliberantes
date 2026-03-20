export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar skeleton */}
      <div className="w-[260px] bg-[hsl(220,30%,14%)] shrink-0" />

      {/* Content */}
      <div className="flex-1">
        {/* Header skeleton */}
        <div className="border-b bg-card/50 px-8 py-5">
          <div className="h-8 w-56 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
        </div>

        <div className="px-8 py-8">
          {/* Stats skeleton */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-10">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border bg-card p-6 space-y-3">
                <div className="flex justify-between">
                  <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
                  <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-7 w-12 animate-pulse rounded bg-muted" />
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>

          {/* Cards skeleton */}
          <div className="h-5 w-32 animate-pulse rounded bg-muted mb-4" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border bg-card p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                  </div>
                </div>
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
