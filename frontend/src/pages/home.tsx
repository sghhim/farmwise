import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { homeAudienceRoles } from "@/content/home-audience-roles"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { duration, ease, easeOut, staggerItem } from "@/lib/motion"
import { useAuth } from "@/context/auth-context"

export function HomePage() {
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
    <div className="flex flex-1 flex-col py-4 md:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-0 md:gap-12 sm:px-1">
        <motion.section
          className="overflow-hidden rounded-3xl bg-gradient-to-br from-muted/50 via-muted/25 to-transparent px-5 py-8 sm:px-8 sm:py-10 dark:from-muted/25 dark:via-muted/10 dark:to-transparent md:px-10 md:py-12 lg:px-12"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: easeOut }}
        >
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
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.995 }}
                  transition={{ duration: 0.2, ease }}
                >
                  <Button asChild size="lg">
                    <Link to="/advisories">View advisories</Link>
                  </Button>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.995 }}
                  transition={{ duration: 0.2, ease }}
                >
                  <Button asChild variant="outline" size="lg">
                    <Link to={workspaceHref}>{workspaceLabel}</Link>
                  </Button>
                </motion.div>
              </div>
            </div>
            <motion.div
              className="order-1 md:order-2"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.48, ease: easeOut, delay: 0.08 }}
            >
              <div className="relative min-h-[min(88vw,360px)] w-full overflow-hidden rounded-2xl sm:min-h-[380px] md:min-h-[min(460px,56svh)] lg:min-h-[min(500px,58svh)]">
                <img
                  src="/images/hero-fields.jpg"
                  alt="Aerial view of farm parcels with vegetation health coloring similar to NDVI"
                  className="absolute inset-0 h-full w-full object-cover object-center"
                  loading="eager"
                  decoding="async"
                />
                {/* Bottom: gentle fade into page — keep photo visible */}
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-background via-background/55 to-transparent"
                  aria-hidden
                />
                {/* Desktop: soft vignette toward copy column */}
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 hidden w-1/2 bg-gradient-to-r from-background/90 via-background/20 to-transparent md:block"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-background/20 md:hidden"
                  aria-hidden
                />
              </div>
            </motion.div>
          </div>
        </motion.section>

        <motion.section
          aria-label="Who FieldWise serves"
          className="rounded-2xl bg-muted/25 px-6 py-7 dark:bg-muted/15 md:px-9 md:py-8"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: duration.stagger,
                delayChildren: 0.05,
              },
            },
          }}
        >
          <div className="grid gap-9 sm:grid-cols-3 sm:gap-10">
            {homeAudienceRoles.map(({ icon, title, description }) => (
              <motion.div
                key={title}
                className="flex flex-col gap-2.5"
                variants={staggerItem}
              >
                <div className="flex items-center gap-2.5">
                  <HugeiconsIcon
                    icon={icon}
                    strokeWidth={2}
                    className="size-[1.125rem] shrink-0 text-muted-foreground"
                  />
                  <p className="text-sm font-medium">{title}</p>
                </div>
                <p className="text-sm leading-snug text-muted-foreground">
                  {description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <section className="space-y-4" aria-labelledby="next-steps-heading">
          <motion.h2
            id="next-steps-heading"
            className="text-sm font-medium text-muted-foreground"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, ease: easeOut }}
          >
            Next steps
          </motion.h2>
          <div className="grid gap-6 sm:grid-cols-2 sm:items-stretch">
            <motion.div
              className="flex min-h-0"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: easeOut, delay: 0.04 }}
            >
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
            </motion.div>
            <motion.div
              className="flex min-h-0"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: easeOut, delay: 0.1 }}
            >
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
            </motion.div>
          </div>
        </section>
      </div>
    </div>
  )
}
