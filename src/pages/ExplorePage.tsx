import { List, Map, MapPin, Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { MissionCard } from '../components/MissionCard'
import {
  getMySavedMissionIds,
  getPublicMissions,
  setMissionSaved,
} from '../services/missions'
import type { Mission } from '../types/mission'

type ExploreTab = 'list' | 'map'
type Radius = 5 | 10 | 25 | 'all'

const referenceLocation = { latitude: 33.5799, longitude: -7.6133 }

function distanceInKm(mission: Mission) {
  if (mission.approximateLatitude == null || mission.approximateLongitude == null) return 0

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const latitudeDelta = toRadians(mission.approximateLatitude - referenceLocation.latitude)
  const longitudeDelta = toRadians(mission.approximateLongitude - referenceLocation.longitude)
  const firstLatitude = toRadians(referenceLocation.latitude)
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
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void getPublicMissions()
      .then(setMissions)
      .finally(() => setIsLoading(false))
  }, [])

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
      if (radius !== 'all' && distanceInKm(mission) > radius) return false
      return true
    })
  }, [category, missions, query, radius, urgentOnly])

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
      </div>

      <div className="mt-4 grid grid-cols-2 rounded-full bg-slate-100 p-1">
        <TabButton active={activeTab === 'list'} icon={List} onClick={() => setActiveTab('list')}>
          Liste
        </TabButton>
        <TabButton active={activeTab === 'map'} icon={Map} onClick={() => setActiveTab('map')}>
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
        <MissionMap
          missions={filteredMissions}
          onSelect={setSelectedMission}
          selectedMission={selectedMission}
        />
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

function MissionMap({ missions, onSelect, selectedMission }: {
  missions: Mission[]
  onSelect: (mission: Mission) => void
  selectedMission: Mission | null
}) {
  const latitudes = missions.map((mission) => mission.approximateLatitude ?? referenceLocation.latitude)
  const longitudes = missions.map((mission) => mission.approximateLongitude ?? referenceLocation.longitude)
  const minLatitude = Math.min(...latitudes) - 0.01
  const maxLatitude = Math.max(...latitudes) + 0.01
  const minLongitude = Math.min(...longitudes) - 0.01
  const maxLongitude = Math.max(...longitudes) + 0.01

  return (
    <section className="relative mt-4 h-[430px] overflow-hidden rounded-[24px] border border-sky-100 bg-sky-50">
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(#7dd3fc_1px,transparent_1px),linear-gradient(90deg,#7dd3fc_1px,transparent_1px)] [background-size:32px_32px]" />
      {missions.map((mission) => {
        const latitude = mission.approximateLatitude ?? referenceLocation.latitude
        const longitude = mission.approximateLongitude ?? referenceLocation.longitude
        const top = 10 + ((maxLatitude - latitude) / (maxLatitude - minLatitude)) * 70
        const left = 10 + ((longitude - minLongitude) / (maxLongitude - minLongitude)) * 80

        return (
          <button
            aria-label={`Voir ${mission.title}`}
            className={`absolute grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white shadow-md ${
              selectedMission?.id === mission.id ? 'bg-slate-700 text-sky-300' : 'bg-sky-500 text-white'
            }`}
            key={mission.id}
            onClick={() => onSelect(mission)}
            style={{ left: `${left}%`, top: `${top}%` }}
            type="button"
          >
            <MapPin aria-hidden="true" size={18} />
          </button>
        )
      })}

      {selectedMission && (
        <button
          className="absolute inset-x-3 bottom-3 flex gap-3 rounded-[18px] bg-white p-3 text-left shadow-lg"
          onClick={() => (window.location.href = `/missions/${selectedMission.id}`)}
          type="button"
        >
          <img alt="" className="size-16 rounded-[14px] object-cover" src={selectedMission.coverImageUrl} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{selectedMission.title}</span>
            <span className="mt-1 block text-xs text-slate-500">{selectedMission.generalArea}</span>
            <span className="mt-1 block text-xs font-bold text-sky-600">{selectedMission.points} pts</span>
          </span>
        </button>
      )}
    </section>
  )
}
