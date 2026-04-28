import { Link, useLocation } from "react-router-dom"
import { HugeiconsIcon } from "@hugeicons/react"
import { useAuth } from "@/context/auth-context"
import { homeAudienceRoles } from "@/content/home-audience-roles"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

function SkeletonLine({ className }: { className?: string }) {
  return <Skeleton className={cn("h-4", className)} />
}

/** Login / register — chunk loads quickly; avoid fake form fields. */
function AuthRouteFallback() {
  return (
    <div
      className="flex w-full flex-1 flex-col justify-center py-6 md:py-8"
      aria-busy="true"
      aria-label="Loading page"
    >
      <div className="mx-auto w-full max-w-md">
        <div className="h-64 rounded-xl border border-border/60 bg-muted/20" />
      </div>
    </div>
  )
}

/** Same static copy as home — only shown while the home chunk loads. */
function HomePageSkeleton() {
  const { user } = useAuth()

  const workspaceHref =
    user?.role === "FARMER"
      ? "/farmer"
      : user?.role === "AGRONOMIST"
        ? "/agronomist"
        : user?.role === "ADMIN"
          ? "/admin"
          : "/register"

  const workspaceLabel =
    user?.role === "FARMER"
      ? "Farmer dashboard"
      : user?.role === "AGRONOMIST"
        ? "Agronomist dashboard"
        : user?.role === "ADMIN"
          ? "Administration"
          : "Get started"

  return (
    <div className="flex flex-1 flex-col py-4 md:py-8" aria-busy="true" aria-label="Loading page">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-0 md:gap-12 sm:px-1">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-muted/50 via-muted/25 to-transparent px-5 py-8 sm:px-8 sm:py-10 dark:from-muted/25 dark:via-muted/10 dark:to-transparent md:px-10 md:py-12 lg:px-12">
          <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.22fr)] md:gap-12 lg:gap-14">
            <div className="order-2 space-y-6 md:order-1 md:py-1">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                FieldWise
              </p>
              <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl lg:text-[2.65rem] lg:leading-[1.12]">
                Align agronomic guidance with what happens in the field.
              </h1>
              <p className="max-w-prose text-base leading-relaxed text-muted-foreground md:text-lg">
                FieldWise brings published advisories, structured observations, and
                administrative oversight into one workspace for farmers, agronomists,
                and program administrators. Your teams collaborate with shared context,
                fewer handoffs, and an auditable record you can rely on.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/advisories">View advisories</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to={workspaceHref}>{workspaceLabel}</Link>
                </Button>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <div className="relative min-h-[min(88vw,360px)] w-full overflow-hidden rounded-2xl sm:min-h-[380px] md:min-h-[min(460px,56svh)] lg:min-h-[min(500px,58svh)]">
                <img
                  src="/images/hero-fields.jpg"
                  alt="Aerial view of farm parcels with vegetation health coloring similar to NDVI"
                  className="absolute inset-0 h-full w-full object-cover object-center"
                  loading="eager"
                  decoding="async"
                />
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-background via-background/55 to-transparent"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 hidden w-1/2 bg-gradient-to-r from-background/90 via-background/20 to-transparent md:block"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-background/20 md:hidden"
                  aria-hidden
                />
              </div>
            </div>
          </div>
        </section>

        <section
          aria-label="Who FieldWise serves"
          className="rounded-2xl bg-muted/25 px-6 py-7 dark:bg-muted/15 md:px-9 md:py-8"
        >
          <div className="grid gap-9 sm:grid-cols-3 sm:gap-10">
            {homeAudienceRoles.map(({ icon, title, description }) => (
              <div key={title} className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2.5">
                  <HugeiconsIcon
                    icon={icon}
                    strokeWidth={2}
                    className="size-[1.125rem] shrink-0 text-muted-foreground"
                  />
                  <p className="text-sm font-medium">{title}</p>
                </div>
                <p className="text-sm leading-snug text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4" aria-labelledby="next-steps-heading-skel">
          <h2
            id="next-steps-heading-skel"
            className="text-sm font-medium text-muted-foreground"
          >
            Next steps
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 sm:items-stretch">
            <div className="flex min-h-0">
              <Card className="h-full w-full border-border/60 shadow-none ring-0">
                <CardHeader>
                  <CardTitle>Published advisories</CardTitle>
                  <CardDescription>
                    Search and filter program-wide guidance by keyword, category, and
                    validity dates.
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button asChild variant="outline">
                    <Link to="/advisories">Browse advisories</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
            <div className="flex min-h-0">
              <Card className="h-full w-full border-border/60 shadow-none ring-0">
                <CardHeader>
                  <CardTitle>Your workspace</CardTitle>
                  <CardDescription>
                    {user
                      ? "Pick up where you left off—your tools depend on your role."
                      : "Sign up as a farmer or agronomist to manage fields or publish advisories."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto flex flex-wrap gap-2">
                {user?.role === "FARMER" && (
                  <Button asChild variant="secondary">
                    <Link to="/farmer">Farmer dashboard</Link>
                  </Button>
                )}
                {user?.role === "AGRONOMIST" && (
                  <Button asChild variant="secondary">
                    <Link to="/agronomist">Agronomist dashboard</Link>
                  </Button>
                )}
                {user?.role === "ADMIN" && (
                  <Button asChild variant="secondary">
                    <Link to="/admin">Administration</Link>
                  </Button>
                )}
                {!user && (
                  <>
                    <Button asChild>
                      <Link to="/register">Register</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/login">Sign in</Link>
                    </Button>
                  </>
                )}
              </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

/** Title + filters + grid — advisory list (static headings match loaded page) */
function AdvisoryBrowseSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Published advisories
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          Browse crop guidance issued for your program. Search by keyword, filter by
          category and validity period, and sort results to surface what applies to
          your fields.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search and filters</CardTitle>
          <CardDescription>
            Combine text search, category, validity dates, and sort options to narrow
            published advisories to what you need.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

/** Detail — single advisory */
function AdvisoryDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-8 w-3/4 max-w-xl" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <Skeleton className="min-h-48 w-full rounded-3xl" />
    </div>
  )
}

/** Dashboards with heading + table or cards */
function FarmerHomeSkeleton() {
  return (
    <div
      className="flex flex-1 flex-col gap-6"
      aria-busy="true"
      aria-label="Loading page"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-44 md:h-10 md:w-48" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>
        <Skeleton className="h-11 w-[8.75rem] shrink-0 rounded-xl" />
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <Skeleton className="h-4 w-28" />
        <div className="grid min-h-[min(280px,36vh)] flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="min-h-[200px] rounded-xl sm:min-h-[220px]" />
          <Skeleton className="min-h-[200px] rounded-xl sm:min-h-[220px]" />
        </div>
      </div>
    </div>
  )
}

function DashboardSkeleton({ wideTable }: { wideTable?: boolean }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="rounded-3xl border border-border/60 bg-card/30 p-6">
        <Skeleton className="mb-4 h-5 w-56" />
        {wideTable ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Agronomy advisory editor — form */
function AdvisoryEditorSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-8 w-40" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ))}
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
    </div>
  )
}

/** Field detail — similar to farmer field */
function FieldDetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-5" aria-busy="true" aria-label="Loading page">
      <div className="flex flex-wrap justify-between gap-3">
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>
      <Skeleton className="min-h-[min(380px,52vh)] w-full rounded-4xl" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <Skeleton className="h-36 rounded-xl" />
      <Skeleton className="h-44 rounded-xl" />
      <Skeleton className="min-h-[180px] rounded-xl" />
    </div>
  )
}

function DefaultSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-8 w-56" />
      <div className="space-y-2">
        <SkeletonLine className="max-w-xl" />
        <SkeletonLine className="max-w-lg" />
      </div>
      <Skeleton className="min-h-40 w-full rounded-3xl" />
    </div>
  )
}

/**
 * Shown while lazy route chunks load. Shape hints at the destination route
 * so the layout doesn’t jump as badly as a single spinner.
 */
export function PageSkeleton() {
  const { pathname } = useLocation()

  if (pathname === "/") {
    return <HomePageSkeleton />
  }
  if (pathname === "/login" || pathname === "/register") {
    return <AuthRouteFallback />
  }
  if (pathname === "/advisories") {
    return <AdvisoryBrowseSkeleton />
  }
  if (pathname.startsWith("/advisories/")) {
    return <AdvisoryDetailSkeleton />
  }
  if (pathname.startsWith("/farmer/fields/")) {
    return <FieldDetailSkeleton />
  }
  if (pathname === "/farmer") {
    return <FarmerHomeSkeleton />
  }
  if (pathname.startsWith("/agronomist/advisories")) {
    return <AdvisoryEditorSkeleton />
  }
  if (pathname === "/agronomist") {
    return <DashboardSkeleton wideTable />
  }
  if (pathname === "/admin") {
    return <DashboardSkeleton wideTable />
  }

  return <DefaultSkeleton />
}
