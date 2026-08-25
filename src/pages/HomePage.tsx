import { Bell, ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { MissionCard } from '../components/MissionCard'
import { sampleMissions } from '../data/missions'
import {
  getMySavedMissionIds,
  getPublicMissions,
  setMissionSaved,
} from '../services/missions'
import { getMyPointsSummary } from '../services/profiles'
import type { Mission } from '../types/mission'

const sections = ['Environnement', 'Santé']

export function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [activeCategory, setActiveCategory] = useState('Tout')
  const [missions, setMissions] = useState<Mission[]>(sampleMissions)
  const [savedMissionIds, setSavedMissionIds] = useState<Set<string>>(new Set())
  const [totalPoints, setTotalPoints] = useState(0)
  const urgentMissions = missions.filter((mission) => mission.isUrgent)

  useEffect(() => {
    void getPublicMissions().then(setMissions).catch(() => undefined)
  }, [])

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

    return [
      { name: 'Tout', count: missions.length },
      ...preferredOrder
        .filter((name) => counts.has(name))
        .map((name) => ({ name, count: counts.get(name) ?? 0 })),
    ]
  }, [missions])

  const visibleSections = activeCategory === 'Tout' ? sections : [activeCategory]

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
        <button
          className="flex min-w-0 min-h-11 items-center gap-1 rounded-lg text-left text-base font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
          type="button"
        >
          <span className="truncate">Mers Sultan</span>
          <ChevronDown aria-hidden="true" size={17} strokeWidth={2.5} />
        </button>

        <div className="flex h-11 items-center rounded-full border border-slate-700 bg-white pl-3 pr-1.5">
          <span className="mr-2 text-sm text-slate-600">
            <span className="mr-1 font-bold text-sky-500">✦</span>{totalPoints}
          </span>
          <button
            aria-label="Notifications"
            className="grid size-9 place-items-center rounded-full text-slate-600 hover:bg-slate-100"
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
        <div className="scrollbar-none -mr-4 flex snap-x snap-mandatory gap-2 overflow-x-auto pr-4">
          {urgentMissions.map((mission) => (
            <div className="snap-start" key={mission.id}>
              <MissionCard mission={mission} variant="urgent" />
            </div>
          ))}
        </div>
      </section>

      <div className="scrollbar-none -mr-4 mt-5 flex gap-1.5 overflow-x-auto pr-4 pb-1">
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
      </div>

      {visibleSections.map((section) => {
        const sectionMissions = missions
          .filter((mission) => !mission.isUrgent && mission.category === section)
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
