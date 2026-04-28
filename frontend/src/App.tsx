import { lazy } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AppShell } from "@/components/layout/app-shell"

const HomePage = lazy(() =>
  import("@/pages/home").then((m) => ({ default: m.HomePage }))
)
const LoginPage = lazy(() =>
  import("@/pages/login").then((m) => ({ default: m.LoginPage }))
)
const RegisterPage = lazy(() =>
  import("@/pages/register").then((m) => ({ default: m.RegisterPage }))
)
const AdvisoryBrowsePage = lazy(() =>
  import("@/pages/advisory-browse").then((m) => ({
    default: m.AdvisoryBrowsePage,
  }))
)
const AdvisoryDetailPage = lazy(() =>
  import("@/pages/advisory-detail").then((m) => ({
    default: m.AdvisoryDetailPage,
  }))
)
const FarmerDashboardPage = lazy(() =>
  import("@/pages/farmer-dashboard").then((m) => ({
    default: m.FarmerDashboardPage,
  }))
)
const FieldDetailPage = lazy(() =>
  import("@/pages/field-detail").then((m) => ({ default: m.FieldDetailPage }))
)
const AgronomistDashboardPage = lazy(() =>
  import("@/pages/agronomist-dashboard").then((m) => ({
    default: m.AgronomistDashboardPage,
  }))
)
const AdvisoryEditorPage = lazy(() =>
  import("@/pages/advisory-editor").then((m) => ({
    default: m.AdvisoryEditorPage,
  }))
)
const AdminDashboardPage = lazy(() =>
  import("@/pages/admin-dashboard").then((m) => ({
    default: m.AdminDashboardPage,
  }))
)

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/advisories" element={<AdvisoryBrowsePage />} />
          <Route path="/advisories/:id" element={<AdvisoryDetailPage />} />
          <Route path="/farmer" element={<FarmerDashboardPage />} />
          <Route path="/farmer/fields/:id" element={<FieldDetailPage />} />
          <Route path="/agronomist" element={<AgronomistDashboardPage />} />
          <Route
            path="/agronomist/advisories/new"
            element={<AdvisoryEditorPage />}
          />
          <Route
            path="/agronomist/advisories/:id"
            element={<AdvisoryEditorPage />}
          />
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
