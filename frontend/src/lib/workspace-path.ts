import type { UserRole } from "@/types"

/** Default workspace URL after sign-in when no safe deep-link applies. */
export function workspacePathForRole(role: UserRole): string {
  switch (role) {
    case "ADMIN":
      return "/admin"
    case "FARMER":
      return "/farmer"
    case "AGRONOMIST":
      return "/agronomist"
    default:
      return "/"
  }
}

function isPublicPath(path: string): boolean {
  if (path === "/" || path === "/advisories") return true
  if (path.startsWith("/advisories/")) return true
  return false
}

function roleCanUsePath(role: UserRole, path: string): boolean {
  if (path.startsWith("/admin")) return role === "ADMIN"
  if (path.startsWith("/farmer")) return role === "FARMER"
  if (path.startsWith("/agronomist")) return role === "AGRONOMIST"
  return false
}

/**
 * Where to send the user right after login/register.
 * Keeps public advisory URLs; sends mismatched role-specific URLs to the right workspace.
 */
export function postAuthPath(
  from: string | null | undefined,
  role: UserRole
): string {
  const safeFrom =
    from &&
    from.startsWith("/") &&
    !from.startsWith("//") &&
    !from.startsWith("/login") &&
    !from.startsWith("/register")
      ? from
      : null

  if (!safeFrom) return workspacePathForRole(role)

  if (isPublicPath(safeFrom)) return safeFrom

  if (roleCanUsePath(role, safeFrom)) return safeFrom

  return workspacePathForRole(role)
}
