import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton */}
      <header className="border-b bg-card shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="flex items-center gap-4">
            <div className="space-y-1 text-right">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-5 w-24 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-9 w-28 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </header>

      {/* Content skeleton */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <div className="h-8 w-56 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-40 animate-pulse rounded bg-muted" />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-5 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 w-48 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
