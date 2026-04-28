import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { adminApi, mediaUrl } from "@/lib/api"
import type { AdvisoryStatus } from "@/types"
import { RoleGate } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const ADMIN_ADV_PAGE_SIZE = 50
const ADMIN_USER_PAGE_SIZE = 50

type AdminObservationDetail = {
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
}

function isImageMime(m: string | null | undefined): boolean {
  return !!m && m.startsWith("image/")
}

/** Compact page list with ellipses when there are many pages. */
function adminPaginationPages(
  page: number,
  totalPages: number
): (number | "ellipsis")[] {
  if (totalPages <= 11) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const set = new Set<number>()
  set.add(1)
  set.add(totalPages)
  for (let d = -2; d <= 2; d++) {
    const p = page + d
    if (p >= 1 && p <= totalPages) set.add(p)
  }
  const sorted = [...set].sort((a, b) => a - b)
  const out: (number | "ellipsis")[] = []
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i]!
    if (i > 0 && n - sorted[i - 1]! > 1) out.push("ellipsis")
    out.push(n)
  }
  return out
}

function AdminPagerBar({
  label,
  page,
  totalPages,
  totalItems,
  pageSize,
  rowCount,
  loading,
  onPageChange,
}: {
  label: string
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  rowCount: number
  loading: boolean
  onPageChange: (p: number) => void
}) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const end = (page - 1) * pageSize + rowCount
  const pages = adminPaginationPages(page, totalPages)

  return (
    <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground/90">{label}: </span>
        {totalItems === 0 ? (
          "No rows on this page."
        ) : (
          <>
            <span className="tabular-nums">
              {start}–{end}
            </span>
            <span> of </span>
            <span className="tabular-nums">{totalItems}</span>
            <span> · Page </span>
            <span className="tabular-nums">{page}</span>
            <span> of </span>
            <span className="tabular-nums">{totalPages}</span>
          </>
        )}
      </p>
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          >
            Prev
          </Button>
          {pages.map((item, idx) =>
            item === "ellipsis" ? (
              <span
                key={`e-${idx}`}
                className="px-1.5 text-muted-foreground"
                aria-hidden
              >
                …
              </span>
            ) : (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={item === page ? "secondary" : "outline"}
                className="min-w-9 px-2"
                disabled={loading}
                onClick={() => onPageChange(item)}
              >
                {item}
              </Button>
            )
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return debounced
}

export function AdminDashboardPage() {
  /** Tab order: denser / higher-volume surfaces first, pending agronomists last. */
  const [tab, setTab] = useState("observations")

  const [pending, setPending] = useState<
    { id: string; email: string; createdAt: string }[]
  >([])
  const [pendingLoading, setPendingLoading] = useState(true)

  const [obsPage, setObsPage] = useState(1)
  const [obs, setObs] = useState<
    {
      id: string
      symptomText: string
      field?: { name: string }
      isRemovedByModerator: boolean
    }[]
  >([])
  const [obsTotal, setObsTotal] = useState(0)
  const [obsLoading, setObsLoading] = useState(false)
  const [obsDetailOpen, setObsDetailOpen] = useState(false)
  const [obsDetailLoading, setObsDetailLoading] = useState(false)
  const [obsDetail, setObsDetail] = useState<AdminObservationDetail | null>(
    null
  )

  const [advisorySearch, setAdvisorySearch] = useState("")
  const debouncedAdvisoryQ = useDebounced(advisorySearch, 380)
  const [advisoryRows, setAdvisoryRows] = useState<
    {
      id: string
      title: string
      status: AdvisoryStatus
      category: string
      ownerEmail: string | null
    }[]
  >([])
  const [advisoryMeta, setAdvisoryMeta] = useState({ total: 0, page: 1 })
  const [advisoryLoading, setAdvisoryLoading] = useState(false)
  const [advisoryPage, setAdvisoryPage] = useState(1)
  const [selectedAdvisoryId, setSelectedAdvisoryId] = useState("")
  const [advisoryStatus, setAdvisoryStatus] =
    useState<AdvisoryStatus>("PUBLISHED")
  const [advisorySaving, setAdvisorySaving] = useState(false)

  const [userSearch, setUserSearch] = useState("")
  const debouncedUserQ = useDebounced(userSearch, 380)
  const [userRows, setUserRows] = useState<
    {
      id: string
      email: string
      role: string
      isActive: boolean
      agronomistVerified: boolean
    }[]
  >([])
  const [userMeta, setUserMeta] = useState({ total: 0, page: 1 })
  const [usersLoading, setUsersLoading] = useState(false)
  const [userPage, setUserPage] = useState(1)
  const [selectedUserId, setSelectedUserId] = useState("")
  const [accountActive, setAccountActive] = useState(true)
  const [accountSaving, setAccountSaving] = useState(false)

  const loadPending = () => {
    adminApi
      .pendingAgronomists()
      .then((r) => setPending(r.data))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
  }

  useEffect(() => {
    let cancelled = false
    setPendingLoading(true)
    adminApi
      .pendingAgronomists()
      .then((r) => {
        if (!cancelled) setPending(r.data)
      })
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Failed")
      })
      .finally(() => {
        if (!cancelled) setPendingLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadAdvisories = useCallback(() => {
    setAdvisoryLoading(true)
    adminApi
      .advisoriesList({
        page: advisoryPage,
        limit: ADMIN_ADV_PAGE_SIZE,
        q: debouncedAdvisoryQ,
      })
      .then((r) => {
        setAdvisoryRows(r.data)
        setAdvisoryMeta({ total: r.meta.total, page: r.meta.page })
        setSelectedAdvisoryId((cur) => {
          if (cur && r.data.some((a) => a.id === cur)) return cur
          return ""
        })
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
      .finally(() => setAdvisoryLoading(false))
  }, [advisoryPage, debouncedAdvisoryQ])

  useEffect(() => {
    if (tab !== "advisories") return
    loadAdvisories()
  }, [tab, loadAdvisories])

  useEffect(() => {
    setAdvisoryPage(1)
  }, [debouncedAdvisoryQ])

  const loadUsers = useCallback(() => {
    setUsersLoading(true)
    adminApi
      .usersList({
        page: userPage,
        limit: ADMIN_USER_PAGE_SIZE,
        q: debouncedUserQ,
      })
      .then((r) => {
        setUserRows(r.data)
        setUserMeta({ total: r.meta.total, page: r.meta.page })
        setSelectedUserId((cur) => {
          if (cur && r.data.some((u) => u.id === cur)) return cur
          return ""
        })
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
      .finally(() => setUsersLoading(false))
  }, [userPage, debouncedUserQ])

  useEffect(() => {
    if (tab !== "accounts") return
    loadUsers()
  }, [tab, loadUsers])

  useEffect(() => {
    setUserPage(1)
  }, [debouncedUserQ])

  useEffect(() => {
    const u = userRows.find((x) => x.id === selectedUserId)
    if (u) setAccountActive(u.isActive)
  }, [selectedUserId, userRows])

  useEffect(() => {
    if (tab !== "observations") return
    setObsLoading(true)
    adminApi
      .observations(obsPage, 10)
      .then((r) => {
        setObs(r.data)
        setObsTotal(r.meta.total)
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))
      .finally(() => setObsLoading(false))
  }, [tab, obsPage])

  async function verify(id: string) {
    try {
      await adminApi.patchUser(id, { agronomistVerified: true })
      toast.success("Agronomist verified")
      loadPending()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    }
  }

  async function toggleObs(id: string, removed: boolean) {
    try {
      await adminApi.patchObservation(id, !removed)
      toast.success("Updated")
      const r = await adminApi.observations(obsPage, 10)
      setObs(r.data)
      setObsTotal(r.meta.total)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    }
  }

  async function openObservationDetail(id: string) {
    setObsDetailOpen(true)
    setObsDetail(null)
    setObsDetailLoading(true)
    try {
      const d = await adminApi.observation(id)
      setObsDetail(d)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load observation")
      setObsDetailOpen(false)
    } finally {
      setObsDetailLoading(false)
    }
  }

  async function applyAdvisoryStatus(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedAdvisoryId) {
      toast.error("Choose an advisory from the list.")
      return
    }
    setAdvisorySaving(true)
    try {
      await adminApi.patchAdvisory(selectedAdvisoryId, {
        status: advisoryStatus,
      })
      toast.success("Advisory status updated")
      loadAdvisories()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed")
    } finally {
      setAdvisorySaving(false)
    }
  }

  async function applyAccountActive(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUserId) {
      toast.error("Choose a user from the list.")
      return
    }
    setAccountSaving(true)
    try {
      await adminApi.patchUser(selectedUserId, { isActive: accountActive })
      toast.success(accountActive ? "Account activated" : "Account deactivated")
      loadUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed")
    } finally {
      setAccountSaving(false)
    }
  }

  const selectedUser = userRows.find((u) => u.id === selectedUserId)

  const advisoryTotalPages = Math.max(
    1,
    Math.ceil(advisoryMeta.total / ADMIN_ADV_PAGE_SIZE) || 1
  )
  const userTotalPages = Math.max(
    1,
    Math.ceil(userMeta.total / ADMIN_USER_PAGE_SIZE) || 1
  )

  return (
    <RoleGate allow="ADMIN">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Moderate observations, manage accounts and advisory compliance, then
            verify new agronomists.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-muted/60 p-1">
            <TabsTrigger value="observations" className="text-xs sm:text-sm">
              Observations
            </TabsTrigger>
            <TabsTrigger value="accounts" className="text-xs sm:text-sm">
              User accounts
            </TabsTrigger>
            <TabsTrigger value="advisories" className="text-xs sm:text-sm">
              Advisory status
            </TabsTrigger>
            <TabsTrigger value="agronomists" className="text-xs sm:text-sm">
              Agronomists
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="agronomists"
            className="mt-0 space-y-4 outline-none"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pending agronomists</CardTitle>
                <CardDescription>
                  After you verify someone, they can publish advisories.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pendingLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : pending.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No one waiting right now.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Since</TableHead>
                        <TableHead className="w-[120px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pending.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>{u.email}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(u.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" onClick={() => verify(u.id)}>
                              Verify
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value="advisories"
            className="mt-0 space-y-4 outline-none"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Advisory status</CardTitle>
                <CardDescription>
                  Search by title or paste a UUID. Click a row to select an
                  advisory, choose a new status, then apply.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label htmlFor="adm-adv-search">Search</Label>
                    <Input
                      id="adm-adv-search"
                      placeholder="Title or advisory ID…"
                      value={advisorySearch}
                      onChange={(e) => setAdvisorySearch(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={advisoryLoading}
                    onClick={() => loadAdvisories()}
                  >
                    Refresh
                  </Button>
                </div>
                {advisoryLoading ? (
                  <Skeleton className="h-12 w-full" />
                ) : (
                  <form onSubmit={applyAdvisoryStatus} className="space-y-4">
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead className="whitespace-nowrap">
                              Category
                            </TableHead>
                            <TableHead className="whitespace-nowrap">
                              Status
                            </TableHead>
                            <TableHead>Owner</TableHead>
                            <TableHead className="hidden font-mono text-xs md:table-cell">
                              ID
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {advisoryRows.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="py-10 text-center text-sm text-muted-foreground"
                              >
                                No advisories match this search.
                              </TableCell>
                            </TableRow>
                          ) : (
                            advisoryRows.map((a) => (
                              <TableRow
                                key={a.id}
                                className={cn(
                                  "cursor-pointer",
                                  selectedAdvisoryId === a.id && "bg-muted/60"
                                )}
                                onClick={() => setSelectedAdvisoryId(a.id)}
                              >
                                <TableCell className="max-w-[220px] align-middle font-medium">
                                  <span className="line-clamp-2">
                                    {a.title}
                                  </span>
                                </TableCell>
                                <TableCell className="align-middle text-muted-foreground">
                                  {a.category}
                                </TableCell>
                                <TableCell className="align-middle">
                                  <Badge
                                    variant="secondary"
                                    className="font-normal"
                                  >
                                    {a.status === "DRAFT"
                                      ? "Draft"
                                      : a.status === "PUBLISHED"
                                        ? "Published"
                                        : "Archived"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="max-w-[180px] truncate align-middle text-muted-foreground">
                                  {a.ownerEmail ?? "—"}
                                </TableCell>
                                <TableCell className="hidden max-w-[140px] truncate align-middle font-mono text-xs md:table-cell">
                                  <span title={a.id}>{a.id}</span>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <AdminPagerBar
                      label="Advisories"
                      page={advisoryPage}
                      totalPages={advisoryTotalPages}
                      totalItems={advisoryMeta.total}
                      pageSize={ADMIN_ADV_PAGE_SIZE}
                      rowCount={advisoryRows.length}
                      loading={advisoryLoading}
                      onPageChange={setAdvisoryPage}
                    />
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div className="space-y-2 sm:max-w-xs">
                        <Label>New status</Label>
                        <Select
                          value={advisoryStatus}
                          onValueChange={(v) =>
                            setAdvisoryStatus(v as AdvisoryStatus)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DRAFT">Draft</SelectItem>
                            <SelectItem value="PUBLISHED">Published</SelectItem>
                            <SelectItem value="ARCHIVED">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="submit" disabled={advisorySaving}>
                        {advisorySaving ? "Saving…" : "Apply status"}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accounts" className="mt-0 space-y-4 outline-none">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">User accounts</CardTitle>
                <CardDescription>
                  Click a row to select a user. Sign-in is blocked when
                  inactive.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label htmlFor="adm-user-search">Search</Label>
                    <Input
                      id="adm-user-search"
                      placeholder="Email or user ID…"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={usersLoading}
                    onClick={() => loadUsers()}
                  >
                    Refresh
                  </Button>
                </div>
                {usersLoading ? (
                  <Skeleton className="h-12 w-full" />
                ) : (
                  <form onSubmit={applyAccountActive} className="space-y-4">
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead className="whitespace-nowrap">
                              Role
                            </TableHead>
                            <TableHead className="whitespace-nowrap">
                              Active
                            </TableHead>
                            <TableHead className="whitespace-nowrap">
                              Agronomist
                            </TableHead>
                            <TableHead className="hidden font-mono text-xs lg:table-cell">
                              ID
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userRows.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="py-10 text-center text-sm text-muted-foreground"
                              >
                                No users match this search.
                              </TableCell>
                            </TableRow>
                          ) : (
                            userRows.map((u) => (
                              <TableRow
                                key={u.id}
                                className={cn(
                                  "cursor-pointer",
                                  selectedUserId === u.id && "bg-muted/60"
                                )}
                                onClick={() => setSelectedUserId(u.id)}
                              >
                                <TableCell className="max-w-[200px] align-middle font-medium">
                                  <span className="truncate">{u.email}</span>
                                </TableCell>
                                <TableCell className="align-middle">
                                  <Badge
                                    variant="outline"
                                    className="font-normal"
                                  >
                                    {u.role}
                                  </Badge>
                                </TableCell>
                                <TableCell className="align-middle">
                                  {u.isActive ? (
                                    <span className="text-emerald-600 dark:text-emerald-400">
                                      Yes
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      No
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="align-middle text-muted-foreground">
                                  {u.agronomistVerified ? "Verified" : "—"}
                                </TableCell>
                                <TableCell className="hidden max-w-[140px] truncate align-middle font-mono text-xs lg:table-cell">
                                  <span title={u.id}>{u.id}</span>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <AdminPagerBar
                      label="Accounts"
                      page={userPage}
                      totalPages={userTotalPages}
                      totalItems={userMeta.total}
                      pageSize={ADMIN_USER_PAGE_SIZE}
                      rowCount={userRows.length}
                      loading={usersLoading}
                      onPageChange={setUserPage}
                    />
                    {selectedUser && (
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{selectedUser.id}</span>
                        <span>·</span>
                        <span>
                          Agronomist verified:{" "}
                          {selectedUser.agronomistVerified ? "yes" : "no"}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                        <input
                          id="adm-active"
                          type="checkbox"
                          checked={accountActive}
                          onChange={(e) => setAccountActive(e.target.checked)}
                          className="size-4 rounded border"
                        />
                        <Label htmlFor="adm-active" className="font-normal">
                          Account active
                        </Label>
                      </div>
                    </div>
                    <Button type="submit" disabled={accountSaving}>
                      {accountSaving ? "Saving…" : "Save account"}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value="observations"
            className="mt-0 space-y-4 outline-none"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Observations (moderation)
                </CardTitle>
                <CardDescription>
                  Hide anything that shouldn&apos;t show up for farmers on their
                  fields. Click a row to open full text, metadata, and photos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {obsLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Field</TableHead>
                          <TableHead>Snippet</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[140px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {obs.map((o) => (
                          <TableRow
                            key={o.id}
                            className="cursor-pointer hover:bg-muted/50"
                            tabIndex={0}
                            onClick={() => openObservationDetail(o.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                openObservationDetail(o.id)
                              }
                            }}
                          >
                            <TableCell className="text-sm">
                              {o.field?.name ?? "—"}
                            </TableCell>
                            <TableCell className="max-w-md truncate text-sm">
                              {o.symptomText}
                            </TableCell>
                            <TableCell>
                              {o.isRemovedByModerator ? (
                                <Badge variant="destructive">Hidden</Badge>
                              ) : (
                                <Badge variant="secondary">Visible</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleObs(o.id, o.isRemovedByModerator)
                                }}
                              >
                                {o.isRemovedByModerator ? "Restore" : "Hide"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-4 flex justify-between text-xs text-muted-foreground">
                      <span>{obsTotal} total</span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={obsPage <= 1}
                          onClick={() => setObsPage((p) => Math.max(1, p - 1))}
                        >
                          Prev
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={obsPage * 10 >= obsTotal}
                          onClick={() => setObsPage((p) => p + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog
          open={obsDetailOpen}
          onOpenChange={(open) => {
            setObsDetailOpen(open)
            if (!open) setObsDetail(null)
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-lg gap-4 overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Observation detail</DialogTitle>
              <DialogDescription>
                Review full content before hiding from farmers.
              </DialogDescription>
            </DialogHeader>
            {obsDetailLoading ? (
              <Skeleton className="h-36 w-full" />
            ) : obsDetail ? (
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{obsDetail.severity}</Badge>
                  {obsDetail.isRemovedByModerator ? (
                    <Badge variant="destructive">Hidden from farmers</Badge>
                  ) : (
                    <Badge variant="secondary">Visible to farmers</Badge>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Field</p>
                  <p>
                    {obsDetail.field?.name ?? "—"}
                    {obsDetail.field?.farmerEmail ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {obsDetail.field.farmerEmail}
                      </span>
                    ) : null}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    Field {obsDetail.fieldId} · Observation {obsDetail.id}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Observed</p>
                  <p className="text-muted-foreground">
                    {new Date(obsDetail.observedAt).toLocaleString()} · logged{" "}
                    {new Date(obsDetail.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Notes</p>
                  <p className="rounded-xl bg-muted/40 px-3 py-2 break-words whitespace-pre-wrap">
                    {obsDetail.symptomText}
                  </p>
                </div>
                {obsDetail.media.length > 0 ? (
                  <div className="space-y-2">
                    <p className="font-medium text-foreground">Attachments</p>
                    <div className="flex flex-col gap-3">
                      {obsDetail.media.map((m) => (
                        <div key={m.id} className="space-y-1">
                          {isImageMime(m.mimeType) ? (
                            <a
                              href={mediaUrl(m.url)}
                              target="_blank"
                              rel="noreferrer"
                              className="block"
                            >
                              <img
                                src={mediaUrl(m.url)}
                                alt={m.filename}
                                className="max-h-52 w-auto max-w-full rounded-lg border object-contain"
                              />
                            </a>
                          ) : (
                            <a
                              href={mediaUrl(m.url)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary underline underline-offset-4"
                            >
                              {m.filename}
                            </a>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {m.mimeType ?? "unknown type"} ·{" "}
                            {(m.sizeBytes / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </RoleGate>
  )
}
