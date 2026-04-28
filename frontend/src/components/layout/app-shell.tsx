import { Suspense } from "react"
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom"
import { PageSkeleton } from "@/components/page-skeleton"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-context"
import { useDocumentTitle } from "@/hooks/use-document-title"
import type { UserRole } from "@/types"
import { workspacePathForRole } from "@/lib/workspace-path"
import { cn } from "@/lib/utils"

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "text-sm font-medium transition-colors hover:text-foreground",
    isActive ? "text-foreground" : "text-muted-foreground"
  )

export function AppShell() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  useDocumentTitle()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-6 sm:gap-8">
            <Link
              to="/"
              className="shrink-0 font-semibold tracking-tight transition-opacity hover:opacity-90"
            >
              FieldWise
            </Link>
            <nav className="flex flex-wrap items-center gap-3 sm:gap-4">
              <NavLink to="/advisories" className={navClass}>
                Advisories
              </NavLink>
              {user?.role === "FARMER" && (
                <NavLink to="/farmer" className={navClass}>
                  My fields
                </NavLink>
              )}
              {user?.role === "AGRONOMIST" && (
                <NavLink to="/agronomist" className={navClass}>
                  My advisories
                </NavLink>
              )}
              {user?.role === "ADMIN" && (
                <NavLink to="/admin" className={navClass}>
                  Admin
                </NavLink>
              )}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {user ? (
              <>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {user.email}{" "}
                  <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase">
                    {user.role}
                  </span>
                </span>
                <Button variant="outline" size="sm" onClick={() => logout()}>
                  Log out
                </Button>
              </>
            ) : (
              <>
                {pathname !== "/login" && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/login">Sign in</Link>
                  </Button>
                )}
                {pathname !== "/register" && (
                  <Button size="sm" asChild>
                    <Link to="/register">Register</Link>
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-4 pb-10 sm:px-5 sm:pt-5 sm:pb-11 md:pb-12">
        <div className="flex min-h-0 w-full flex-1 flex-col">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        FieldWise — crop advisories and field notes in one place
      </footer>
    </div>
  )
}

export function RoleGate({
  allow,
  children,
  fallback,
}: {
  allow: UserRole | UserRole[]
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const roles = Array.isArray(allow) ? allow : [allow]
  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">
        Checking your session…
      </div>
    )
  }
  if (!user) {
    if (fallback !== undefined) return <>{fallback}</>
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }
  if (!roles.includes(user.role)) {
    if (fallback !== undefined) return <>{fallback}</>
    return <Navigate to={workspacePathForRole(user.role)} replace />
  }
  return children
}
