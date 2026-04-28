import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { fadeUp } from "@/lib/motion"
import { postAuthPath } from "@/lib/workspace-path"
import { useAuth } from "@/context/auth-context"

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from =
    typeof (location.state as { from?: unknown })?.from === "string"
      ? (location.state as { from: string }).from
      : null
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const me = await login(email, password)
      toast.success("Signed in successfully")
      navigate(postAuthPath(from, me.role), { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex w-full flex-1 flex-col justify-center py-6 md:py-8">
      <motion.div
        className="mx-auto w-full max-w-md"
        variants={fadeUp}
        initial="hidden"
        animate="visible"
      >
        <Card className="border-border/80 shadow-sm" size="sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Sign in to FieldWise</CardTitle>
            <CardDescription className="leading-relaxed text-pretty">
              Use your registered email and password. For access or role issues,
              contact your program administrator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@organization.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-background/50"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                No account?{" "}
                <Link
                  className="font-medium text-foreground underline underline-offset-4 transition-colors duration-200 ease-out hover:text-foreground/90"
                  to="/register"
                >
                  Create one
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
