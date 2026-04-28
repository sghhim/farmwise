import { useCallback, useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  Cancel01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { advisoryApi, metaApi, mediaUrl } from "@/lib/api"
import type { Advisory } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardAction,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { duration, easeOut } from "@/lib/motion"
import { cn } from "@/lib/utils"

type SortField = "createdAt" | "validFrom" | "title"
type Order = "asc" | "desc"

const SORT_PRESETS: {
  key: string
  sort: SortField
  order: Order
  label: string
}[] = [
  { key: "createdAt:desc", sort: "createdAt", order: "desc", label: "Newest first" },
  { key: "createdAt:asc", sort: "createdAt", order: "asc", label: "Oldest first" },
  {
    key: "validFrom:asc",
    sort: "validFrom",
    order: "asc",
    label: "Effective soonest",
  },
  {
    key: "validFrom:desc",
    sort: "validFrom",
    order: "desc",
    label: "Effective latest",
  },
  { key: "title:asc", sort: "title", order: "asc", label: "Title A–Z" },
  { key: "title:desc", sort: "title", order: "desc", label: "Title Z–A" },
]

function parseSortFromParams(sp: URLSearchParams): { sort: SortField; order: Order } {
  const s = sp.get("sort")
  const o = sp.get("order")
  const sort: SortField =
    s === "validFrom" || s === "title" || s === "createdAt" ? s : "createdAt"
  const order: Order = o === "asc" || o === "desc" ? o : "desc"
  return { sort, order }
}

function sortPresetKey(sort: SortField, order: Order): string {
  return `${sort}:${order}`
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return debounced
}

export function AdvisoryBrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<Advisory[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(() =>
    Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  )
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<string[]>([])

  const [qInput, setQInput] = useState(() => searchParams.get("q") ?? "")
  const debouncedQ = useDebounced(qInput, 380)

  const [category, setCategory] = useState(() => searchParams.get("category") ?? "")
  const [crop, setCrop] = useState(() => searchParams.get("crop") ?? "")
  const [region, setRegion] = useState(() => searchParams.get("region") ?? "")
  const [validFromGte, setValidFromGte] = useState(() => searchParams.get("from") ?? "")
  const [validToLte, setValidToLte] = useState(() => searchParams.get("to") ?? "")

  const [sort, setSort] = useState<SortField>(() =>
    parseSortFromParams(searchParams).sort
  )
  const [order, setOrder] = useState<Order>(() =>
    parseSortFromParams(searchParams).order
  )

  const [moreOpen, setMoreOpen] = useState(() => {
    if (typeof window === "undefined") return false
    const sp = new URLSearchParams(window.location.search)
    return !!(sp.get("crop") || sp.get("region") || sp.get("from") || sp.get("to"))
  })

  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const limit = 12

  const sortSelectValue = sortPresetKey(sort, order)
  const activeAdvancedCount =
    (crop.trim() ? 1 : 0) +
    (region.trim() ? 1 : 0) +
    (validFromGte ? 1 : 0) +
    (validToLte ? 1 : 0)

  const hasFilterPayload =
    debouncedQ.trim().length > 0 ||
    !!category ||
    activeAdvancedCount > 0

  useEffect(() => {
    metaApi.categories().then((r) => setCategories(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const next = new URLSearchParams()
    if (debouncedQ.trim()) next.set("q", debouncedQ.trim())
    if (category) next.set("category", category)
    if (crop.trim()) next.set("crop", crop.trim())
    if (region.trim()) next.set("region", region.trim())
    if (validFromGte) next.set("from", validFromGte)
    if (validToLte) next.set("to", validToLte)
    if (sort !== "createdAt" || order !== "desc") {
      next.set("sort", sort)
      next.set("order", order)
    }
    if (page > 1) next.set("page", String(page))
    setSearchParams(next, { replace: true })
  }, [
    debouncedQ,
    category,
    crop,
    region,
    validFromGte,
    validToLte,
    sort,
    order,
    page,
    setSearchParams,
  ])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    advisoryApi
      .list({
        q: debouncedQ.trim() || undefined,
        category: category || undefined,
        crop: crop.trim() || undefined,
        region: region.trim() || undefined,
        validFromGte: validFromGte || undefined,
        validToLte: validToLte || undefined,
        page,
        limit,
        sort,
        order,
      })
      .then((res) => {
        if (!cancelled) {
          setLoadError(null)
          setItems(res.data)
          setTotal(res.meta.total)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Failed to load"
          setLoadError(msg)
          setItems([])
          setTotal(0)
          toast.error(
            "Unable to load advisories. Check your connection and try again."
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    debouncedQ,
    category,
    crop,
    region,
    validFromGte,
    validToLte,
    page,
    sort,
    order,
    retryKey,
  ])

  const clearFilters = useCallback(() => {
    setQInput("")
    setCategory("")
    setCrop("")
    setRegion("")
    setValidFromGte("")
    setValidToLte("")
    setPage(1)
  }, [])

  return (
    <div className="space-y-8 md:space-y-10">
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: easeOut }}
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Advisory catalog
        </p>
        <div className="space-y-3">
          <h1 className="text-balance text-3xl font-semibold tracking-[-0.03em] md:text-4xl">
            Published advisories
          </h1>
          <p className="max-w-lg text-pretty text-sm leading-relaxed text-muted-foreground md:text-[15px]">
            Crop guidance scoped by region and season. Search first, then narrow when
            you need precision.
          </p>
        </div>
      </motion.div>

      {loadError && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, ease: easeOut }}
        >
          <Alert variant="destructive">
            <AlertTitle>Advisories unavailable</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                The list could not be loaded. Confirm your network connection, or
                contact your FieldWise administrator if the issue persists.
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 border-destructive/40"
                onClick={() => setRetryKey((k) => k + 1)}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: easeOut, delay: 0.06 }}
      >
        <Card
          size="sm"
          className="border-border/50 bg-card/80 shadow-none ring-1 ring-foreground/[0.04] backdrop-blur-sm dark:bg-gradient-to-b dark:from-card dark:to-muted/15 dark:ring-white/[0.06]"
        >
          <CardHeader className="gap-3 border-b border-border/30 pb-5">
            <div className="space-y-1">
              <CardTitle className="text-[15px] font-medium tracking-tight">
                Find advisories
              </CardTitle>
              <CardDescription className="max-w-xl text-[13px] leading-relaxed">
                One search field and category cover most cases. Everything else stays
                one tap away.
              </CardDescription>
            </div>
            {hasFilterPayload && (
              <CardAction>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
                  onClick={clearFilters}
                >
                  Reset
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="space-y-5 pt-2">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-5">
              <div className="min-w-0 flex-1 space-y-2">
                <Label
                  htmlFor="q"
                  className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                >
                  Query
                </Label>
                <div className="relative">
                  <HugeiconsIcon
                    icon={Search01Icon}
                    className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground/70"
                    aria-hidden
                  />
                  <Input
                    id="q"
                    placeholder="Titles, descriptions, weather notes…"
                    value={qInput}
                    className="h-11 rounded-2xl pl-11 text-[15px] md:text-sm"
                    onChange={(e) => {
                      setPage(1)
                      setQInput(e.target.value)
                    }}
                  />
                </div>
              </div>
              <div className="w-full space-y-2 lg:max-w-[13.5rem]">
                <Label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Category
                </Label>
                <Select
                  value={category || "__all__"}
                  onValueChange={(v) => {
                    setPage(1)
                    setCategory(v === "__all__" ? "" : v)
                  }}
                >
                  <SelectTrigger className="h-11 w-full rounded-2xl border-border/60 bg-background/40">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(debouncedQ.trim() ||
              category ||
              crop.trim() ||
              region.trim() ||
              validFromGte ||
              validToLte) && (
              <div className="flex flex-wrap gap-1.5">
                {debouncedQ.trim() && (
                  <Badge
                    variant="secondary"
                    className="max-w-full gap-1 rounded-full border-0 bg-muted/60 py-1 pl-3 pr-1.5 text-xs font-normal text-foreground/90 backdrop-blur-sm"
                  >
                    <span className="truncate">
                      “{debouncedQ.length > 36 ? `${debouncedQ.slice(0, 36)}…` : debouncedQ}”
                    </span>
                    <button
                      type="button"
                      className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
                      aria-label="Remove search"
                      onClick={() => {
                        setPage(1)
                        setQInput("")
                      }}
                    >
                      <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                    </button>
                  </Badge>
                )}
                {category && (
                  <Badge
                    variant="secondary"
                    className="gap-1 rounded-full border-0 bg-muted/60 py-1 pl-3 pr-1.5 text-xs font-normal text-foreground/90"
                  >
                    {category}
                    <button
                      type="button"
                      className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
                      aria-label="Remove category filter"
                      onClick={() => {
                        setPage(1)
                        setCategory("")
                      }}
                    >
                      <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                    </button>
                  </Badge>
                )}
                {crop.trim() && (
                  <Badge
                    variant="outline"
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border-border/50 bg-transparent py-1 pl-3 pr-1.5 text-xs font-normal text-muted-foreground"
                  >
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                      Crop
                    </span>
                    <span className="min-w-0 truncate">{crop.trim()}</span>
                    <button
                      type="button"
                      className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Remove crop filter"
                      onClick={() => {
                        setPage(1)
                        setCrop("")
                      }}
                    >
                      <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                    </button>
                  </Badge>
                )}
                {region.trim() && (
                  <Badge
                    variant="outline"
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border-border/50 bg-transparent py-1 pl-3 pr-1.5 text-xs font-normal text-muted-foreground"
                  >
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                      Region
                    </span>
                    <span className="min-w-0 truncate">{region.trim()}</span>
                    <button
                      type="button"
                      className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Remove region filter"
                      onClick={() => {
                        setPage(1)
                        setRegion("")
                      }}
                    >
                      <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                    </button>
                  </Badge>
                )}
                {(validFromGte || validToLte) && (
                  <Badge
                    variant="outline"
                    className="gap-1.5 rounded-full border-border/50 bg-transparent py-1 pl-3 pr-1.5 text-xs font-normal tabular-nums text-muted-foreground"
                  >
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
                      Valid
                    </span>
                    {validFromGte
                      ? new Date(validFromGte + "T12:00:00").toLocaleDateString()
                      : "…"}{" "}
                    –{" "}
                    {validToLte
                      ? new Date(validToLte + "T12:00:00").toLocaleDateString()
                      : "…"}
                    <button
                      type="button"
                      className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Remove date filters"
                      onClick={() => {
                        setPage(1)
                        setValidFromGte("")
                        setValidToLte("")
                      }}
                    >
                      <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                    </button>
                  </Badge>
                )}
              </div>
            )}

            <div className="pt-0.5">
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                  moreOpen && "text-foreground"
                )}
                onClick={() => setMoreOpen((o) => !o)}
                aria-expanded={moreOpen}
              >
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  className={cn(
                    "size-4 shrink-0 opacity-70 transition-transform duration-200",
                    moreOpen && "rotate-180"
                  )}
                />
                <span>Refine scope and dates</span>
                {activeAdvancedCount > 0 && (
                  <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] tabular-nums text-foreground/90">
                    {activeAdvancedCount}
                  </span>
                )}
              </button>
            </div>

            {moreOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: easeOut }}
                className="space-y-5"
              >
                <Separator className="bg-border/50" />
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Scope and validity window
                </p>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="crop"
                      className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      Crop
                    </Label>
                    <Input
                      id="crop"
                      placeholder="e.g. potato"
                      value={crop}
                      className="h-10 rounded-xl"
                      onChange={(e) => {
                        setPage(1)
                        setCrop(e.target.value)
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="region"
                      className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      Region
                    </Label>
                    <Input
                      id="region"
                      placeholder="Geographic scope"
                      value={region}
                      className="h-10 rounded-xl"
                      onChange={(e) => {
                        setPage(1)
                        setRegion(e.target.value)
                      }}
                    />
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="vf"
                      className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      Valid from
                    </Label>
                    <Input
                      id="vf"
                      type="date"
                      value={validFromGte}
                      className="h-10 rounded-xl font-[inherit] tabular-nums"
                      onChange={(e) => {
                        setPage(1)
                        setValidFromGte(e.target.value)
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="vt"
                      className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      Valid through
                    </Label>
                    <Input
                      id="vt"
                      type="date"
                      value={validToLte}
                      className="h-10 rounded-xl font-[inherit] tabular-nums"
                      onChange={(e) => {
                        setPage(1)
                        setValidToLte(e.target.value)
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {!loadError && (
        <motion.div
          className="flex flex-col gap-4 border-b border-border/30 pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.28, ease: easeOut, delay: 0.04 }}
        >
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Results
            </p>
            <p className="text-sm leading-snug text-foreground">
              {loading ? (
                <span className="text-muted-foreground">Updating…</span>
              ) : total === 0 ? (
                <span className="text-muted-foreground">No matches</span>
              ) : (
                <>
                  <span className="tabular-nums font-medium">
                    {(page - 1) * limit + 1}–{(page - 1) * limit + items.length}
                  </span>
                  <span className="text-muted-foreground"> of </span>
                  <span className="tabular-nums font-medium">{total}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:min-w-[14rem]">
            <Label className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Order by
            </Label>
            <Select
              value={sortSelectValue}
              onValueChange={(v) => {
                const preset = SORT_PRESETS.find((p) => p.key === v)
                if (preset) {
                  setSort(preset.sort)
                  setOrder(preset.order)
                  setPage(1)
                }
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-xl border-border/50 bg-muted/25">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent align="end">
                {SORT_PRESETS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="columns-1 sm:columns-2 xl:columns-3 [column-gap:1.25rem]">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              className="mb-5 break-inside-avoid rounded-2xl ring-1 ring-foreground/[0.04]"
              style={{ height: `${9 + (i % 3) * 2.5}rem` }}
            />
          ))}
        </div>
      ) : loadError ? null : items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: easeOut }}
        >
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/5 px-6 py-16 text-center md:py-20">
            <p className="text-base font-medium tracking-tight text-foreground">
              Nothing at this intersection
            </p>
            <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
              Loosen your query, remove a chip, or change how results are ordered.
            </p>
          </div>
        </motion.div>
      ) : (
        <>
          <div className="columns-1 sm:columns-2 xl:columns-3 [column-gap:1.25rem]">
            {items.map((a, index) => (
              <motion.div
                key={a.id}
                className="mb-5 break-inside-avoid"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.36,
                  ease: easeOut,
                  delay: Math.min(index * duration.stagger, 0.28),
                }}
              >
                <Card
                  size="sm"
                  className="group/card overflow-hidden border-border/40 bg-card/90 transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md dark:hover:shadow-none dark:hover:ring-1 dark:hover:ring-white/[0.08]"
                >
                  <CardHeader className="gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <CardTitle className="text-base font-medium leading-snug tracking-tight transition-colors group-hover/card:text-foreground">
                        {a.title}
                      </CardTitle>
                      <Badge
                        variant="secondary"
                        className="shrink-0 rounded-full border-0 bg-muted/70 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                      >
                        {a.category}
                      </Badge>
                    </div>
                    {(a.targetCrops?.length || a.geographicLabels?.length) ? (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {(a.targetCrops ?? []).slice(0, 4).map((c) => (
                          <Badge
                            key={c}
                            variant="outline"
                            className="rounded-full border-border/50 font-normal"
                          >
                            {c}
                          </Badge>
                        ))}
                        {(a.targetCrops?.length ?? 0) > 4 && (
                          <span className="self-center text-[11px] text-muted-foreground">
                            +{(a.targetCrops?.length ?? 0) - 4}
                          </span>
                        )}
                        {(a.geographicLabels ?? []).slice(0, 2).map((g) => (
                          <Badge
                            key={g}
                            variant="outline"
                            className="rounded-full border-dashed border-border/50 font-normal text-muted-foreground"
                          >
                            {g}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    <CardDescription className="line-clamp-2 text-[13px] leading-relaxed">
                      {a.description}
                    </CardDescription>
                    {a.weatherContext?.trim() && (
                      <p className="line-clamp-2 border-l-2 border-primary/25 pl-3 text-xs leading-relaxed text-muted-foreground">
                        <span className="font-medium text-foreground/75">Risk note: </span>
                        {a.weatherContext.trim()}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {a.attachments[0] && (
                      <img
                        src={mediaUrl(a.attachments[0].url)}
                        alt=""
                        className="aspect-video w-full rounded-xl border border-border/40 object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.currentTarget.style.display = "none"
                        }}
                      />
                    )}
                    <p className="text-[11px] tabular-nums leading-relaxed text-muted-foreground">
                      <span className="text-muted-foreground/90">
                        {new Date(a.validFrom).toLocaleDateString()} –{" "}
                        {new Date(a.validTo).toLocaleDateString()}
                      </span>
                      <span className="text-muted-foreground/70">
                        {" "}
                        · Up to {a.maxRecommendedHectares} ha
                      </span>
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-0 text-sm font-medium text-primary hover:bg-transparent hover:text-primary/90"
                      asChild
                    >
                      <Link to={`/advisories/${a.id}`} className="inline-flex items-center gap-1">
                        View advisory
                        <span aria-hidden className="transition-transform group-hover/card:translate-x-0.5">
                          →
                        </span>
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
          <motion.div
            className="flex flex-wrap items-center justify-end gap-2 pt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.28, ease: easeOut, delay: 0.08 }}
          >
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-full border-border/50 px-5"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-full border-border/50 px-5"
              disabled={page * limit >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </motion.div>
        </>
      )}
    </div>
  )
}
