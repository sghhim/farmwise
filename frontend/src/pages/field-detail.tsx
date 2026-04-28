import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react"
import { Link, useParams } from "react-router-dom"
import type { Polygon } from "geojson"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { fieldApi, observationApi, mediaUrl } from "@/lib/api"
import type {
  Advisory,
  FarmField,
  FieldObservation,
  FieldWeatherPayload,
} from "@/types"
import { FieldBoundaryPreview } from "@/components/field-boundary-preview"
import { FieldMapDraw } from "@/components/field-map-draw"
import { FARMER_MAP_ZOOM, MAP_MAX_ZOOM } from "@/lib/map-styles"
import { RoleGate } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

function formatWeatherInstant(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatHourClock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    const s = String(iso)
    const t = s.includes("T") ? s.split("T")[1] : s
    return t.slice(0, 5) || s
  }
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}

function hourlyDayHeading(times: unknown[], rowCount: number): string | null {
  const valid: Date[] = []
  for (let i = 0; i < Math.min(rowCount, times.length); i++) {
    const d = new Date(String(times[i]))
    if (!Number.isNaN(d.getTime())) valid.push(d)
  }
  if (valid.length === 0) return null
  const first = valid[0]!
  const sameDay = valid.every(
    (d) =>
      d.getFullYear() === first.getFullYear() &&
      d.getMonth() === first.getMonth() &&
      d.getDate() === first.getDate()
  )
  if (!sameDay) return null
  return first.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

/** Hover / motion polish for stacked cards on field detail. */
const FIELD_DETAIL_CARD_HOVER =
  "motion-safe:transition-[box-shadow,transform,ring-color] motion-safe:duration-300 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 hover:shadow-xl hover:ring-primary/15 dark:hover:ring-primary/25"

function observationSeverityLabel(severity: FieldObservation["severity"]) {
  switch (severity) {
    case "LOW":
      return "Low"
    case "MEDIUM":
      return "Medium"
    case "HIGH":
      return "High"
    default:
      return severity
  }
}

function observationSeverityBadgeClass(
  severity: FieldObservation["severity"]
): string {
  switch (severity) {
    case "LOW":
      return "border-emerald-600/35 bg-emerald-500/10 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-950/45 dark:text-emerald-100"
    case "MEDIUM":
      return "border-amber-600/35 bg-amber-500/10 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100"
    case "HIGH":
      return "border-red-600/40 bg-red-500/10 text-red-950 dark:border-red-500/45 dark:bg-red-950/40 dark:text-red-100"
    default:
      return ""
  }
}

/** Matches Tailwind `xl` (1280px) for desktop split layout. */
function useXlUp() {
  const [xl, setXl] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)")
    const sync = () => setXl(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])
  return xl
}

type ObservationFormFieldsProps = {
  formSuffix: string
  symptom: string
  setSymptom: (v: string) => void
  severity: "LOW" | "MEDIUM" | "HIGH"
  setSeverity: (v: "LOW" | "MEDIUM" | "HIGH") => void
  observedAt: string
  setObservedAt: (v: string) => void
  setFiles: (files: File[]) => void
  obsPhotoPreviewUrls: string[]
  removeObservationPhoto: (index: number) => void
  obsFileInputRef: RefObject<HTMLInputElement | null>
  files: File[]
  symptomRows?: number
}

function ObservationFormFields({
  formSuffix,
  symptom,
  setSymptom,
  severity,
  setSeverity,
  observedAt,
  setObservedAt,
  setFiles,
  obsPhotoPreviewUrls,
  removeObservationPhoto,
  obsFileInputRef,
  files,
  symptomRows = 4,
}: ObservationFormFieldsProps) {
  const id = (base: string) => `${base}-${formSuffix}`
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={id("symptom")}>What you noticed</Label>
        <Textarea
          id={id("symptom")}
          value={symptom}
          onChange={(e) => setSymptom(e.target.value)}
          required
          rows={symptomRows}
        />
      </div>
      <div className="space-y-2">
        <Label>Severity</Label>
        <Select
          value={severity}
          onValueChange={(v) =>
            setSeverity(v as "LOW" | "MEDIUM" | "HIGH")
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="LOW">Low</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={id("observed-at")}>When you saw it</Label>
        <Input
          id={id("observed-at")}
          type="datetime-local"
          value={observedAt}
          onChange={(e) => setObservedAt(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={id("files")}>Photos</Label>
        <Input
          ref={obsFileInputRef}
          id={id("files")}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) =>
            setFiles(e.target.files ? Array.from(e.target.files) : [])
          }
        />
        {files.length > 0 ? (
          <ul className="flex flex-wrap gap-3 pt-1">
            {files.map((file, i) => (
              <li
                key={`${file.name}-${file.size}-${i}-${formSuffix}`}
                className="relative w-[calc(50%-0.375rem)] max-w-[140px] sm:w-[140px]"
              >
                <div className="overflow-hidden rounded-xl border bg-muted">
                  {obsPhotoPreviewUrls[i] ? (
                    <img
                      src={obsPhotoPreviewUrls[i]}
                      alt=""
                      className="aspect-square h-auto w-full object-cover"
                    />
                  ) : (
                    <div className="aspect-square w-full animate-pulse bg-muted-foreground/15" />
                  )}
                </div>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {file.name}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute right-1 top-1 size-7 rounded-full border border-border/80 bg-background/90 shadow-sm backdrop-blur-sm"
                  onClick={() => removeObservationPhoto(i)}
                  aria-label={`Remove ${file.name}`}
                >
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    strokeWidth={2}
                    className="size-3.5"
                  />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </>
  )
}

export function FieldDetailPage() {
  const { id } = useParams()
  const [field, setField] = useState<FarmField | null>(null)
  const [obs, setObs] = useState<FieldObservation[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [symptom, setSymptom] = useState("")
  const [severity, setSeverity] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM")
  const [observedAt, setObservedAt] = useState(() =>
    new Date().toISOString().slice(0, 16)
  )
  const [files, setFiles] = useState<File[]>([])
  const [obsPhotoPreviewUrls, setObsPhotoPreviewUrls] = useState<string[]>([])
  const obsFileInputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editCrop, setEditCrop] = useState("")
  const [editSoil, setEditSoil] = useState("")
  const [editLoc, setEditLoc] = useState("")
  const [editMapBoundary, setEditMapBoundary] = useState<Polygon | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  const [matched, setMatched] = useState<
    { explanation: string; advisory: Advisory }[]
  >([])
  const [weather, setWeather] = useState<FieldWeatherPayload | null>(null)
  const [weatherNote, setWeatherNote] = useState<string | null>(null)

  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 10
  const [obsSeverity, setObsSeverity] = useState<
    "" | "LOW" | "MEDIUM" | "HIGH"
  >("")
  const [obsFrom, setObsFrom] = useState("")
  const [obsTo, setObsTo] = useState("")
  const [obsSort, setObsSort] = useState<"observedAt" | "createdAt">(
    "observedAt"
  )
  const [obsOrder, setObsOrder] = useState<"asc" | "desc">("desc")

  const xlUp = useXlUp()

  const loadObs = useCallback(() => {
    if (!id) return
    observationApi
      .list({
        fieldId: id,
        q: q || undefined,
        page,
        limit,
        sort: obsSort,
        order: obsOrder,
        severity: obsSeverity || undefined,
        observedFrom: obsFrom
          ? new Date(obsFrom).toISOString()
          : undefined,
        observedTo: obsTo ? new Date(obsTo).toISOString() : undefined,
      })
      .then((r) => {
        setObs(r.data)
        setTotal(r.meta.total)
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
  }, [
    id,
    q,
    page,
    obsSeverity,
    obsFrom,
    obsTo,
    obsSort,
    obsOrder,
  ])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fieldApi
      .get(id)
      .then(setField)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id) return
    fieldApi
      .matchedAdvisories(id)
      .then((r) => setMatched(r.data))
      .catch((e) =>
        toast.error(
          e instanceof Error ? e.message : "Couldn’t load guidance for this field"
        )
      )
  }, [id, field?.boundary])

  useEffect(() => {
    if (!id || !field?.boundary) {
      setWeather(null)
      setWeatherNote(null)
      return
    }
    setWeatherNote(null)
    fieldApi
      .weather(id)
      .then((w) => {
        setWeather(w)
      })
      .catch((e) => {
        setWeather(null)
        setWeatherNote(e instanceof Error ? e.message : "Forecast unavailable")
      })
  }, [id, field?.boundary])

  useLayoutEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f))
    setObsPhotoPreviewUrls(urls)
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [files])

  useEffect(() => {
    loadObs()
  }, [loadObs])

  function removeObservationPhoto(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    if (obsFileInputRef.current) obsFileInputRef.current.value = ""
  }

  async function submitObs(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setSaving(true)
    try {
      await observationApi.create({
        fieldId: id,
        symptomText: symptom,
        severity,
        observedAt: new Date(observedAt).toISOString(),
        files,
      })
      toast.success("Observation saved.")
      if (!xlUp) setOpen(false)
      setSymptom("")
      setFiles([])
      loadObs()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  function syncEditFormFromField(current: FarmField) {
    setEditName(current.name)
    setEditCrop(current.crop ?? "")
    setEditSoil(current.soilNotes ?? "")
    setEditLoc(current.locationText ?? "")
    setEditMapBoundary(current.boundary ?? null)
  }

  function handleEditBoundaryChange(boundary: Polygon | null) {
    setEditMapBoundary(boundary)
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !field) return
    setEditSaving(true)
    try {
      const updated = await fieldApi.update(id, {
        name: editName,
        crop: editCrop.trim() === "" ? null : editCrop.trim(),
        soilNotes: editSoil || undefined,
        locationText: editLoc || undefined,
        boundary: editMapBoundary,
      })
      setField(updated)
      toast.success("Field details saved.")
      setEditOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed")
    } finally {
      setEditSaving(false)
    }
  }

  if (loading || !field) {
    return (
      <RoleGate allow="FARMER">
        <div
          className="flex flex-1 flex-col gap-5"
          aria-busy="true"
          aria-label="Loading field"
        >
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="min-h-[min(380px,52vh)] w-full rounded-4xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-56 max-w-full" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="min-h-[160px] rounded-xl" />
        </div>
      </RoleGate>
    )
  }

  function openEditDialog() {
    if (!field) return
    syncEditFormFromField(field)
    setEditOpen(true)
  }

  return (
    <RoleGate allow="FARMER">
      <div className="flex min-h-0 flex-1 flex-col">
      <Dialog
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v)
          if (v && field) syncEditFormFromField(field)
        }}
      >
        <DialogContent className="max-h-[min(92vh,900px)] max-w-4xl overflow-y-auto sm:max-w-4xl">
          <form onSubmit={submitEdit}>
                <DialogHeader>
              <DialogTitle>Edit your field</DialogTitle>
                </DialogHeader>
            <div className="grid gap-6 py-4 lg:grid-cols-2 lg:gap-8">
              <div className="space-y-4">
                  <div className="space-y-2">
                  <Label htmlFor="ef-name">Name</Label>
                  <Input
                    id="ef-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                  <Label htmlFor="ef-crop">Crop</Label>
                  <Input
                    id="ef-crop"
                    value={editCrop}
                    onChange={(e) => setEditCrop(e.target.value)}
                    placeholder="e.g. Potato"
                    maxLength={120}
                  />
                  </div>
                  <div className="space-y-2">
                  <Label htmlFor="ef-soil">Soil notes</Label>
                  <Textarea
                    id="ef-soil"
                    value={editSoil}
                    onChange={(e) => setEditSoil(e.target.value)}
                    rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                  <Label htmlFor="ef-loc">Location notes</Label>
                    <Input
                    id="ef-loc"
                    value={editLoc}
                    onChange={(e) => setEditLoc(e.target.value)}
                    />
                  </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Outline on map
                </Label>
                {editOpen ? (
                  <FieldMapDraw
                    key={`${field.id}-${field.updatedAt}`}
                    initialPolygon={editMapBoundary}
                    onBoundaryChange={handleEditBoundaryChange}
                    initialZoom={FARMER_MAP_ZOOM}
                    fitPolygonMaxZoom={MAP_MAX_ZOOM - 1}
                    footerHint="Adjust the outline to update hectares (automatically), advisory matching, and the forecast location. One polygon at a time."
                  />
                ) : null}
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={editSaving}>
                {editSaving ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div
        className={cn(
          "space-y-6",
          "xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(288px,380px)] xl:gap-8 xl:space-y-0"
        )}
      >
        <div className="min-w-0 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="motion-safe:transition-colors motion-safe:duration-200 hover:bg-accent/60"
              asChild
            >
              <Link to="/farmer">← My fields</Link>
            </Button>
            {!xlUp ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="motion-safe:transition-[box-shadow,transform,border-color] motion-safe:duration-200 motion-safe:hover:-translate-y-px hover:shadow-md"
                  onClick={openEditDialog}
                >
                  Edit field
                </Button>
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button className="motion-safe:transition-[box-shadow,transform] motion-safe:duration-200 motion-safe:hover:-translate-y-px hover:shadow-md">
                      Log observation
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <form onSubmit={submitObs}>
                      <DialogHeader>
                        <DialogTitle>Log observation</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <ObservationFormFields
                          formSuffix="dlg"
                          symptom={symptom}
                          setSymptom={setSymptom}
                          severity={severity}
                          setSeverity={setSeverity}
                          observedAt={observedAt}
                          setObservedAt={setObservedAt}
                          setFiles={setFiles}
                          obsPhotoPreviewUrls={obsPhotoPreviewUrls}
                          removeObservationPhoto={removeObservationPhoto}
                          obsFileInputRef={obsFileInputRef}
                          files={files}
                        />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                          {saving ? "Saving…" : "Save observation"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
            ) : null}
          </div>

          {!field.boundary ? (
            <Card className="rounded-4xl border-dashed bg-muted/30 motion-safe:transition-[border-color,background-color,box-shadow] motion-safe:duration-300 hover:border-muted-foreground/35 hover:bg-muted/45 hover:shadow-md">
              <CardContent className="py-10 text-center text-sm text-muted-foreground sm:py-14">
                Map your land so we can match guidance to this parcel and show
                a forecast for it.{" "}
                <button
                  type="button"
                  className="motion-safe:transition-colors motion-safe:duration-200 font-medium text-foreground underline underline-offset-4 hover:bg-accent/40 hover:no-underline"
                  onClick={openEditDialog}
                >
                  Edit field
                </button>{" "}
                to draw the outline.
              </CardContent>
            </Card>
          ) : (
            <FieldBoundaryPreview
              geometry={field.boundary}
              className={cn(
                "rounded-4xl border-border/40 shadow-sm ring-1 ring-border/30",
                "motion-safe:transition-[box-shadow,ring-color,border-color] motion-safe:duration-300 motion-safe:ease-out",
                "hover:border-primary/25 hover:shadow-xl hover:ring-primary/20 dark:hover:ring-primary/30"
              )}
              mapClassName="min-h-[240px] h-[min(380px,52vh)] xl:min-h-[280px] xl:h-[min(440px,48vh)]"
            />
          )}

          <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-500 motion-safe:fill-mode-both">
            <h1 className="text-2xl font-semibold tracking-tight motion-safe:transition-colors motion-safe:duration-200">
              {field.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {[field.crop, `${field.areaHectares} ha`]
                .filter(Boolean)
                .join(" · ")}
              {field.soilNotes ? ` · ${field.soilNotes}` : ""}
            </p>
          </div>

        <Card className={FIELD_DETAIL_CARD_HOVER}>
          <CardHeader>
            <CardTitle className="text-base">
              Guidance for this field
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!field.boundary ? (
              <p className="text-muted-foreground">
                Map your field to see guidance wherever published advisories
                overlap your land.
              </p>
            ) : matched.length === 0 ? (
              <p className="text-muted-foreground">
                Nothing active overlaps your field right now—check back when new
                guidance is published.
              </p>
            ) : (
              matched.map(({ explanation, advisory: a }) => (
                <div
                  key={a.id}
                  className={cn(
                    "group/advisory rounded-lg border border-border/80 p-3",
                    "motion-safe:transition-[border-color,background-color,box-shadow] motion-safe:duration-200 motion-safe:ease-out",
                    "hover:border-primary/25 hover:bg-muted/35 hover:shadow-sm"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      className="font-medium text-foreground underline-offset-2 motion-safe:transition-colors motion-safe:duration-200 hover:text-primary hover:underline group-hover/advisory:text-primary"
                      to={`/advisories/${a.id}`}
                    >
                      {a.title}
                    </Link>
                    <Badge
                      variant="secondary"
                      className="motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover/advisory:-translate-y-px"
                    >
                      {a.category}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {explanation}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    In effect{" "}
                    {new Date(a.validFrom).toLocaleDateString(undefined, {
                      dateStyle: "medium",
                    })}{" "}
                    –{" "}
                    {new Date(a.validTo).toLocaleDateString(undefined, {
                      dateStyle: "medium",
                    })}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className={FIELD_DETAIL_CARD_HOVER}>
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-base">Weather nearby</CardTitle>
            {field.boundary && weather && !weatherNote ? (
              <p className="text-xs text-muted-foreground">
                Forecast for the center of your mapped field (
                {weather.latitude.toFixed(4)}, {weather.longitude.toFixed(4)})
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {!field.boundary ? (
              <p className="text-muted-foreground">
                Draw your field on the map to load a short-range forecast for
                this parcel.
              </p>
            ) : weatherNote ? (
              <p className="text-destructive">{weatherNote}</p>
            ) : weather ? (
              <>
                {(() => {
                  const cur = weather.forecast.current as
                    | Record<string, unknown>
                    | undefined
                  if (
                    !cur ||
                    typeof cur.temperature_2m !== "number" ||
                    typeof cur.wind_speed_10m !== "number"
                  ) {
                    return null
                  }
                  const when =
                    typeof cur.time === "string"
                      ? formatWeatherInstant(cur.time)
                      : null
                  return (
                    <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border/70 bg-muted/25 px-4 py-3 motion-safe:transition-[border-color,background-color,box-shadow] motion-safe:duration-200 hover:border-primary/20 hover:bg-muted/40 hover:shadow-sm">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          Current conditions
                        </p>
                        <p className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight">
                          {cur.temperature_2m}
                          <span className="text-lg font-normal text-muted-foreground">
                            {" "}
                            °C
                          </span>
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="tabular-nums text-foreground">
                          Wind {cur.wind_speed_10m}{" "}
                          <span className="text-muted-foreground">m/s</span>
                        </p>
                        {when ? (
                          <p className="mt-1 max-w-[14rem] text-xs leading-snug text-muted-foreground">
                            As of {when}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )
                })()}
                {(() => {
                  const h = weather.forecast.hourly as
                    | Record<string, unknown>
                    | undefined
                  const times = h?.time
                  if (!Array.isArray(times) || times.length === 0) return null
                  const n = Math.min(8, times.length)
                  const temps = h?.temperature_2m as number[] | undefined
                  const wind = h?.wind_speed_10m as number[] | undefined
                  const dayLine = hourlyDayHeading(times, n)
                  return (
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Next few hours
                      </p>
                      <div className="overflow-hidden rounded-xl border border-border/70 motion-safe:transition-[border-color,box-shadow] motion-safe:duration-200 hover:border-primary/15 hover:shadow-md">
                        {dayLine ? (
                          <div className="border-b border-border/60 bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
                            {dayLine}
                          </div>
                        ) : null}
                        <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          <span className="w-[4.5rem] shrink-0">Time</span>
                          <span className="shrink-0">Temp</span>
                          <span className="min-w-0 shrink text-right">Wind</span>
                        </div>
                        <ul className="divide-y divide-border/50">
                          {times.slice(0, n).map((t, i) => (
                            <li
                              key={`${i}-${String(t)}`}
                              className="flex items-center justify-between gap-3 px-3 py-2 text-sm motion-safe:transition-colors motion-safe:duration-150 hover:bg-muted/40"
                            >
                              <span className="w-[4.5rem] shrink-0 tabular-nums text-muted-foreground">
                                {formatHourClock(String(t))}
                              </span>
                              <span className="tabular-nums font-medium">
                                {temps?.[i] !== undefined ? `${temps[i]}°` : "—"}
                              </span>
                              <span className="min-w-0 shrink text-right tabular-nums text-muted-foreground">
                                {wind?.[i] !== undefined ? `${wind[i]} m/s` : "—"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )
                })()}
                <p className="text-[10px] leading-snug text-muted-foreground/35 motion-safe:transition-opacity motion-safe:duration-200 hover:text-muted-foreground/50 [&_a]:text-muted-foreground/45 [&_a]:underline [&_a]:underline-offset-2 [&_a]:motion-safe:transition-colors [&_a]:duration-200 [&_a:hover]:text-muted-foreground/80">
                  <a
                    href={weather.attribution.providerUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {weather.attribution.providerName}
                  </a>
                  {" · "}
                  <a
                    href={weather.attribution.apiDocumentationUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Source & docs
                  </a>
                  {" · "}
                  Check conditions on the ground before you rely on this alone.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">Loading forecast…</p>
            )}
          </CardContent>
        </Card>

        <Card className={FIELD_DETAIL_CARD_HOVER}>
          <CardHeader>
            <CardTitle className="text-base">Observation log</CardTitle>
            <div className="space-y-2 pt-2">
              <div className="flex flex-wrap items-center gap-2">
              <Input
                  placeholder="Search this log…"
                value={q}
                onChange={(e) => {
                  setPage(1)
                  setQ(e.target.value)
                }}
                  className="min-w-0 flex-1 basis-[min(100%,14rem)] sm:max-w-sm motion-safe:transition-[box-shadow,border-color] motion-safe:duration-200 hover:border-ring/40"
                />
                <Select
                  value={obsSeverity === "" ? "__any" : obsSeverity}
                  onValueChange={(v) => {
                    setPage(1)
                    setObsSeverity(
                      v === "__any" ? "" : (v as "LOW" | "MEDIUM" | "HIGH")
                    )
                  }}
                >
                  <SelectTrigger className="h-9 w-[min(100%,9.5rem)] shrink-0 sm:w-[132px]">
                    <SelectValue placeholder="How severe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any">Any level</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={`${obsSort}:${obsOrder}`}
                  onValueChange={(v) => {
                    setPage(1)
                    const [s, o] = v.split(":") as [
                      "observedAt" | "createdAt",
                      "asc" | "desc",
                    ]
                    setObsSort(s)
                    setObsOrder(o)
                  }}
                >
                  <SelectTrigger className="h-9 min-w-0 shrink-0 basis-[min(100%,16rem)] sm:w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="observedAt:desc">
                      Observed · newest first
                    </SelectItem>
                    <SelectItem value="observedAt:asc">
                      Observed · oldest first
                    </SelectItem>
                    <SelectItem value="createdAt:desc">
                      Saved · newest first
                    </SelectItem>
                    <SelectItem value="createdAt:asc">
                      Saved · oldest first
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 shrink-0 px-2 text-muted-foreground motion-safe:transition-colors motion-safe:duration-200 hover:bg-accent/50 hover:text-foreground"
                  onClick={() => {
                    setPage(1)
                    setObsFrom("")
                    setObsTo("")
                    setObsSeverity("")
                    setObsSort("observedAt")
                    setObsOrder("desc")
                    setQ("")
                  }}
                >
                  Clear filters
                </Button>
              </div>

              <details
                className="group/details rounded-lg border border-border/50 bg-muted/15 motion-safe:transition-[border-color,background-color,box-shadow] motion-safe:duration-200 hover:border-border hover:bg-muted/25 hover:shadow-sm [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="cursor-pointer list-none px-3 py-2 text-xs text-muted-foreground motion-safe:transition-colors motion-safe:duration-200 hover:bg-muted/50 hover:text-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span className="font-medium">Observed between…</span>
                    {obsFrom || obsTo ? (
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                        Filter on
                      </Badge>
                    ) : (
                      <span className="opacity-70">optional</span>
                    )}
                    <span className="text-muted-foreground/60 group-open/details:rotate-180 motion-safe:transition-transform motion-safe:duration-200">
                      ▾
                    </span>
                  </span>
                </summary>
                <div className="flex flex-wrap items-center gap-2 border-t border-border/40 px-3 pb-3 pt-2">
                  <Input
                    id="obs-from"
                    type="datetime-local"
                    aria-label="Start of date range"
                    value={obsFrom}
                    onChange={(e) => {
                      setPage(1)
                      setObsFrom(e.target.value)
                    }}
                    className={cn(
                      "h-9 w-auto min-w-[min(100%,11rem)] flex-1 basis-[10rem] sm:min-w-[180px]",
                      obsFrom
                        ? "text-foreground"
                        : "text-muted-foreground/35 focus:text-foreground"
                    )}
                  />
                  <span className="text-xs text-muted-foreground/50">to</span>
                  <Input
                    id="obs-to"
                    type="datetime-local"
                    aria-label="End of date range"
                    value={obsTo}
                    onChange={(e) => {
                      setPage(1)
                      setObsTo(e.target.value)
                    }}
                    className={cn(
                      "h-9 w-auto min-w-[min(100%,11rem)] flex-1 basis-[10rem] sm:min-w-[180px]",
                      obsTo
                        ? "text-foreground"
                        : "text-muted-foreground/35 focus:text-foreground"
                    )}
                  />
                </div>
              </details>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {obs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing logged here yet—use{" "}
                <span className="font-medium text-foreground">
                  Log observation
                </span>{" "}
                when you spot something worth recording.
              </p>
            ) : (
              obs.map((o) => {
                const observed = new Date(o.observedAt)
                const created = new Date(o.createdAt)
                const showLateSave =
                  Number.isFinite(observed.getTime()) &&
                  Number.isFinite(created.getTime()) &&
                  Math.abs(created.getTime() - observed.getTime()) > 60_000
                const hasMedia = o.media.length > 0

                return (
                <div
                  key={o.id}
                    className={cn(
                      "rounded-xl border p-4 text-sm sm:p-5",
                      "motion-safe:transition-[border-color,background-color,box-shadow] motion-safe:duration-200 motion-safe:ease-out",
                      "hover:border-primary/20 hover:bg-muted/25 hover:shadow-sm"
                    )}
                  >
                    {o.isRemovedByModerator ? (
                      <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        This entry was hidden by a moderator and may be limited
                        for other viewers.
                      </p>
                    ) : null}
                    <div
                      className={cn(
                        "flex flex-col gap-4",
                        hasMedia && "sm:flex-row sm:items-start sm:justify-between sm:gap-6"
                      )}
                    >
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "w-fit shrink-0 border font-medium",
                              observationSeverityBadgeClass(o.severity)
                            )}
                          >
                            {observationSeverityLabel(o.severity)} severity
                          </Badge>
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              When you saw it
                            </p>
                            <time
                              dateTime={o.observedAt}
                              className="block text-base font-medium tabular-nums leading-snug tracking-tight text-foreground"
                            >
                              {observed.toLocaleString(undefined, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </time>
                          </div>
                        </div>
                        {showLateSave ? (
                          <p className="text-[11px] leading-snug text-muted-foreground">
                            Logged in app{" "}
                            {created.toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </p>
                        ) : null}
                        <div className="border-t border-border/50 pt-3">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            What you noticed
                          </p>
                          {o.symptomText.trim() ? (
                            <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
                              {o.symptomText}
                            </p>
                          ) : (
                            <p className="mt-1.5 text-sm italic text-muted-foreground">
                              No written notes for this entry.
                            </p>
                          )}
                        </div>
                  </div>
                      {hasMedia ? (
                        <div
                          className={cn(
                            "flex shrink-0 gap-2 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]",
                            "sm:w-[168px] sm:flex-col sm:overflow-visible sm:pb-0"
                          )}
                        >
                      {o.media.map((m) => (
                            <a
                              key={m.id}
                              href={mediaUrl(m.url)}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(
                                "group/img relative block shrink-0 overflow-hidden rounded-xl border border-border/70 bg-muted/50 shadow-sm",
                                "motion-safe:transition-[border-color,box-shadow] motion-safe:duration-200",
                                "hover:border-primary/30 hover:shadow-md",
                                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                "sm:w-full"
                              )}
                            >
                              <img
                          src={mediaUrl(m.url)}
                                alt={m.filename ? `Photo: ${m.filename}` : "Observation photo"}
                                className="h-28 w-28 object-cover motion-safe:transition-transform motion-safe:duration-200 group-hover/img:scale-[1.03] sm:h-auto sm:w-full sm:max-h-[220px]"
                        />
                            </a>
                      ))}
                        </div>
                      ) : null}
                    </div>
                </div>
                )
              })
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-4">
              <span className="text-xs text-muted-foreground">
                {total === 0
                  ? "No entries"
                  : (() => {
                      const start = (page - 1) * limit + 1
                      const end = Math.min(page * limit, total)
                      return `${start}–${end} of ${total}`
                    })()}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  className="motion-safe:transition-[transform,border-color,box-shadow] motion-safe:duration-200 motion-safe:enabled:hover:-translate-y-px enabled:hover:shadow-sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page * limit >= total}
                  className="motion-safe:transition-[transform,border-color,box-shadow] motion-safe:duration-200 motion-safe:enabled:hover:-translate-y-px enabled:hover:shadow-sm"
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
        {xlUp ? (
          <aside className="sticky top-20 z-10 flex max-h-[calc(100vh-5.75rem)] min-h-0 w-full max-w-full shrink-0 flex-col gap-4 self-start">
            <div className="flex shrink-0 justify-end">
              <Button
                type="button"
                variant="outline"
                className="motion-safe:transition-[box-shadow,transform,border-color] motion-safe:duration-200 motion-safe:hover:-translate-y-px hover:shadow-md"
                onClick={openEditDialog}
              >
                Edit field
              </Button>
            </div>
            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/80 shadow-md ring-1 ring-border/30 motion-safe:transition-[box-shadow,transform,ring-color] motion-safe:duration-300 motion-safe:ease-out motion-safe:hover:-translate-y-0.5 hover:shadow-xl hover:ring-primary/15 dark:hover:ring-primary/25">
              <CardHeader className="shrink-0 space-y-1 pb-3 pt-5">
                <CardTitle className="text-base">Log observation</CardTitle>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Capture what you noticed—photos optional—while you read
                  guidance and weather alongside this form.
                </p>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-0">
                <form onSubmit={submitObs} className="flex flex-col gap-4 pb-1">
                  <ObservationFormFields
                    formSuffix="side"
                    symptom={symptom}
                    setSymptom={setSymptom}
                    severity={severity}
                    setSeverity={setSeverity}
                    observedAt={observedAt}
                    setObservedAt={setObservedAt}
                    setFiles={setFiles}
                    obsPhotoPreviewUrls={obsPhotoPreviewUrls}
                    removeObservationPhoto={removeObservationPhoto}
                    obsFileInputRef={obsFileInputRef}
                    files={files}
                    symptomRows={5}
                  />
                  <Button
                    type="submit"
                    disabled={saving}
                    className="w-full shrink-0 motion-safe:transition-[transform,box-shadow] motion-safe:duration-200 motion-safe:enabled:hover:-translate-y-px enabled:hover:shadow-md"
                  >
                    {saving ? "Saving…" : "Save observation"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </aside>
        ) : null}
      </div>
      </div>
    </RoleGate>
  )
}
