import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { advisoryApi, metaApi } from "@/lib/api"
import type { Advisory, AdvisoryStatus } from "@/types"
import { RoleGate } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return debounced
}

export function AgronomistDashboardPage() {
  const [items, setItems] = useState<Advisory[]>([])
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<string[]>([])
  const [mineQ, setMineQ] = useState("")
  const debouncedMineQ = useDebounced(mineQ, 380)
  const [mineCategory, setMineCategory] = useState("")
  const [mineCrop, setMineCrop] = useState("")
  const [mineRegion, setMineRegion] = useState("")

  const load = useCallback(() => {
    setLoading(true)
    advisoryApi
      .mine({
        page: 1,
        limit: 100,
        sort: "createdAt",
        order: "desc",
        q: debouncedMineQ.trim() || undefined,
        category: mineCategory || undefined,
        crop: mineCrop.trim() || undefined,
        region: mineRegion.trim() || undefined,
      })
      .then((r) => setItems(r.data))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false))
  }, [debouncedMineQ, mineCategory, mineCrop, mineRegion])

  useEffect(() => {
    metaApi.categories().then((r) => setCategories(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const byStatus = useMemo(() => {
    const g = (s: AdvisoryStatus) => items.filter((a) => a.status === s)
    return {
      DRAFT: g("DRAFT"),
      PUBLISHED: g("PUBLISHED"),
      ARCHIVED: g("ARCHIVED"),
    }
  }, [items])

  async function publish(id: string) {
    try {
      await advisoryApi.publish(id)
      toast.success("Published")
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed")
    }
  }

  async function archive(id: string) {
    try {
      await advisoryApi.archive(id)
      toast.success("Archived")
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Archive failed")
    }
  }

  function TableBlock({ rows }: { rows: Advisory[] }) {
    if (loading) {
      return <Skeleton className="h-40 w-full" />
    }
    if (rows.length === 0) {
      return (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nothing here yet.
        </p>
      )
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Crops / area</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Window</TableHead>
            <TableHead className="w-[120px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">{a.title}</TableCell>
              <TableCell className="max-w-[200px] text-xs text-muted-foreground">
                {(a.targetCrops?.length ?? 0) > 0 || (a.geographicLabels?.length ?? 0) > 0 ? (
                  <span className="line-clamp-2">
                    {[...(a.targetCrops ?? []), ...(a.geographicLabels ?? [])].join(
                      " · "
                    )}
                  </span>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{a.category}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {new Date(a.validFrom).toLocaleDateString()} –{" "}
                {new Date(a.validTo).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to={`/agronomist/advisories/${a.id}`}>Edit / media</Link>
                    </DropdownMenuItem>
                    {a.status === "DRAFT" && (
                      <DropdownMenuItem onClick={() => publish(a.id)}>
                        Publish
                      </DropdownMenuItem>
                    )}
                    {a.status !== "ARCHIVED" && (
                      <DropdownMenuItem onClick={() => archive(a.id)}>
                        Archive
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <RoleGate allow="AGRONOMIST">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My advisories</h1>
            <p className="text-sm text-muted-foreground">
              Save a draft, add files if you need them, then publish. New agronomists get
              verified by an admin first. You can archive when something&apos;s outdated.
            </p>
          </div>
          <Button asChild>
            <Link to="/agronomist/advisories/new">New advisory</Link>
          </Button>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <p className="mb-3 text-sm font-medium text-foreground">
            Search &amp; filters
          </p>
          <p className="mb-4 text-xs text-muted-foreground">
            Same parameters as the public catalog API—narrow your own drafts and published work.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="mine-q">Keyword</Label>
              <Input
                id="mine-q"
                value={mineQ}
                onChange={(e) => setMineQ(e.target.value)}
                placeholder="Title, description, weather notes…"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={mineCategory || "__any"}
                onValueChange={(v) =>
                  setMineCategory(v === "__any" ? "" : v)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any">Any category</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mine-crop">Crop contains</Label>
              <Input
                id="mine-crop"
                value={mineCrop}
                onChange={(e) => setMineCrop(e.target.value)}
                placeholder="e.g. potato"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="mine-region">Region label contains</Label>
              <Input
                id="mine-region"
                value={mineRegion}
                onChange={(e) => setMineRegion(e.target.value)}
                placeholder="e.g. district name"
              />
            </div>
          </div>
        </div>

        <Tabs defaultValue="draft">
          <TabsList>
            <TabsTrigger value="draft">Drafts ({byStatus.DRAFT.length})</TabsTrigger>
            <TabsTrigger value="pub">
              Published ({byStatus.PUBLISHED.length})
            </TabsTrigger>
            <TabsTrigger value="arch">
              Archived ({byStatus.ARCHIVED.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="draft">
            <TableBlock rows={byStatus.DRAFT} />
          </TabsContent>
          <TabsContent value="pub">
            <TableBlock rows={byStatus.PUBLISHED} />
          </TabsContent>
          <TabsContent value="arch">
            <TableBlock rows={byStatus.ARCHIVED} />
          </TabsContent>
        </Tabs>
      </div>
    </RoleGate>
  )
}
