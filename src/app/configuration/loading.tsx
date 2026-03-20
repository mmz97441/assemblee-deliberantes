import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function ConfigurationLoading() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar skeleton */}
      <div className="w-[260px] bg-[hsl(220,30%,14%)] shrink-0" />

      {/* Content */}
      <div className="flex-1">
        {/* Header skeleton */}
        <div className="border-b bg-card/50 px-8 py-5">
          <div className="h-4 w-48 animate-pulse rounded bg-muted mb-3" />
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
        </div>

        <div className="px-8 py-6">
          {/* Tabs skeleton */}
          <div className="flex gap-2 mb-8">
            <div className="h-11 w-40 animate-pulse rounded-lg bg-muted" />
            <div className="h-11 w-32 animate-pulse rounded-lg bg-muted" />
          </div>

          {/* Form cards skeleton */}
          <div className="space-y-6 max-w-4xl">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="shadow-sm">
                <CardHeader className="pb-4">
                  <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                </CardHeader>
                <CardContent>
                  <div className="grid gap-5 sm:grid-cols-2">
                    {[1, 2, 3, 4].map((j) => (
                      <div key={j} className="space-y-2">
                        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                        <div className="h-10 w-full animate-pulse rounded bg-muted" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
