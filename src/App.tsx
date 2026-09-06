import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { VolunteerLayout } from './layouts/VolunteerLayout'
import { NgoLayout } from './layouts/NgoLayout'

const AdminPage = lazy(() => import('./pages/AdminPage').then((module) => ({ default: module.AdminPage })))
const ExplorePage = lazy(() => import('./pages/ExplorePage').then((module) => ({ default: module.ExplorePage })))
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage').then((module) => ({ default: module.AuthCallbackPage })))
const AuthPage = lazy(() => import('./pages/AuthPage').then((module) => ({ default: module.AuthPage })))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then((module) => ({ default: module.ForgotPasswordPage })))
const FollowedNgosPage = lazy(() => import('./pages/FollowedNgosPage').then((module) => ({ default: module.FollowedNgosPage })))
const FriendsPage = lazy(() => import('./pages/FriendsPage').then((module) => ({ default: module.FriendsPage })))
const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })))
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage').then((module) => ({ default: module.LeaderboardPage })))
const MyEventsPage = lazy(() => import('./pages/MyEventsPage').then((module) => ({ default: module.MyEventsPage })))
const MissionDetailsPage = lazy(() => import('./pages/MissionDetailsPage').then((module) => ({ default: module.MissionDetailsPage })))
const MissionChatPage = lazy(() => import('./pages/MissionChatPage').then((module) => ({ default: module.MissionChatPage })))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((module) => ({ default: module.NotificationsPage })))
const NgoApplyPage = lazy(() => import('./pages/NgoApplyPage').then((module) => ({ default: module.NgoApplyPage })))
const NgoDashboardPage = lazy(() => import('./pages/NgoDashboardPage').then((module) => ({ default: module.NgoDashboardPage })))
const NgoMissionCreatePage = lazy(() => import('./pages/NgoMissionCreatePage').then((module) => ({ default: module.NgoMissionCreatePage })))
const NgoMissionEditPage = lazy(() => import('./pages/NgoMissionEditPage').then((module) => ({ default: module.NgoMissionEditPage })))
const NgoMissionsPage = lazy(() => import('./pages/NgoMissionsPage').then((module) => ({ default: module.NgoMissionsPage })))
const NgoProfilePage = lazy(() => import('./pages/NgoProfilePage').then((module) => ({ default: module.NgoProfilePage })))
const NgoPublicProfilePage = lazy(() => import('./pages/NgoPublicProfilePage').then((module) => ({ default: module.NgoPublicProfilePage })))
const NgoAttendancePage = lazy(() => import('./pages/NgoAttendancePage').then((module) => ({ default: module.NgoAttendancePage })))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then((module) => ({ default: module.OnboardingPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })))
const VolunteerPublicProfilePage = lazy(() => import('./pages/VolunteerPublicProfilePage').then((module) => ({ default: module.VolunteerPublicProfilePage })))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })))

export default function App() {
  const location = useLocation()
  const isOnboardingExempt = location.pathname === '/onboarding' || location.pathname.startsWith('/auth')
  let hasCompletedOnboarding = false
  try {
    hasCompletedOnboarding = window.localStorage.getItem('dfi3a:onboarding:v1') === 'completed'
  } catch {
    hasCompletedOnboarding = true
  }

  if (!hasCompletedOnboarding && !isOnboardingExempt) {
    return <Navigate replace state={{ returnTo: `${location.pathname}${location.search}${location.hash}` }} to="/onboarding" />
  }

  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center bg-white"><span className="size-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></main>}>
    <Routes>
      <Route element={<VolunteerLayout />}>
        <Route index element={<HomePage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="events" element={<MyEventsPage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="following" element={<FollowedNgosPage />} />
        <Route path="friends" element={<FriendsPage />} />
        <Route path="ngos/:ngoId" element={<NgoPublicProfilePage />} />
        <Route path="users/:userId" element={<VolunteerPublicProfilePage />} />
      </Route>
      <Route path="auth" element={<AuthPage />} />
      <Route path="auth/callback" element={<AuthCallbackPage />} />
      <Route path="auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="auth/reset-password" element={<ResetPasswordPage />} />
      <Route path="onboarding" element={<OnboardingPage />} />
      <Route path="missions/:missionId" element={<MissionDetailsPage />} />
      <Route path="missions/:missionId/chat" element={<MissionChatPage />} />
      <Route path="notifications" element={<NotificationsPage />} />
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
    </Suspense>
  )
}
