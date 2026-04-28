import { useEffect } from "react"
import { useLocation } from "react-router-dom"

const titles: Record<string, string> = {
  "/": "Home",
  "/login": "Sign in",
  "/register": "Create account",
  "/advisories": "Published advisories",
  "/farmer": "My fields",
  "/agronomist": "My advisories",
  "/admin": "Admin",
}

export function useDocumentTitle() {
  const { pathname } = useLocation()

  useEffect(() => {
    const base = "FieldWise"
    if (pathname.startsWith("/advisories/") && pathname !== "/advisories") {
      document.title = `Advisory detail · ${base}`
      return
    }
    if (pathname.startsWith("/farmer/fields/")) {
      document.title = `Field · ${base}`
      return
    }
    if (pathname.startsWith("/agronomist/advisories/")) {
      document.title = `Edit advisory · ${base}`
      return
    }
    const segment = titles[pathname]
    document.title = segment ? `${segment} · ${base}` : base
  }, [pathname])
}
