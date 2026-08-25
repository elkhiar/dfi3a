import { CalendarDays, Home, Plus, Trophy, UserRound } from 'lucide-react'
import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'

const navigation = [
  { label: 'Accueil', to: '/ngo/dashboard', icon: Home },
  { label: 'Missions', to: '/ngo/missions', icon: CalendarDays },
  { label: 'Publier', to: '/ngo/missions/new', icon: Plus, primary: true },
  { label: 'Classement', to: '/ngo/leaderboard', icon: Trophy },
  { label: 'Profil', to: '/ngo/profile', icon: UserRound },
]

export function NgoLayout() {
  const { accountType, accountTypeError, isAccountTypeLoading, isLoading: isAuthLoading, retryAccountType, user } = useAuth()

  if (isAuthLoading || (user && isAccountTypeLoading)) {
    return <main className="grid min-h-dvh place-items-center bg-white"><span className="size-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></main>
  }
  if (!user) return <Navigate replace to="/auth?mode=login&returnTo=%2Fngo%2Fdashboard" />
  if (accountTypeError) return <main className="grid min-h-dvh place-items-center bg-white p-6 text-center"><div><h1 className="text-xl font-bold">Impossible de vérifier votre compte</h1><p className="mt-2 text-sm text-slate-500">Vérifiez votre connexion puis réessayez.</p><button className="mt-5 min-h-11 rounded-full bg-sky-500 px-5 text-sm font-bold text-white" onClick={retryAccountType} type="button">Réessayer</button></div></main>
  if (accountType === 'admin') return <Navigate replace to="/admin" />
  if (accountType !== 'ngo') return <Navigate replace to="/" />

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-slate-50 text-slate-950 shadow-sm">
      <main className="min-h-dvh px-4 pb-32 pt-5"><Outlet /></main>
      <nav aria-label="Navigation ONG" className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-[18px] bg-sky-300 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <ul className="flex items-center justify-between gap-1 rounded-full border-[5px] border-slate-500 bg-slate-700 p-1.5 shadow-sm">
          {navigation.map(({ icon: Icon, label, primary, to }) => (
            <li className="shrink-0" key={to}>
              <NavLink aria-label={label} className={({ isActive }) => primary
                ? 'grid size-12 -translate-y-2 place-items-center rounded-full bg-sky-300 text-slate-700 shadow-md ring-4 ring-slate-700'
                : `grid size-11 place-items-center rounded-full transition ${isActive ? 'bg-slate-500 text-sky-300' : 'text-sky-300'}`
              } to={to}>
                <Icon aria-hidden="true" size={primary ? 25 : 20} strokeWidth={2.5} />
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
