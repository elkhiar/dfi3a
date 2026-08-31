import {
  Dumbbell,
  GraduationCap,
  HandHeart,
  HeartPulse,
  Leaf,
  Palette,
  PawPrint,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { DBuxAmount } from '../components/DBuxIcon'
import { MissionCard } from '../components/MissionCard'
import { NotificationBell } from '../components/NotificationBell'
import {
  getMySavedMissionIds,
  getPublicMissions,
  setMissionSaved,
} from '../services/missions'
import { getAvatarPublicUrl, getMyPointsSummary, getMyProfile } from '../services/profiles'
import type { Mission } from '../types/mission'

type TimeFilter = 'upcoming' | 'today' | 'tomorrow' | 'weekend'

const timeFilters: Array<{ id: TimeFilter; label: string }> = [
  { id: 'upcoming', label: 'À venir' },
  { id: 'today', label: "Aujourd’hui" },
  { id: 'tomorrow', label: 'Demain' },
  { id: 'weekend', label: 'Week-end' },
]

const preferredCategories = ['Santé', 'Environnement', 'Éducation', 'Culture et patrimoine']

function moroccoDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Casablanca',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function matchesTimeFilter(mission: Mission, filter: TimeFilter, todayKey: string) {
  if (filter === 'upcoming') return true
  const missionKey = moroccoDateKey(new Date(mission.startsAt))
  if (filter === 'today') return missionKey === todayKey
  if (filter === 'tomorrow') return missionKey === addDays(todayKey, 1)

  const day = new Date(`${missionKey}T12:00:00Z`).getUTCDay()
  return missionKey >= todayKey && missionKey <= addDays(todayKey, 7) && (day === 0 || day === 6)
}

function categoryIcon(category: string) {
  const normalized = category.toLocaleLowerCase('fr')
  if (normalized.includes('sant')) return HeartPulse
  if (normalized.includes('environnement')) return Leaf
  if (normalized.includes('éduc') || normalized.includes('educ')) return GraduationCap
  if (normalized.includes('culture')) return Palette
  if (normalized.includes('sport')) return Dumbbell
  if (normalized.includes('animal')) return PawPrint
  if (normalized.includes('social') || normalized.includes('solidar')) return HandHeart
  return Sparkles
}

export function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [activeCategory, setActiveCategory] = useState('Tout')
  const [activeTimeFilter, setActiveTimeFilter] = useState<TimeFilter>('upcoming')
  const [missions, setMissions] = useState<Mission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [savedMissionIds, setSavedMissionIds] = useState<Set<string>>(new Set())
  const [totalPoints, setTotalPoints] = useState(0)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true
    void getPublicMissions()
      .then((nextMissions) => {
        if (isCurrent) setMissions(nextMissions)
      })
      .catch(() => {
        if (isCurrent) setLoadError(true)
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })
    return () => { isCurrent = false }
  }, [loadAttempt])

  useEffect(() => {
    if (!user) return
    let isCurrent = true
    void getMySavedMissionIds().then((ids) => { if (isCurrent) setSavedMissionIds(ids) }).catch(() => undefined)
    void getMyPointsSummary()
      .then((summary) => { if (isCurrent) setTotalPoints(summary.totalPoints) })
      .catch(() => { if (isCurrent) setTotalPoints(0) })
    void getMyProfile()
      .then((profile) => { if (isCurrent) setAvatarUrl(getAvatarPublicUrl(profile.avatarPath)) })
      .catch(() => { if (isCurrent) setAvatarUrl(null) })
    return () => { isCurrent = false }
  }, [user])

  const timeFilteredMissions = useMemo(() => {
    const todayKey = moroccoDateKey(new Date())
    return missions.filter((mission) => matchesTimeFilter(mission, activeTimeFilter, todayKey))
  }, [activeTimeFilter, missions])

  const homeCategories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const mission of timeFilteredMissions.filter((item) => !item.isUrgent)) {
      counts.set(mission.category, (counts.get(mission.category) ?? 0) + 1)
    }
    const remaining = Array.from(counts.keys())
      .filter((name) => !preferredCategories.includes(name))
      .sort((first, second) => first.localeCompare(second, 'fr'))
    return ['Tout', ...preferredCategories.filter((name) => counts.has(name)), ...remaining]
  }, [timeFilteredMissions])

  const urgentMissions = timeFilteredMissions.filter((mission) => mission.isUrgent).slice(0, 6)
  const visibleMissions = timeFilteredMissions
    .filter((mission) => !mission.isUrgent && (activeCategory === 'Tout' || mission.category === activeCategory))
    .slice(0, 12)

  const updateSaved = async (mission: Mission, saved: boolean) => {
    if (!user) {
      navigate(`/auth?mode=login&returnTo=${encodeURIComponent('/')}`)
      return
    }
    if (!mission.databaseId) return

    setSavedMissionIds((current) => {
      const next = new Set(current)
      if (saved) next.add(mission.databaseId!)
      else next.delete(mission.databaseId!)
      return next
    })

    try {
      await setMissionSaved(mission.databaseId, saved)
    } catch {
      setSavedMissionIds((current) => {
        const next = new Set(current)
        if (saved) next.delete(mission.databaseId!)
        else next.add(mission.databaseId!)
        return next
      })
    }
  }

  const savedProps = (mission: Mission) => ({
    isSaved: Boolean(user) && mission.databaseId ? savedMissionIds.has(mission.databaseId) : false,
    onSavedChange: (saved: boolean) => void updateSaved(mission, saved),
  })

  return (
    <div className="overflow-hidden">
      <header className="flex items-center justify-between gap-3 pt-1">
        <Link aria-label="Accueil DFI3A" className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600" to="/">
          <img alt="DFI3A" className="h-11 w-[104px] object-contain object-left" src="/dfi3a-logo.svg" />
        </Link>

        <div className="flex h-11 items-center rounded-full border border-slate-300 bg-white pl-3 pr-1.5 shadow-sm">
          <DBuxAmount amount={user ? totalPoints : 0} className="mr-1.5 text-sm font-semibold text-slate-700" iconClassName="h-[18px] w-auto" />
          <NotificationBell />
          <button aria-label="Ouvrir le profil" className="ml-0.5 grid size-8 place-items-center overflow-hidden rounded-full bg-sky-500 text-xs font-bold text-white" onClick={() => navigate('/profile')} type="button">
            {user && avatarUrl ? <img alt="" className="size-full object-cover" src={avatarUrl} /> : String(user?.user_metadata?.first_name || user?.email || 'D').slice(0, 1).toUpperCase()}
          </button>
        </div>
      </header>

      <nav aria-label="Filtrer par date" className="scrollbar-none -mr-4 mt-5 flex gap-2 overflow-x-auto pr-4 pb-1">
        {timeFilters.map((filter) => {
          const isActive = activeTimeFilter === filter.id
          return <button aria-pressed={isActive} className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition ${isActive ? 'bg-sky-500 text-white shadow-sm' : 'bg-white text-slate-700'}`} key={filter.id} onClick={() => setActiveTimeFilter(filter.id)} type="button">{filter.label}</button>
        })}
      </nav>

      {loadError ? (
        <div className="mt-6 rounded-[22px] bg-rose-50 p-5 text-center">
          <p className="text-sm font-bold text-rose-800">Impossible de charger les missions</p>
          <button className="mt-3 min-h-11 rounded-full bg-white px-5 text-sm font-bold text-rose-700 shadow-sm" onClick={() => { setIsLoading(true); setLoadError(false); setLoadAttempt((attempt) => attempt + 1) }} type="button">Réessayer</button>
        </div>
      ) : (
        <>
          <section className="mt-6" aria-labelledby="urgent-heading">
            <div className="mb-3 flex items-center justify-between">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-500">Besoin immédiat</p><h1 id="urgent-heading" className="mt-0.5 text-xl font-bold tracking-tight">Missions urgentes</h1></div>
              <Link className="grid min-h-11 place-items-center px-1 text-sm text-slate-400" to="/explore?urgent=true&radius=all">Voir tout</Link>
            </div>
            {isLoading ? (
              <div className="grid min-h-36 place-items-center"><span className="size-9 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></div>
            ) : urgentMissions.length === 0 ? (
              <div className="rounded-[22px] bg-slate-50 p-5 text-center text-sm text-slate-500">Aucune mission urgente pour cette période.</div>
            ) : (
              <div className="scrollbar-none -mr-4 flex snap-x gap-2.5 overflow-x-auto pr-4 pb-2">
                {urgentMissions.map((mission) => <MissionCard key={mission.id} mission={mission} variant="urgentCompact" {...savedProps(mission)} />)}
              </div>
            )}
          </section>

          {!isLoading && <nav aria-label="Filtrer par catégorie" className="scrollbar-none -mx-4 mt-5 flex overflow-x-auto border-b border-slate-100 px-4">
            {homeCategories.map((category) => {
              const isActive = activeCategory === category
              const Icon = categoryIcon(category)
              return <button aria-pressed={isActive} className={`flex min-w-[76px] shrink-0 flex-col items-center gap-1 border-b-2 px-2 pb-2 pt-1 text-[10px] font-semibold transition ${isActive ? 'border-sky-500 text-slate-950' : 'border-transparent text-slate-500'}`} key={category} onClick={() => setActiveCategory(category)} type="button"><span className={`grid size-9 place-items-center rounded-full ${isActive ? 'bg-sky-100 text-sky-700' : 'bg-slate-50 text-slate-600'}`}><Icon aria-hidden="true" size={20} strokeWidth={2.2} /></span><span className="max-w-[72px] truncate">{category === 'Tout' ? 'Toutes' : category}</span></button>
            })}
          </nav>}

          {!isLoading && <section className="mt-5" aria-labelledby="discover-heading">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-600">À découvrir</p><h2 className="mt-0.5 text-xl font-bold tracking-tight" id="discover-heading">Missions pour vous</h2></div>
              <span className="pb-1 text-xs text-slate-400">{visibleMissions.length} résultat{visibleMissions.length === 1 ? '' : 's'}</span>
            </div>
            {visibleMissions.length === 0 ? (
              <div className="rounded-[22px] bg-slate-50 p-6 text-center"><Sparkles className="mx-auto text-sky-400" size={25} /><p className="mt-2 text-sm font-semibold text-slate-600">Aucune mission pour ce filtre</p><button className="mt-3 text-sm font-bold text-sky-600" onClick={() => { setActiveCategory('Tout'); setActiveTimeFilter('upcoming') }} type="button">Afficher toutes les missions</button></div>
            ) : (
              <div className="space-y-6">{visibleMissions.map((mission) => <MissionCard key={mission.id} mission={mission} variant="homeFeed" {...savedProps(mission)} />)}</div>
            )}
          </section>}
        </>
      )}
    </div>
  )
}
