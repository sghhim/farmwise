import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { advisoryApi, mediaUrl } from "@/lib/api"
import type { Advisory } from "@/types"
import { FieldBoundaryPreview } from "@/components/field-boundary-preview"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { fadeUp } from "@/lib/motion"

export function AdvisoryDetailPage() {
  const { id } = useParams()
  const [a, setA] = useState<Advisory | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    advisoryApi
      .get(id)
      .then((data) => {
        if (!cancelled) setA(data)
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error(
            e instanceof Error ? e.message : "This advisory could not be loaded."
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!a) {
    return (
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <Alert variant="destructive">
          <AlertTitle>Advisory not available</AlertTitle>
          <AlertDescription>
            It may have been unpublished or removed, or you may not have access to this
            content.
          </AlertDescription>
        </Alert>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="space-y-6"
      variants={fadeUp}
      initial="hidden"
      animate="visible"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/advisories">← Back to published advisories</Link>
        </Button>
        <Badge>{a.status}</Badge>
        <Badge variant="secondary">{a.category}</Badge>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{a.title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Validity period: {new Date(a.validFrom).toLocaleString()} –{" "}
          {new Date(a.validTo).toLocaleString()}. Recommended application area up to{" "}
          {a.maxRecommendedHectares} hectares.
        </p>
      </div>

      {(a.targetCrops?.length ||
        a.geographicLabels?.length ||
        a.weatherContext?.trim()) && (
        <Card className="border-primary/20 bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">Crop, place, and weather context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {(a.targetCrops?.length ?? 0) > 0 && (
              <div>
                <p className="font-medium text-foreground">Target crops</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(a.targetCrops ?? []).map((c) => (
                    <Badge key={c} variant="secondary">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {(a.geographicLabels?.length ?? 0) > 0 && (
              <div>
                <p className="font-medium text-foreground">Geographic scope</p>
                <ul className="mt-2 list-inside list-disc text-muted-foreground">
                  {(a.geographicLabels ?? []).map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
            {a.weatherContext?.trim() && (
              <div>
                <p className="font-medium text-foreground">Weather and risk</p>
                <p className="mt-2 whitespace-pre-wrap leading-relaxed text-muted-foreground">
                  {a.weatherContext.trim()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {a.extent ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Published map area</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldBoundaryPreview geometry={a.extent} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Full advisory text</CardTitle>
        </CardHeader>
        <CardContent className="whitespace-pre-wrap text-sm leading-relaxed">
          {a.description}
        </CardContent>
      </Card>
      {a.attachments.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Supporting attachments</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {a.attachments.map((f) =>
              f.mimeType?.startsWith("image/") ? (
                <a key={f.id} href={mediaUrl(f.url)} target="_blank" rel="noreferrer">
                  <img
                    src={mediaUrl(f.url)}
                    alt={f.filename}
                    className="rounded-md border object-cover"
                  />
                </a>
              ) : (
                <a
                  key={f.id}
                  className="text-sm underline"
                  href={mediaUrl(f.url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {f.filename}
                </a>
              )
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}
