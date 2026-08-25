import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminPage } from './pages/AdminPage'
import { VolunteerLayout } from './layouts/VolunteerLayout'
import { NgoLayout } from './layouts/NgoLayout'
import { ExplorePage } from './pages/ExplorePage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { AuthPage } from './pages/AuthPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { HomePage } from './pages/HomePage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { MyEventsPage } from './pages/MyEventsPage'
import { MissionDetailsPage } from './pages/MissionDetailsPage'
import { NgoApplyPage } from './pages/NgoApplyPage'
import { NgoDashboardPage } from './pages/NgoDashboardPage'
import { NgoMissionCreatePage } from './pages/NgoMissionCreatePage'
import { NgoMissionEditPage } from './pages/NgoMissionEditPage'
import { NgoMissionsPage } from './pages/NgoMissionsPage'
import { NgoProfilePage } from './pages/NgoProfilePage'
import { NgoAttendancePage } from './pages/NgoAttendancePage'
import { ProfilePage } from './pages/ProfilePage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'

export default function App() {
  return (
    <Routes>
      <Route element={<VolunteerLayout />}>
        <Route index element={<HomePage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="events" element={<MyEventsPage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="auth" element={<AuthPage />} />
      <Route path="auth/callback" element={<AuthCallbackPage />} />
      <Route path="auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="auth/reset-password" element={<ResetPasswordPage />} />
      <Route path="missions/:missionId" element={<MissionDetailsPage />} />
      <Route path="ngo/apply" element={<NgoApplyPage />} />
      <Route element={<NgoLayout />}>
        <Route path="ngo/dashboard" element={<NgoDashboardPage />} />
        <Route path="ngo/missions" element={<NgoMissionsPage />} />
        <Route path="ngo/leaderboard" element={<LeaderboardPage />} />
        <Route path="ngo/profile" element={<NgoProfilePage />} />
      </Route>
      <Route path="ngo/missions/new" element={<NgoMissionCreatePage />} />
      <Route path="ngo/missions/:missionId/edit" element={<NgoMissionEditPage />} />
      <Route path="ngo/missions/:missionId/attendance" element={<NgoAttendancePage />} />
      <Route path="admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  )
}
