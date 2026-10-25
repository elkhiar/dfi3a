import { CalendarDays, Home, MessageCircle, Plus, Trophy, UserRound } from 'lucide-react'
import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'

const navigation = [
  { label: 'Accueil', to: '/ngo/dashboard', icon: Home },
  { label: 'Missions', to: '/ngo/missions', icon: CalendarDays },
  { label: 'Publier', to: '/ngo/missions/new', icon: Plus, primary: true },
  { label: 'Messages', to: '/ngo/messages', icon: MessageCircle },
  { label: 'Classement', to: '/ngo/leaderboard', icon: Trophy, desktopOnly: true },
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
    <div className="min-h-dvh bg-slate-100 text-slate-950 lg:bg-[#f4f7fa]">
      <div className="mx-auto min-h-dvh w-full max-w-md bg-slate-50 shadow-sm lg:grid lg:max-w-[1600px] lg:grid-cols-[270px_minmax(0,1fr)] lg:bg-transparent lg:shadow-none">
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-slate-200 bg-slate-900 px-5 py-7 text-white lg:flex">
          <img alt="DFI3A" className="h-12 w-[124px] brightness-0 invert" src="/dfi3a-logo.svg" />
          <div className="mt-5 rounded-2xl bg-white/7 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-300">Espace association</p><p className="mt-1 text-sm font-semibold text-white/90">Pilotez vos missions</p></div>
          <nav aria-label="Navigation ONG desktop" className="mt-7">
            <ul className="space-y-1.5">
              {navigation.map(({ icon: Icon, label, primary, to }) => <li key={to}><NavLink className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-2xl px-3.5 text-sm font-semibold transition ${primary ? 'bg-sky-500 text-white hover:bg-sky-400' : isActive ? 'bg-white/12 text-white' : 'text-slate-400 hover:bg-white/7 hover:text-white'}`} to={to}><span className={`grid size-9 place-items-center rounded-xl ${primary ? 'bg-white/15' : 'bg-white/7'}`}><Icon aria-hidden="true" size={19} /></span>{label}</NavLink></li>)}
            </ul>
          </nav>
          <div className="mt-auto rounded-[22px] border border-white/10 bg-white/5 p-4"><p className="text-xs font-semibold text-sky-300">Besoin d’aide ?</p><p className="mt-1 text-xs leading-5 text-slate-400">Retrouvez vos outils et gérez votre communauté depuis un seul espace.</p></div>
        </aside>
        <main className="min-h-dvh px-4 pb-28 pt-5 lg:min-w-0 lg:px-10 lg:pb-12 lg:pt-8 xl:px-14"><Outlet /></main>
      </div>
      <nav aria-label="Navigation ONG" className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 transform-gpu border-t border-slate-100 bg-white/95 px-2 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden">
        <ul className="grid grid-cols-5 items-end gap-1">
          {navigation.filter((item) => !item.desktopOnly).map(({ icon: Icon, label, primary, to }) => (
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
