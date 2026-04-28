export type UserRole = "ADMIN" | "AGRONOMIST" | "FARMER"

export type Me = {
  id: string
  email: string
  role: UserRole
  agronomistVerified: boolean
  isActive?: boolean
}

export type AdvisoryStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED"

export type AdvisoryExtent =
  | {
      type: "Polygon"
      coordinates: number[][][]
    }
  | {
      type: "MultiPolygon"
      coordinates: number[][][][]
    }

export type Advisory = {
  id: string
  title: string
  description: string
  category: string
  /** Crops this advisory targets (e.g. potato, wheat). */
  targetCrops: string[]
  /** Where it applies: regions, countries, etc. */
  geographicLabels: string[]
  /** How weather conditions relate to risk (humidity, frost, etc.). */
  weatherContext: string | null
  /** Map area for geographic matching (Polygon or MultiPolygon). */
  extent: AdvisoryExtent | null
  validFrom: string
  validTo: string
  maxRecommendedHectares: string
  status: AdvisoryStatus
  ownerId: string
  owner?: { id: string; email: string }
  attachments: {
    id: string
    filename: string
    url: string
    mimeType: string | null
    sizeBytes: number
  }[]
  createdAt: string
  updatedAt: string
}

export type FarmField = {
  id: string
  farmerId: string
  name: string
  /** Primary crop(s), e.g. "Potato". */
  crop: string | null
  areaHectares: string
  soilNotes: string | null
  locationText: string | null
  /** WGS84 GeoJSON Polygon from map, if drawn. */
  boundary?: {
    type: "Polygon"
    coordinates: number[][][]
  } | null
  createdAt: string
  updatedAt: string
}

export type ObservationSeverity = "LOW" | "MEDIUM" | "HIGH"

export type FieldObservation = {
  id: string
  fieldId: string
  field?: { id: string; name: string }
  symptomText: string
  severity: ObservationSeverity
  observedAt: string
  isRemovedByModerator: boolean
  media: {
    id: string
    filename: string
    url: string
    mimeType: string | null
    sizeBytes: number
  }[]
  createdAt: string
}

export type Paginated<T> = {
  data: T[]
  meta: { total: number; page: number; limit: number }
}

/** Response from GET /api/fields/:id/weather */
export type FieldWeatherPayload = {
  latitude: number
  longitude: number
  fetchedAt: string
  cacheHit: boolean
  forecast: Record<string, unknown>
  attribution: {
    providerName: string
    providerUrl: string
    apiDocumentationUrl: string
  }
}
