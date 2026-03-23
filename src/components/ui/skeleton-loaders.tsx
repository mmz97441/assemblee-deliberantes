/**
 * Reusable skeleton loaders for loading states across the application.
 * Uses animate-pulse with bg-muted for consistent shimmer effects.
 */

// ─── Primitive Skeletons ─────────────────────────────────────────────────────

/** A simple pulsing rectangle — the building block for all skeletons. */
function Bone({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className ?? ''}`} />
}

/** A pulsing circle (avatar placeholder). */
function BoneCircle({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className ?? ''}`} />
}

// ─── Card Skeleton ───────────────────────────────────────────────────────────

/** A rounded card with pulsing lines (title + 2 lines of text). */
export function CardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-3">
      <div className="flex items-center gap-3">
        <Bone className="h-10 w-10 rounded-lg" />
        <div className="space-y-1.5 flex-1">
          <Bone className="h-4 w-24" />
          <Bone className="h-3 w-40" />
        </div>
      </div>
      <Bone className="h-4 w-full" />
      <Bone className="h-4 w-3/4" />
    </div>
  )
}

// ─── Table Row Skeleton ──────────────────────────────────────────────────────

/** A row with avatar circle + text lines + badge placeholders. */
export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-t">
      <BoneCircle className="h-9 w-9 shrink-0" />
      <div className="flex-1 space-y-1">
        <Bone className="h-4 w-40" />
        <Bone className="h-3 w-56" />
      </div>
      <Bone className="h-5 w-20 rounded-full" />
      <Bone className="h-5 w-16 rounded-full" />
      <Bone className="h-8 w-8 rounded" />
    </div>
  )
}

// ─── Stat Card Skeleton ──────────────────────────────────────────────────────

/** A small stat card with number + label. */
export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-3">
      <div className="flex justify-between">
        <Bone className="h-10 w-10 rounded-lg" />
        <Bone className="h-4 w-4" />
      </div>
      <Bone className="h-7 w-12" />
      <Bone className="h-4 w-28" />
    </div>
  )
}

// ─── Page Header Skeleton ────────────────────────────────────────────────────

/** Mimics the PageHeader component with breadcrumb + title + description. */
export function PageHeaderSkeleton({ withBreadcrumb = false }: { withBreadcrumb?: boolean }) {
  return (
    <div className="border-b bg-card/50 px-8 py-5">
      {withBreadcrumb && <Bone className="h-4 w-48 mb-3" />}
      <Bone className="h-8 w-56" />
      <Bone className="mt-2 h-4 w-72" />
    </div>
  )
}

// ─── Page-Level Skeleton Compositions ────────────────────────────────────────

/** Dashboard skeleton: 4 stat cards + section title + 3 action cards. */
export function DashboardSkeleton() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar placeholder */}
      <div className="hidden lg:block w-[260px] bg-[hsl(220,30%,14%)] shrink-0" />

      <div className="flex-1">
        <PageHeaderSkeleton />

        <div className="px-8 py-8">
          {/* Stats */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-10">
            {[1, 2, 3, 4].map((i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>

          {/* Section title */}
          <Bone className="h-5 w-32 mb-4" />

          {/* Action cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Seances list skeleton: search bar + filter + 5 table rows. */
export function SeancesListSkeleton() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:block w-[260px] bg-[hsl(220,30%,14%)] shrink-0" />

      <div className="flex-1">
        <PageHeaderSkeleton />

        <div className="px-8 py-6 space-y-6">
          {/* Search + filters */}
          <div className="flex gap-3">
            <Bone className="h-10 w-64 rounded-md" />
            <Bone className="h-10 w-40 rounded-md" />
            <Bone className="h-10 w-40 rounded-md" />
            <div className="ml-auto">
              <Bone className="h-10 w-44 rounded-md" />
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border">
            <Bone className="h-12 w-full rounded-t-lg rounded-b-none" />
            {[1, 2, 3, 4, 5].map((i) => (
              <TableRowSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Members list skeleton: search bar + filters + 6 member rows. */
export function MembersListSkeleton() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:block w-[260px] bg-[hsl(220,30%,14%)] shrink-0" />

      <div className="flex-1">
        <PageHeaderSkeleton />

        <div className="px-8 py-6 space-y-6">
          {/* Filters */}
          <div className="flex gap-3">
            <Bone className="h-10 w-64 rounded-md" />
            <Bone className="h-10 w-40 rounded-md" />
            <Bone className="h-10 w-40 rounded-md" />
            <div className="ml-auto">
              <Bone className="h-10 w-44 rounded-md" />
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border">
            <Bone className="h-12 w-full rounded-t-lg rounded-b-none" />
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <TableRowSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Seance detail skeleton: breadcrumb header + tabs + content area. */
export function SeanceDetailSkeleton() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:block w-[260px] bg-[hsl(220,30%,14%)] shrink-0" />

      <div className="flex-1">
        <PageHeaderSkeleton withBreadcrumb />

        <div className="px-8 py-6">
          {/* Tabs */}
          <div className="flex gap-1 mb-8 border-b pb-px">
            {[1, 2, 3, 4].map((i) => (
              <Bone key={i} className="h-10 w-28 rounded-md rounded-b-none" />
            ))}
          </div>

          {/* Content cards */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border bg-card p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <Bone className="h-5 w-8 rounded" />
                    <Bone className="h-5 w-20 rounded-full" />
                  </div>
                  <Bone className="h-5 w-3/4" />
                  <Bone className="h-4 w-1/2" />
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-6 space-y-3">
                <Bone className="h-5 w-24" />
                <Bone className="h-4 w-full" />
                <Bone className="h-4 w-full" />
                <Bone className="h-4 w-3/4" />
              </div>
              <div className="rounded-xl border bg-card p-6 space-y-3">
                <Bone className="h-5 w-28" />
                <Bone className="h-8 w-full rounded-lg" />
                <Bone className="h-4 w-2/3" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Configuration skeleton: tabs + form cards. */
export function ConfigurationSkeleton() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:block w-[260px] bg-[hsl(220,30%,14%)] shrink-0" />

      <div className="flex-1">
        <PageHeaderSkeleton withBreadcrumb />

        <div className="px-8 py-6">
          {/* Tabs */}
          <div className="flex gap-2 mb-8">
            <Bone className="h-11 w-40 rounded-lg" />
            <Bone className="h-11 w-32 rounded-lg" />
          </div>

          {/* Form cards */}
          <div className="space-y-6 max-w-4xl">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border bg-card shadow-sm">
                <div className="px-6 pt-6 pb-4">
                  <Bone className="h-5 w-32" />
                </div>
                <div className="px-6 pb-6">
                  <div className="grid gap-5 sm:grid-cols-2">
                    {[1, 2, 3, 4].map((j) => (
                      <div key={j} className="space-y-2">
                        <Bone className="h-4 w-24" />
                        <Bone className="h-10 w-full" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
