import { Bell, CalendarDays, Home, LogIn, MessageCircle, Search, Trophy, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { APP_TOUR_STORAGE_KEY, AppTour } from '../components/AppTour'

const navigation = [
  { label: 'Accueil', to: '/', icon: Home },
  { label: 'Explorer', to: '/explore', icon: Search },
  { label: 'Événements', to: '/events', icon: CalendarDays },
  { label: 'Messages', to: '/messages', icon: MessageCircle },
  { label: 'Classement', to: '/leaderboard', icon: Trophy },
  { label: 'Profil', to: '/profile', icon: UserRound },
]

export function VolunteerLayout() {
  const location = useLocation()
  const [isTourOpen, setIsTourOpen] = useState(() => {
    try {
      return location.pathname === '/' && window.localStorage.getItem(APP_TOUR_STORAGE_KEY) !== 'completed'
    } catch {
      return false
    }
  })
  const {
    accountType,
    accountTypeError,
    isAccountTypeLoading,
    isLoading: isAuthLoading,
    retryAccountType,
    user,
  } = useAuth()

  const completeTour = () => {
    try {
      window.localStorage.setItem(APP_TOUR_STORAGE_KEY, 'completed')
    } catch {
      // Closing the tutorial must work even when storage is unavailable.
    }
    setIsTourOpen(false)
  }

  if (isAuthLoading || (user && isAccountTypeLoading)) {
    return <LoadingScreen />
  }
  if (user && accountTypeError) {
    return <RoleError onRetry={retryAccountType} />
  }
  if (accountType === 'ngo') return <Navigate replace to="/ngo/dashboard" />
  if (accountType === 'admin') return <Navigate replace to="/admin" />
  if (!user && location.pathname === '/') {
    return <main className="min-h-dvh bg-white text-slate-950"><Outlet /></main>
  }

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-950 lg:bg-[#f4f7fa]">
      <div className="mx-auto min-h-dvh w-full max-w-md bg-white shadow-sm lg:grid lg:max-w-[1600px] lg:grid-cols-[260px_minmax(0,1fr)] lg:bg-transparent lg:shadow-none">
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-slate-200 bg-white px-5 py-7 lg:flex">
          <Link className="inline-flex w-fit rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-500" to="/">
            <img alt="DFI3A" className="h-12 w-[124px] object-contain object-left" src="/dfi3a-logo.svg" />
          </Link>
          <p className="mt-3 text-xs leading-5 text-slate-400">Le volontariat, simplement.</p>

          <nav aria-label="Navigation principale desktop" className="mt-9">
            <ul className="space-y-1.5">
              {navigation.map(({ label, to, icon: Icon }) => (
                <li key={to}>
                  <NavLink className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-2xl px-3.5 text-sm font-semibold transition ${isActive ? 'bg-sky-50 text-sky-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`} end={to === '/'} to={to}>
                    <span className="grid size-9 place-items-center rounded-xl bg-white shadow-sm"><Icon aria-hidden="true" size={19} strokeWidth={2.2} /></span>
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-auto space-y-3">
            <NavLink className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-2xl px-3.5 text-sm font-semibold ${isActive ? 'bg-sky-50 text-sky-700' : 'text-slate-500 hover:bg-slate-50'}`} to="/notifications"><Bell aria-hidden="true" size={19} />Notifications</NavLink>
            {user ? (
              <NavLink className="flex items-center gap-3 rounded-[20px] border border-slate-200 bg-slate-50 p-3 transition hover:border-sky-200" to="/profile">
                <span className="grid size-10 place-items-center rounded-full bg-slate-700 text-sm font-bold text-sky-300">{String(user.user_metadata?.first_name || user.email || 'D').slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0"><strong className="block truncate text-sm">{user.user_metadata?.first_name || 'Mon profil'}</strong><span className="block truncate text-[11px] text-slate-400">{user.email}</span></span>
              </NavLink>
            ) : (
              <NavLink className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-bold text-white hover:bg-slate-800" to="/auth?mode=login&returnTo=%2F"><LogIn aria-hidden="true" size={18} />Se connecter</NavLink>
            )}
          </div>
        </aside>

        <main className="min-h-dvh px-4 pb-32 pt-5 lg:min-w-0 lg:px-10 lg:pb-12 lg:pt-8 xl:px-14">
          <Outlet />
        </main>
      </div>

      <nav aria-label="Navigation principale" className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 transform-gpu rounded-t-[18px] bg-sky-300 px-1 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] min-[380px]:px-5 lg:hidden" data-tour="main-navigation">
        <ul className="flex items-center justify-between gap-0 rounded-full border-[5px] border-slate-500 bg-slate-700 p-1.5 shadow-sm min-[380px]:gap-1">
          {navigation.map(({ label, to, icon: Icon }) => (
            <li className="min-w-0 shrink-0" key={to}>
              <NavLink
                aria-label={label}
                className={({ isActive }) => `flex min-h-11 items-center justify-center gap-1 rounded-full text-xs font-semibold transition-all ${isActive ? 'w-[108px] bg-slate-500 px-1.5 text-sky-300 min-[380px]:w-[116px]' : 'w-9 min-[380px]:w-10 text-sky-300 hover:bg-slate-600'}`}
                end={to === '/'}
                to={to}
              >
                {({ isActive }) => (
                  <>
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-sky-300 text-slate-700"><Icon aria-hidden="true" size={18} strokeWidth={2.5} /></span>
                    {isActive && <span className="whitespace-nowrap">{label}</span>}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {isTourOpen && <AppTour onComplete={completeTour} />}
    </div>
  )
}

function LoadingScreen() {
  return <main className="grid min-h-dvh place-items-center bg-white"><span className="size-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></main>
}

function RoleError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-white p-6 text-center">
      <div>
        <h1 className="text-xl font-bold">Impossible de vérifier votre compte</h1>
        <p className="mt-2 text-sm text-slate-500">Vérifiez votre connexion puis réessayez.</p>
        <button className="mt-5 min-h-11 rounded-full bg-sky-500 px-5 text-sm font-bold text-white" onClick={onRetry} type="button">Réessayer</button>
      </div>
    </main>
  )
}
