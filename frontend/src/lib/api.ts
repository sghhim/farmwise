import type {
  Advisory,
  AdvisoryExtent,
  AdvisoryStatus,
  FarmField,
  FieldObservation,
  FieldWeatherPayload,
  Me,
  Paginated,
} from "@/types"

const TOKEN_KEY = "fieldwise_token"

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

const base = import.meta.env.VITE_API_URL ?? ""

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    return j.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const headers = new Headers(init?.headers)
  const body = init?.body
  if (body && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }
  if (token) headers.set("Authorization", `Bearer ${token}`)

  const res = await fetch(`${base}${path}`, { ...init, headers })
  if (!res.ok) {
    throw new Error(await parseError(res))
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

/** Absolute URL for static uploads (proxied in dev). */
export function mediaUrl(relative: string): string {
  if (relative.startsWith("http")) return relative
  return `${base}${relative}`
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ token: string; user: Me }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (body: {
    email: string
    password: string
    role: "FARMER" | "AGRONOMIST"
  }) =>
    api<{ token: string; user: Me }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  me: () => api<Me>("/api/auth/me"),
}

export const advisoryApi = {
  list: (params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") q.set(k, String(v))
    })
    return api<Paginated<Advisory>>(`/api/advisories?${q.toString()}`)
  },
  mine: (params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") q.set(k, String(v))
    })
    return api<Paginated<Advisory>>(`/api/advisories/mine?${q.toString()}`)
  },
  get: (id: string) => api<Advisory>(`/api/advisories/${id}`),
  create: (body: {
    title: string
    description: string
    category: string
    targetCrops?: string[]
    geographicLabels?: string[]
    weatherContext?: string | null
    extent?: AdvisoryExtent | null
    validFrom: string
    validTo: string
    maxRecommendedHectares: number
  }) =>
    api<Advisory>("/api/advisories", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (
    id: string,
    body: Partial<{
      title: string
      description: string
      category: string
      targetCrops: string[]
      geographicLabels: string[]
      weatherContext: string | null
      extent?: AdvisoryExtent | null
      validFrom: string
      validTo: string
      maxRecommendedHectares: number
    }>
  ) =>
    api<Advisory>(`/api/advisories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  publish: (id: string) =>
    api<Advisory>(`/api/advisories/${id}/publish`, { method: "POST" }),
  archive: (id: string) =>
    api<Advisory>(`/api/advisories/${id}/archive`, { method: "POST" }),
  uploadAttachment: (id: string, file: File) => {
    const fd = new FormData()
    fd.append("file", file)
    return api<{ id: string; filename: string; url: string }>(
      `/api/advisories/${id}/attachments`,
      { method: "POST", body: fd }
    )
  },
}

export const fieldApi = {
  list: () => api<{ data: FarmField[] }>("/api/fields"),
  get: (id: string) => api<FarmField>(`/api/fields/${id}`),
  create: (body: {
    name: string
    crop?: string
    soilNotes?: string
    locationText?: string
    boundary: { type: "Polygon"; coordinates: number[][][] }
  }) =>
    api<FarmField>("/api/fields", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (
    id: string,
    body: Partial<{
      name: string
      crop: string | null
      soilNotes: string
      locationText: string
      boundary: { type: "Polygon"; coordinates: number[][][] } | null
    }>
  ) =>
    api<FarmField>(`/api/fields/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  matchedAdvisories: (fieldId: string) =>
    api<{ data: { explanation: string; advisory: Advisory }[] }>(
      `/api/fields/${fieldId}/advisories`
    ),
  weather: (fieldId: string) =>
    api<FieldWeatherPayload>(`/api/fields/${fieldId}/weather`),
}

export const observationApi = {
  list: (params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") q.set(k, String(v))
    })
    return api<Paginated<FieldObservation>>(`/api/observations?${q.toString()}`)
  },
  create: (opts: {
    fieldId: string
    symptomText: string
    severity: string
    observedAt: string
    files: File[]
  }) => {
    const fd = new FormData()
    fd.append("fieldId", opts.fieldId)
    fd.append("symptomText", opts.symptomText)
    fd.append("severity", opts.severity)
    fd.append("observedAt", opts.observedAt)
    for (const f of opts.files) {
      fd.append("files", f)
    }
    return api<FieldObservation>("/api/observations", {
      method: "POST",
      body: fd,
    })
  },
}

export const adminApi = {
  pendingAgronomists: () =>
    api<{ data: { id: string; email: string; createdAt: string }[] }>(
      "/api/admin/users/pending-agronomists"
    ),
  usersList: (params?: { page?: number; limit?: number; q?: string }) => {
    const q = new URLSearchParams()
    q.set("page", String(params?.page ?? 1))
    q.set("limit", String(params?.limit ?? 50))
    if (params?.q?.trim()) q.set("q", params.q.trim())
    return api<{
      data: {
        id: string
        email: string
        role: string
        isActive: boolean
        agronomistVerified: boolean
      }[]
      meta: { total: number; page: number; limit: number }
    }>(`/api/admin/users?${q.toString()}`)
  },
  advisoriesList: (params?: { page?: number; limit?: number; q?: string }) => {
    const q = new URLSearchParams()
    q.set("page", String(params?.page ?? 1))
    q.set("limit", String(params?.limit ?? 50))
    if (params?.q?.trim()) q.set("q", params.q.trim())
    return api<{
      data: {
        id: string
        title: string
        status: AdvisoryStatus
        category: string
        ownerEmail: string | null
      }[]
      meta: { total: number; page: number; limit: number }
    }>(`/api/admin/advisories?${q.toString()}`)
  },
  patchUser: (
    id: string,
    body: { agronomistVerified?: boolean; isActive?: boolean }
  ) =>
    api(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  patchAdvisory: (id: string, body: { status: AdvisoryStatus }) =>
    api(`/api/admin/advisories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  observations: (page = 1, limit = 20) =>
    api<
      Paginated<
        FieldObservation & {
          field?: { id: string; name: string; farmer: { id: string } }
        }
      >
    >(`/api/admin/observations?page=${page}&limit=${limit}`),
  observation: (id: string) =>
    api<{
      id: string
      symptomText: string
      severity: string
      observedAt: string
      isRemovedByModerator: boolean
      createdAt: string
      fieldId: string
      field: {
        id: string
        name: string
        farmerId: string
        farmerEmail: string | null
      } | null
      media: {
        id: string
        filename: string
        url: string
        mimeType: string | null
        sizeBytes: number
      }[]
    }>(`/api/admin/observations/${id}`),
  patchObservation: (id: string, isRemovedByModerator: boolean) =>
    api(`/api/admin/observations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isRemovedByModerator }),
    }),
}

export const metaApi = {
  categories: () => api<{ data: string[] }>("/api/meta/categories"),
}
