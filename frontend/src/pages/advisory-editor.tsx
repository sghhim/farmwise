import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import type { Advisory, AdvisoryExtent } from "@/types"
import { advisoryApi, mediaUrl } from "@/lib/api"
import {
  formatAdvisoryListInput,
  parseAdvisoryListInput,
} from "@/lib/advisory-lists"
import { RoleGate } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { FieldBoundaryPreview } from "@/components/field-boundary-preview"
import { FieldMapDraw } from "@/components/field-map-draw"
import { AGRONOMIST_MAP_ZOOM } from "@/lib/map-styles"
import { useAuth } from "@/context/auth-context"

export function AdvisoryEditorPage() {
  const { id } = useParams()
  const isNew = !id || id === "new"
  const navigate = useNavigate()
  const { user, refresh } = useAuth()

  const [loading, setLoading] = useState(!isNew)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [validFrom, setValidFrom] = useState("")
  const [validTo, setValidTo] = useState("")
  const [maxHa, setMaxHa] = useState("")
  const [cropsText, setCropsText] = useState("")
  const [regionsText, setRegionsText] = useState("")
  const [weatherContext, setWeatherContext] = useState("")
  const [advisory, setAdvisory] = useState<Advisory | null>(null)
  const [saving, setSaving] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  /** Advisory map area (Polygon from draw, or MultiPolygon from API until redrawn). */
  const [extentDraft, setExtentDraft] = useState<AdvisoryExtent | null>(null)
  const [mapTick, setMapTick] = useState(0)

  useEffect(() => {
    if (isNew || !id) return
    let cancelled = false
    advisoryApi
      .get(id)
      .then((a) => {
        if (cancelled) return
        setAdvisory(a)
        setExtentDraft(a.extent)
        setTitle(a.title)
        setDescription(a.description)
        setCategory(a.category)
        setValidFrom(a.validFrom.slice(0, 10))
        setValidTo(a.validTo.slice(0, 10))
        setMaxHa(a.maxRecommendedHectares)
        setCropsText(formatAdvisoryListInput(a.targetCrops ?? []))
        setRegionsText(formatAdvisoryListInput(a.geographicLabels ?? []))
        setWeatherContext(a.weatherContext ?? "")
        setMapTick((t) => t + 1)
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, isNew])

  useEffect(() => {
    if (!isNew) return
    setExtentDraft(null)
    setMapTick((t) => t + 1)
  }, [isNew])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const vf = new Date(validFrom).toISOString()
      const vt = new Date(validTo).toISOString()
      const body = {
        title,
        description,
        category,
        targetCrops: parseAdvisoryListInput(cropsText),
        geographicLabels: parseAdvisoryListInput(regionsText),
        weatherContext:
          weatherContext.trim() === "" ? null : weatherContext.trim(),
        extent: extentDraft,
        validFrom: vf,
        validTo: vt,
        maxRecommendedHectares: Number(maxHa),
      }
      if (isNew) {
        const created = await advisoryApi.create(body)
        toast.success("Draft created")
        navigate(`/agronomist/advisories/${created.id}`)
      } else if (id) {
        const updated = await advisoryApi.update(id, body)
        setAdvisory(updated)
        setExtentDraft(updated.extent)
        toast.success("Saved")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function uploadAttachment() {
    if (!id || !file) return
    try {
      await advisoryApi.uploadAttachment(id, file)
      toast.success("Attachment uploaded")
      setFile(null)
      const a = await advisoryApi.get(id)
      setAdvisory(a)
      setExtentDraft(a.extent)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
    }
  }

  async function publish() {
    if (!id) return
    try {
      await advisoryApi.publish(id)
      toast.success("Published")
      void refresh()
      const a = await advisoryApi.get(id)
      setAdvisory(a)
      setExtentDraft(a.extent)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed")
    }
  }

  if (!isNew && loading) {
    return (
      <RoleGate allow="AGRONOMIST">
        <Skeleton className="h-96 w-full" />
      </RoleGate>
    )
  }

  return (
    <RoleGate allow="AGRONOMIST">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/agronomist">← Dashboard</Link>
          </Button>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isNew ? "New advisory" : "Edit advisory"}
          </h1>
          {!isNew && advisory && (
            <p className="text-sm text-muted-foreground">
              Status: {advisory.status}
            </p>
          )}
        </div>

        {user?.role === "AGRONOMIST" && !user.agronomistVerified && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
            <CardHeader>
              <CardTitle className="text-base text-amber-900 dark:text-amber-100">
                Account not verified yet
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-amber-900/90 dark:text-amber-100/90">
              An admin needs to approve your agronomist account before you can
              publish. You can still save drafts.
            </CardContent>
          </Card>
        )}

        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat">Category</Label>
            <Input
              id="cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crops">Target crops</Label>
            <Input
              id="crops"
              placeholder="e.g. Potato, Tomato (comma-separated)"
              value={cropsText}
              onChange={(e) => setCropsText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Which crops this guidance applies to. Farmers can filter
              advisories by crop.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Geographic map area</Label>
            <p className="text-xs text-muted-foreground">
              Draw where this advisory applies. Publishing requires an area so
              farmer fields can match automatically when boundaries overlap.
            </p>
            {extentDraft?.type === "MultiPolygon" && (
              <p className="text-xs text-amber-800 dark:text-amber-200">
                This advisory uses a multi-part map area. Draw a single polygon
                below to replace it with one shape, or leave as-is and save.
              </p>
            )}
            {extentDraft?.type === "MultiPolygon" ? (
              <FieldBoundaryPreview geometry={extentDraft} />
            ) : null}
            <FieldMapDraw
              key={mapTick}
              initialZoom={AGRONOMIST_MAP_ZOOM}
              initialPolygon={
                extentDraft?.type === "Polygon" ? extentDraft : null
              }
              onBoundaryChange={(poly) =>
                setExtentDraft(poly as AdvisoryExtent | null)
              }
              footerHint="Draw the region where this advisory applies (one polygon). Farmers see it when their field overlaps this shape."
              className="ring-offset-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="regions">Geographic scope</Label>
            <Input
              id="regions"
              placeholder="e.g. Pacific Northwest, Karnataka"
              value={regionsText}
              onChange={(e) => setRegionsText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Regions, states, or countries where this advisory is relevant.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="weather">Weather and risk context</Label>
            <Textarea
              id="weather"
              placeholder="e.g. Sustained relative humidity above 85% with cool nights increases late blight pressure on potato foliage."
              value={weatherContext}
              onChange={(e) => setWeatherContext(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Tie weather conditions (humidity, temperature, leaf wetness) to
              disease or management risk for the crops above. This is included
              in keyword search.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vf">Valid from</Label>
              <Input
                id="vf"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vt">Valid to</Label>
              <Input
                id="vt"
                type="date"
                value={validTo}
                onChange={(e) => setValidTo(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ha">Max recommended hectares</Label>
            <Input
              id="ha"
              type="number"
              step="0.01"
              min="0"
              value={maxHa}
              onChange={(e) => setMaxHa(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : isNew ? "Create draft" : "Save changes"}
          </Button>
        </form>

        {!isNew && id && advisory?.status === "DRAFT" && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={publish}>
              Publish
            </Button>
          </div>
        )}

        {!isNew && id && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attachments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-2">
                  <Label htmlFor="file">File (max 5 per advisory, 8MB)</Label>
                  <Input
                    id="file"
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!file}
                  onClick={uploadAttachment}
                >
                  Upload
                </Button>
              </div>
              {advisory && advisory.attachments.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {advisory.attachments.map((f) => (
                    <div key={f.id} className="text-sm">
                      {f.mimeType?.startsWith("image/") ? (
                        <img
                          src={mediaUrl(f.url)}
                          alt=""
                          className="rounded-md border"
                        />
                      ) : (
                        <a
                          className="underline"
                          href={mediaUrl(f.url)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {f.filename}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </RoleGate>
  )
}
