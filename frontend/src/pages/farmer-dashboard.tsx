import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { HugeiconsIcon } from "@hugeicons/react"
import { MapPinIcon } from "@hugeicons/core-free-icons"
import type { Polygon } from "geojson"
import { toast } from "sonner"
import { fieldApi } from "@/lib/api"
import type { FarmField } from "@/types"
import { FieldCardMap } from "@/components/field-card-map"
import { FieldMapDraw } from "@/components/field-map-draw"
import { FARMER_MAP_ZOOM, MAP_MAX_ZOOM } from "@/lib/map-styles"
import { RoleGate } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export function FarmerDashboardPage() {
  const [fields, setFields] = useState<FarmField[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [crop, setCrop] = useState("")
  const [soil, setSoil] = useState("")
  const [loc, setLoc] = useState("")
  const [saving, setSaving] = useState(false)
  const [mapBoundary, setMapBoundary] = useState<Polygon | null>(null)

  const load = () => {
    fieldApi
      .list()
      .then((r) => setFields(r.data))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  function resetForm() {
    setName("")
    setCrop("")
    setSoil("")
    setLoc("")
    setMapBoundary(null)
  }

  function handleBoundaryChange(boundary: Polygon | null) {
    setMapBoundary(boundary)
  }

  async function createField(e: React.FormEvent) {
    e.preventDefault()
    if (!mapBoundary || !mapBoundary.coordinates?.length) {
      toast.error("Draw your parcel on the map so we can load weather and match advisories.")
      return
    }
    setSaving(true)
    try {
      await fieldApi.create({
        name,
        crop: crop.trim() || undefined,
        soilNotes: soil || undefined,
        locationText: loc || undefined,
        boundary: mapBoundary,
      })
      toast.success("Field created")
      setOpen(false)
      resetForm()
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  const addFieldButton = (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) resetForm()
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg" className="shrink-0">
          Add field
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(92vh,900px)] max-w-4xl overflow-y-auto sm:max-w-4xl">
        <form onSubmit={createField}>
          <DialogHeader>
            <DialogTitle>New field</DialogTitle>
            <DialogDescription>
              Outlining the parcel on the map is required—that shape sets where forecast weather
              applies and which advisories can overlap your land.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-3 sm:py-4 lg:grid-cols-2 lg:gap-7">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crop">Crop</Label>
                <Input
                  id="crop"
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                  placeholder="e.g. Potato, wheat"
                  maxLength={120}
                />
                <p className="text-xs text-muted-foreground">
                  What you grow on this parcel (helps match advisories later).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="soil">Soil notes</Label>
                <Textarea
                  id="soil"
                  value={soil}
                  onChange={(e) => setSoil(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loc">Location notes</Label>
                <Input
                  id="loc"
                  value={loc}
                  onChange={(e) => setLoc(e.target.value)}
                  placeholder="Village / block"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Field boundary on map (required)</Label>
              {open ? (
                <FieldMapDraw
                  key="field-draw"
                  onBoundaryChange={handleBoundaryChange}
                  initialZoom={FARMER_MAP_ZOOM}
                  fitPolygonMaxZoom={MAP_MAX_ZOOM - 1}
                  footerHint="Required: use the polygon tool to outline this parcel. Forecast weather uses the shape’s center; advisories match where it overlaps published areas."
                />
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving || !mapBoundary}>
              {saving ? "Saving…" : "Create field"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )

  return (
    <RoleGate allow="FARMER">
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              My fields
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Start by adding a field with a map outline—that unlocks forecast weather on the
              field page and lets advisories match where your boundary overlaps published areas.
            </p>
          </div>
          {fields.length > 0 ? addFieldButton : null}
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-56 rounded-xl" />
            <Skeleton className="h-56 rounded-xl" />
          </div>
        ) : fields.length === 0 ? (
          <Card className="flex flex-1 flex-col justify-center border-dashed bg-muted/15">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center sm:py-14">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <HugeiconsIcon
                  icon={MapPinIcon}
                  strokeWidth={2}
                  className="size-7 text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-medium">No fields yet</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Add your first parcel and draw its boundary on the map. Without that outline
                  we cannot anchor weather or spatial matches to your land.
                </p>
              </div>
              {addFieldButton}
            </CardContent>
          </Card>
        ) : (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">All fields</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((f) => (
                <Card
                  key={f.id}
                  className={cn(
                    "gap-0 p-0 py-0",
                    "overflow-hidden border border-border/60 shadow-sm ring-1 ring-border/35 transition-[box-shadow,transform] hover:shadow-md sm:hover:-translate-y-px"
                  )}
                >
                  <div className="grid min-h-0 grid-cols-1 sm:grid-cols-[minmax(0,42%)_minmax(0,1fr)] sm:items-stretch">
                    <div
                      className={cn(
                        "relative min-h-[148px] overflow-hidden bg-zinc-950 sm:min-h-[176px]",
                        "rounded-t-4xl border-b border-border/35 sm:rounded-t-none sm:rounded-l-4xl sm:border-b-0 sm:border-r sm:border-border/35"
                      )}
                    >
                      {f.boundary?.coordinates?.length ? (
                        <FieldCardMap
                          polygon={f.boundary}
                          className="absolute inset-0 min-h-[148px] rounded-t-4xl sm:min-h-0 sm:rounded-l-4xl sm:rounded-t-none"
                        />
                      ) : (
                        <div className="flex h-full min-h-[148px] flex-col items-center justify-center gap-2 sm:min-h-[176px]">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                            <HugeiconsIcon
                              icon={MapPinIcon}
                              strokeWidth={2}
                              className="size-6 text-muted-foreground"
                            />
                          </div>
                          <span className="text-center text-[11px] text-muted-foreground">
                            No outline yet
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-col justify-between gap-5 px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6 rounded-b-4xl sm:rounded-b-none sm:rounded-r-4xl">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <CardTitle className="text-xl font-semibold leading-snug tracking-tight">
                            {f.name}
                          </CardTitle>
                          {!f.boundary?.coordinates?.length ? (
                            <Badge
                              variant="outline"
                              className="w-fit text-[10px] font-normal text-muted-foreground"
                            >
                              Draw a boundary for weather and matches
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                          {f.crop ? (
                            <span className="text-muted-foreground">{f.crop}</span>
                          ) : null}
                          {f.crop ? (
                            <span className="text-muted-foreground/60" aria-hidden>
                              ·
                            </span>
                          ) : null}
                          <span className="font-medium tabular-nums text-foreground">
                            {f.areaHectares} ha
                          </span>
                          {f.locationText ? (
                            <>
                              <span className="text-muted-foreground/60" aria-hidden>
                                ·
                              </span>
                              <span className="max-w-full truncate text-muted-foreground">
                                {f.locationText}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <Button asChild variant="outline" className="w-full shrink-0 border-border/80 sm:w-auto">
                        <Link to={`/farmer/fields/${f.id}`}>Open observations</Link>
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </RoleGate>
  )
}
