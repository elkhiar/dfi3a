import { Crosshair, List, Map as MapIcon, MapPin, Search, SlidersHorizontal } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { MissionCard } from '../components/MissionCard'
import type { MapLocation } from '../components/MissionMap'
import {
  getMySavedMissionIds,
  getPublicMissions,
  setMissionSaved,
} from '../services/missions'
import type { Mission } from '../types/mission'

type ExploreTab = 'list' | 'map'
type Radius = 5 | 10 | 25 | 'all'

const MissionMap = lazy(() => import('../components/MissionMap').then((module) => ({ default: module.MissionMap })))

const defaultLocation = { latitude: 33.5799, longitude: -7.6133 }

function distanceInKm(mission: Mission, origin: MapLocation) {
  if (mission.approximateLatitude == null || mission.approximateLongitude == null) return Number.POSITIVE_INFINITY

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const latitudeDelta = toRadians(mission.approximateLatitude - origin.latitude)
  const longitudeDelta = toRadians(mission.approximateLongitude - origin.longitude)
  const firstLatitude = toRadians(origin.latitude)
  const secondLatitude = toRadians(mission.approximateLatitude)
  const calculation =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2

  return 6371 * 2 * Math.atan2(Math.sqrt(calculation), Math.sqrt(1 - calculation))
}

function searchableText(mission: Mission) {
  return [
    mission.title,
    mission.summary,
    mission.category,
    mission.ngoName,
    mission.city,
    mission.generalArea,
    ...mission.tags,
  ]
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function ExplorePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const urgentOnly = searchParams.get('urgent') === 'true'
  const [missions, setMissions] = useState<Mission[]>([])
  const [savedMissionIds, setSavedMissionIds] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<ExploreTab>('list')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(searchParams.get('category') || 'Toutes')
  const [radius, setRadius] = useState<Radius>(() => {
    const requestedRadius = searchParams.get('radius')
    if (requestedRadius === 'all') return 'all'
    if (requestedRadius === '5' || requestedRadius === '10' || requestedRadius === '25') return Number(requestedRadius) as Radius
    return urgentOnly ? 'all' : 10
  })
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null)
  const [searchOrigin, setSearchOrigin] = useState<MapLocation>(defaultLocation)
  const [locationLabel, setLocationLabel] = useState('Mers Sultan · position par défaut')
  const [locationMessage, setLocationMessage] = useState('')
  const [isLocating, setIsLocating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)

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
  }, [user])

  const categories = useMemo(
    () => ['Toutes', ...Array.from(new Set(missions.map((mission) => mission.category)))],
    [missions],
  )

  const filteredMissions = useMemo(() => {
    const normalizedQuery = query
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()

    return missions.filter((mission) => {
      if (urgentOnly && !mission.isUrgent) return false
      if (category !== 'Toutes' && mission.category !== category) return false
      if (normalizedQuery && !searchableText(mission).includes(normalizedQuery)) return false
      if (radius !== 'all' && distanceInKm(mission, searchOrigin) > radius) return false
      return true
    })
  }, [category, missions, query, radius, searchOrigin, urgentOnly])
  const visibleSelectedMission = selectedMission && filteredMissions.some((mission) => mission.id === selectedMission.id)
    ? selectedMission
    : null

  const updateSaved = async (mission: Mission, saved: boolean) => {
    if (!user) {
      navigate(`/auth?mode=login&returnTo=${encodeURIComponent('/explore')}`)
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

  const useMyLocation = () => {
    setLocationMessage('')
    if (!navigator.geolocation) {
      setLocationMessage('La localisation n’est pas disponible sur cet appareil. La recherche reste centrée sur Mers Sultan.')
      return
    }

    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSearchOrigin({ latitude: position.coords.latitude, longitude: position.coords.longitude })
        setLocationLabel('Votre position actuelle')
        setIsLocating(false)
      },
      () => {
        setSearchOrigin(defaultLocation)
        setLocationLabel('Mers Sultan · position par défaut')
        setLocationMessage('Position non autorisée. La recherche reste centrée sur Mers Sultan.')
        setIsLocating(false)
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    )
  }

  return (
    <div className="pt-[max(0.5rem,env(safe-area-inset-top))]">
      <h1 className="text-[28px] font-bold tracking-[-0.03em]">Explorer</h1>
      <p className="mt-1 text-sm text-slate-500">Trouvez une mission près de chez vous.</p>

      <label className="mt-5 flex min-h-12 items-center gap-2 rounded-[18px] border border-slate-300 bg-white px-4 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100">
        <Search aria-hidden="true" className="text-slate-400" size={20} />
        <input
          className="min-w-0 flex-1 bg-transparent text-base outline-none"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Mission, association, mot-clé…"
          type="search"
          value={query}
        />
      </label>

      <div className="scrollbar-none -mr-4 mt-3 flex gap-2 overflow-x-auto pr-4 pb-1">
        <label className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-slate-300 px-3 text-sm">
          <SlidersHorizontal aria-hidden="true" size={15} />
          <select
            aria-label="Catégorie"
            className="bg-transparent font-semibold outline-none"
            onChange={(event) => setCategory(event.target.value)}
            value={category}
          >
            {categories.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-slate-300 px-3 text-sm">
          <MapPin aria-hidden="true" size={15} />
          <select
            aria-label="Rayon de recherche"
            className="bg-transparent font-semibold outline-none"
            onChange={(event) =>
              setRadius(event.target.value === 'all' ? 'all' : (Number(event.target.value) as Radius))
            }
            value={radius}
          >
            <option value={5}>5 km</option>
            <option value={10}>10 km</option>
            <option value={25}>25 km</option>
            <option value="all">Sans limite</option>
          </select>
        </label>
        <button className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50 px-3 text-sm font-semibold text-sky-700 disabled:opacity-60" disabled={isLocating} onClick={useMyLocation} type="button">
          <Crosshair aria-hidden="true" size={15} />
          {isLocating ? 'Localisation…' : 'Ma position'}
        </button>
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-500"><MapPin aria-hidden="true" size={13} />Rayon calculé depuis {locationLabel}</p>
      {locationMessage && <p className="mt-2 rounded-[14px] bg-amber-50 p-3 text-xs leading-5 text-amber-800" role="status">{locationMessage}</p>}

      <div className="mt-4 grid grid-cols-2 rounded-full bg-slate-100 p-1">
        <TabButton active={activeTab === 'list'} icon={List} onClick={() => setActiveTab('list')}>
          Liste
        </TabButton>
        <TabButton active={activeTab === 'map'} icon={MapIcon} onClick={() => setActiveTab('map')}>
          Carte
        </TabButton>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm font-semibold">
          {filteredMissions.length} mission{filteredMissions.length === 1 ? '' : 's'}
        </p>
        {urgentOnly && <span className="text-xs font-semibold text-rose-600">Urgentes uniquement</span>}
      </div>

      {isLoading ? (
        <div className="grid min-h-72 place-items-center">
          <span className="block size-9 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
        </div>
      ) : loadError ? (
        <div className="mt-6 rounded-[22px] bg-rose-50 p-8 text-center">
          <p className="font-bold text-rose-800">Impossible de charger les missions</p>
          <button className="mt-4 min-h-11 rounded-full bg-white px-5 text-sm font-bold text-rose-700 shadow-sm" onClick={() => { setIsLoading(true); setLoadError(false); setLoadAttempt((attempt) => attempt + 1) }} type="button">Réessayer</button>
        </div>
      ) : filteredMissions.length === 0 ? (
        <div className="mt-6 rounded-[22px] bg-slate-50 p-8 text-center">
          <p className="font-bold">Aucune mission trouvée</p>
          <p className="mt-1 text-sm text-slate-500">Essayez un autre mot-clé ou un rayon plus large.</p>
        </div>
      ) : activeTab === 'list' ? (
        <section className="mt-4 grid grid-cols-2 gap-2" aria-label="Résultats de recherche">
          {filteredMissions.map((mission) => (
            <MissionCard
              isSaved={mission.databaseId ? savedMissionIds.has(mission.databaseId) : false}
              key={mission.id}
              mission={mission}
              onSavedChange={(saved) => void updateSaved(mission, saved)}
            />
          ))}
        </section>
      ) : (
        <Suspense fallback={<div className="grid min-h-[430px] place-items-center"><span className="size-9 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></div>}>
          <MissionMap
            missions={filteredMissions}
            onOpen={(mission) => navigate(`/missions/${mission.id}`)}
            onSelect={setSelectedMission}
            origin={searchOrigin}
            selectedMission={visibleSelectedMission}
          />
        </Suspense>
      )}
    </div>
  )
}

function TabButton({ active, children, icon: Icon, onClick }: {
  active: boolean
  children: React.ReactNode
  icon: typeof List
  onClick: () => void
}) {
  return (
    <button
      aria-pressed={active}
      className={`flex min-h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold ${
        active ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" size={17} /> {children}
    </button>
  )
}
