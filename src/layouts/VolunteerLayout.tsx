import {
  CalendarDays,
  Home,
  Search,
  Trophy,
  UserRound,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { getMyAccountType } from '../services/ngos'

const navigation = [
  { label: 'Accueil', to: '/', icon: Home },
  { label: 'Explorer', to: '/explore', icon: Search },
  { label: 'Événements', to: '/events', icon: CalendarDays },
  { label: 'Classement', to: '/leaderboard', icon: Trophy },
  { label: 'Profil', to: '/profile', icon: UserRound },
]

export function VolunteerLayout() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const [role, setRole] = useState<{ accountType: 'volunteer' | 'ngo' | 'admin' | null; userId: string }>({ accountType: null, userId: '' })

  useEffect(() => {
    let isCurrent = true
    if (!user) return

    void getMyAccountType()
      .then((accountType) => { if (isCurrent) setRole({ accountType, userId: user.id }) })
    return () => { isCurrent = false }
  }, [user])

  if (isAuthLoading || (user && role.userId !== user.id)) {
    return <main className="grid min-h-dvh place-items-center bg-white"><span className="size-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></main>
  }
  const accountType = user ? role.accountType : null
  if (accountType === 'ngo') return <Navigate replace to="/ngo/dashboard" />
  if (accountType === 'admin') return <Navigate replace to="/admin" />

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-white text-slate-950 shadow-sm">
      <main className="min-h-dvh px-4 pb-32 pt-5">
        <Outlet />
      </main>

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-[18px] bg-sky-300 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
      >
        <ul className="flex items-center justify-between gap-1 rounded-full border-[5px] border-slate-500 bg-slate-700 p-1.5 shadow-sm">
          {navigation.map(({ label, to, icon: Icon }) => (
            <li className="shrink-0" key={to}>
              <NavLink
                aria-label={label}
                className={({ isActive }) =>
                  `flex min-h-11 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-all ${
                    isActive
                      ? 'w-[106px] bg-slate-500 px-2 text-sky-300'
                      : 'w-11 text-slate-800 hover:bg-slate-600'
                  }`
                }
                end={to === '/'}
                to={to}
              >
                {({ isActive }) => (
                  <>
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-sky-300 text-slate-700">
                      <Icon aria-hidden="true" size={18} strokeWidth={2.5} />
                    </span>
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
