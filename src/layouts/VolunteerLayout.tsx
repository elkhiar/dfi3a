import { CalendarDays, Home, Search, Trophy, UserRound } from 'lucide-react'
import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'

const navigation = [
  { label: 'Accueil', to: '/', icon: Home },
  { label: 'Explorer', to: '/explore', icon: Search },
  { label: 'Événements', to: '/events', icon: CalendarDays },
  { label: 'Classement', to: '/leaderboard', icon: Trophy },
  { label: 'Profil', to: '/profile', icon: UserRound },
]

export function VolunteerLayout() {
  const {
    accountType,
    accountTypeError,
    isAccountTypeLoading,
    isLoading: isAuthLoading,
    retryAccountType,
    user,
  } = useAuth()

  if (isAuthLoading || (user && isAccountTypeLoading)) {
    return <LoadingScreen />
  }
  if (user && accountTypeError) {
    return <RoleError onRetry={retryAccountType} />
  }
  if (accountType === 'ngo') return <Navigate replace to="/ngo/dashboard" />
  if (accountType === 'admin') return <Navigate replace to="/admin" />

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-white text-slate-950 shadow-sm">
      <main className="min-h-dvh px-4 pb-32 pt-5">
        <Outlet />
      </main>

      <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-[18px] bg-sky-300 px-1 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 min-[380px]:px-5">
        <ul className="flex items-center justify-between gap-0 rounded-full border-[5px] border-slate-500 bg-slate-700 p-1.5 shadow-sm min-[380px]:gap-1">
          {navigation.map(({ label, to, icon: Icon }) => (
            <li className="min-w-0 shrink-0" key={to}>
              <NavLink
                aria-label={label}
                className={({ isActive }) => `flex min-h-11 items-center justify-center gap-1 rounded-full text-xs font-semibold transition-all ${isActive ? 'w-[98px] bg-slate-500 px-1 text-sky-300 min-[380px]:w-[106px]' : 'w-11 text-sky-300 hover:bg-slate-600'}`}
                end={to === '/'}
                to={to}
              >
                {({ isActive }) => (
                  <>
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-sky-300 text-slate-700"><Icon aria-hidden="true" size={18} strokeWidth={2.5} /></span>
                    {isActive && <span className="truncate">{label}</span>}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
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
