import { Bell, MapPin } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { MissionCard } from '../components/MissionCard'
import {
  getMySavedMissionIds,
  getPublicMissions,
  setMissionSaved,
} from '../services/missions'
import { getMyPointsSummary } from '../services/profiles'
import type { Mission } from '../types/mission'

export function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [activeCategory, setActiveCategory] = useState('Tout')
  const [missions, setMissions] = useState<Mission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [savedMissionIds, setSavedMissionIds] = useState<Set<string>>(new Set())
  const [totalPoints, setTotalPoints] = useState(0)
  const urgentMissions = missions.filter((mission) => mission.isUrgent)

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

    void getMySavedMissionIds().then(setSavedMissionIds).catch(() => undefined)
    void getMyPointsSummary()
      .then((summary) => setTotalPoints(summary.totalPoints))
      .catch(() => setTotalPoints(0))
  }, [user])

  const homeCategories = useMemo(() => {
    const preferredOrder = ['Santé', 'Environnement', 'Éducation', 'Culture et patrimoine']
    const counts = new Map<string, number>()

    for (const mission of missions) {
      counts.set(mission.category, (counts.get(mission.category) ?? 0) + 1)
    }

    const remainingCategories = Array.from(counts.keys())
      .filter((name) => !preferredOrder.includes(name))
      .sort((first, second) => first.localeCompare(second, 'fr'))

    return [
      { name: 'Tout', count: missions.length },
      ...[...preferredOrder, ...remainingCategories]
        .filter((name) => counts.has(name))
        .map((name) => ({ name, count: counts.get(name) ?? 0 })),
    ]
  }, [missions])

  const visibleSections = activeCategory === 'Tout'
    ? homeCategories.filter((category) => category.name !== 'Tout').map((category) => category.name)
    : [activeCategory]

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

  return (
    <div className="overflow-hidden">
      <header className="flex items-center justify-between gap-4 pt-3">
        <Link
          className="flex min-w-0 min-h-11 items-center gap-1 rounded-lg text-left text-base font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
          to="/explore"
        >
          <MapPin aria-hidden="true" className="shrink-0 text-sky-500" size={17} />
          <span className="truncate">Mers Sultan</span>
        </Link>

        <div className="flex h-11 items-center rounded-full border border-slate-700 bg-white pl-3 pr-1.5">
          <span className="mr-2 text-sm text-slate-600">
            <span className="mr-1 font-bold text-sky-500">✦</span>{totalPoints}
          </span>
          <button
            aria-label="Notifications"
            className="grid size-9 cursor-not-allowed place-items-center rounded-full text-slate-300"
            disabled
            title="Notifications bientôt disponibles"
            type="button"
          >
            <Bell aria-hidden="true" size={20} />
          </button>
          <button
            aria-label="Ouvrir le profil"
            className="ml-0.5 grid size-8 place-items-center overflow-hidden rounded-full bg-sky-500 text-xs font-bold text-white"
            onClick={() => navigate('/profile')}
            type="button"
          >
            {String(user?.user_metadata?.first_name || user?.email || 'D').slice(0, 1).toUpperCase()}
          </button>
        </div>
      </header>

      <section className="mt-7" aria-labelledby="urgent-heading">
        <div className="mb-2 flex items-center justify-between">
          <h1 id="urgent-heading" className="text-xl font-bold tracking-tight">
            Missions urgentes
          </h1>
          <Link className="grid min-h-11 place-items-center px-1 text-sm text-slate-400" to="/explore?urgent=true&radius=all">
            Voir tout
          </Link>
        </div>
        {isLoading ? (
          <div className="grid min-h-40 place-items-center"><span className="size-9 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></div>
        ) : loadError ? (
          <div className="rounded-[22px] bg-rose-50 p-5 text-center">
            <p className="text-sm font-bold text-rose-800">Impossible de charger les missions</p>
            <button className="mt-3 min-h-11 rounded-full bg-white px-5 text-sm font-bold text-rose-700 shadow-sm" onClick={() => { setIsLoading(true); setLoadError(false); setLoadAttempt((attempt) => attempt + 1) }} type="button">Réessayer</button>
          </div>
        ) : urgentMissions.length === 0 ? (
          <div className="rounded-[22px] bg-slate-50 p-5 text-center text-sm text-slate-500">Aucune mission urgente pour le moment.</div>
        ) : <div className="scrollbar-none -mr-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pr-4">
          {urgentMissions.map((mission) => (
            <div className="snap-start snap-always" key={mission.id}>
              <MissionCard mission={mission} variant="urgent" />
            </div>
          ))}
        </div>}
      </section>

      {!loadError && !isLoading && <div className="scrollbar-none -mr-4 mt-5 flex gap-1.5 overflow-x-auto pr-4 pb-1">
        {homeCategories.map((category) => {
          const isActive = activeCategory === category.name

          return (
            <button
              aria-pressed={isActive}
              className={`min-h-9 shrink-0 rounded-full border px-3 text-sm transition ${
                isActive
                  ? 'border-sky-600 bg-sky-50 font-semibold text-sky-800'
                  : 'border-slate-300 bg-white text-slate-800'
              }`}
              key={category.name}
              onClick={() => setActiveCategory(category.name)}
              type="button"
            >
              {category.name}{' '}
              <span className={isActive ? 'text-sky-600' : 'text-slate-400'}>
                {category.count}
              </span>
            </button>
          )
        })}
      </div>}

      {!loadError && !isLoading && visibleSections.map((section) => {
        const sectionMissions = missions
          .filter((mission) => mission.category === section && (activeCategory !== 'Tout' || !mission.isUrgent))
          .slice(0, 2)

        if (sectionMissions.length === 0) return null

        return (
          <section className="mt-5" aria-labelledby={`section-${section}`} key={section}>
            <div className="mb-2 flex items-center justify-between">
              <h2
                className="text-xl font-bold tracking-tight"
                id={`section-${section}`}
              >
                {section}
              </h2>
              <Link
                className="grid min-h-11 place-items-center px-1 text-sm text-slate-400"
                to={`/explore?category=${encodeURIComponent(section)}`}
              >
                Voir tout
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {sectionMissions.map((mission) => (
                <MissionCard
                  isSaved={
                    Boolean(user) && mission.databaseId
                      ? savedMissionIds.has(mission.databaseId)
                      : false
                  }
                  key={mission.id}
                  mission={mission}
                  onSavedChange={(saved) => void updateSaved(mission, saved)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
