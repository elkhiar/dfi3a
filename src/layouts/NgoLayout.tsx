import { CalendarDays, Home, MessageCircle, Plus, UserRound } from 'lucide-react'
import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'

const navigation = [
  { label: 'Accueil', to: '/ngo/dashboard', icon: Home },
  { label: 'Missions', to: '/ngo/missions', icon: CalendarDays },
  { label: 'Publier', to: '/ngo/missions/new', icon: Plus, primary: true },
  { label: 'Messages', to: '/ngo/messages', icon: MessageCircle },
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
      <main className="min-h-dvh px-4 pb-28 pt-5"><Outlet /></main>
      <nav aria-label="Navigation ONG" className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md border-t border-slate-100 bg-white/95 px-2 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <ul className="grid grid-cols-5 items-end gap-1">
          {navigation.map(({ icon: Icon, label, primary, to }) => (
            <li className="min-w-0" key={to}>
              <NavLink aria-label={label} className={({ isActive }) => primary
                ? 'mx-auto flex w-full -translate-y-2 flex-col items-center gap-1 text-[9px] font-bold text-sky-600'
                : `flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-2xl text-[9px] font-semibold transition ${isActive ? 'bg-sky-50 text-sky-600' : 'text-slate-400'}`
              } to={to}>
                {primary ? <span className="grid size-12 place-items-center rounded-full bg-sky-500 text-white shadow-lg shadow-sky-200"><Icon aria-hidden="true" size={25} strokeWidth={2.5} /></span> : <Icon aria-hidden="true" size={20} strokeWidth={2.3} />}
                <span className="truncate">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
