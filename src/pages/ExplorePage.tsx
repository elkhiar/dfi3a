import {
  Building2,
  List,
  Map as MapIcon,
  MapPin,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { MissionCard } from '../components/MissionCard'
import type { MapLocation } from '../components/MissionMap'
import {
  getMySavedMissionIds,
  getPublicMissions,
  setMissionSaved,
} from '../services/missions'
import { searchPublicNgos } from '../services/ngos'
import type { PublicNgo } from '../services/ngos'
import { searchPublicVolunteers } from '../services/profiles'
import type { PublicVolunteer } from '../services/profiles'
import type { Mission } from '../types/mission'

type DirectoryTab = 'missions' | 'ngos' | 'users'
type MissionView = 'list' | 'map'

const MissionMap = lazy(() => import('../components/MissionMap').then((module) => ({ default: module.MissionMap })))
const defaultLocation = { latitude: 33.5799, longitude: -7.6133 }

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function searchableMissionText(mission: Mission) {
  return normalize([
    mission.title,
    mission.summary,
    mission.category,
    mission.ngoName,
    mission.city,
    mission.generalArea,
    ...mission.tags,
  ].join(' '))
}

export function ExplorePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const urgentOnly = searchParams.get('urgent') === 'true'
  const [activeDirectory, setActiveDirectory] = useState<DirectoryTab>('missions')
  const [missionView, setMissionView] = useState<MissionView>('list')
  const [query, setQuery] = useState('')
  const [missions, setMissions] = useState<Mission[]>([])
  const [ngos, setNgos] = useState<PublicNgo[]>([])
  const [volunteers, setVolunteers] = useState<PublicVolunteer[]>([])
  const [savedMissionIds, setSavedMissionIds] = useState<Set<string>>(new Set())
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null)
  const [searchOrigin, setSearchOrigin] = useState<MapLocation>(defaultLocation)
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null)
  const [hasUserLocation, setHasUserLocation] = useState(false)
  const [locationMessage, setLocationMessage] = useState('')
  const [isLocating, setIsLocating] = useState(false)
  const [locationFocusRequest, setLocationFocusRequest] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [directoryLoading, setDirectoryLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    let isCurrent = true
    void getPublicMissions()
      .then((nextMissions) => { if (isCurrent) setMissions(nextMissions) })
      .catch(() => { if (isCurrent) setLoadError(true) })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [loadAttempt])

  useEffect(() => {
    if (!user) return
    void getMySavedMissionIds().then(setSavedMissionIds).catch(() => undefined)
  }, [user])

  useEffect(() => {
    if (activeDirectory === 'missions') return
    let isCurrent = true
    const timeout = window.setTimeout(() => {
      setDirectoryLoading(true)
      const request = activeDirectory === 'ngos'
        ? searchPublicNgos(query).then((results) => { if (isCurrent) setNgos(results) })
        : searchPublicVolunteers(query).then((results) => { if (isCurrent) setVolunteers(results) })
      void request
        .catch(() => {
          if (isCurrent) {
            if (activeDirectory === 'ngos') setNgos([])
            else setVolunteers([])
          }
        })
        .finally(() => { if (isCurrent) setDirectoryLoading(false) })
    }, 250)
    return () => {
      isCurrent = false
      window.clearTimeout(timeout)
    }
  }, [activeDirectory, query])

  const filteredMissions = useMemo(() => {
    const normalizedQuery = normalize(query.trim())
    return missions.filter((mission) => {
      if (urgentOnly && !mission.isUrgent) return false
      return !normalizedQuery || searchableMissionText(mission).includes(normalizedQuery)
    })
  }, [missions, query, urgentOnly])

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
      setLocationMessage('La localisation n’est pas disponible sur cet appareil.')
      return
    }
    setIsLocating(true)

    const applyPosition = (position: GeolocationPosition) => {
      setSearchOrigin({ latitude: position.coords.latitude, longitude: position.coords.longitude })
      setLocationAccuracy(position.coords.accuracy)
      setHasUserLocation(true)
      setLocationFocusRequest((request) => request + 1)
      setLocationMessage(position.coords.accuracy > 100
        ? `Votre position est estimée à ±${Math.round(position.coords.accuracy)} m. Activez la localisation précise pour l’améliorer.`
        : '')
      setIsLocating(false)
    }

    const failLocation = (error: GeolocationPositionError) => {
      setLocationMessage(error.code === error.PERMISSION_DENIED
        ? 'Autorisez la localisation dans votre navigateur, puis réessayez.'
        : 'Votre position est introuvable. Activez le GPS, puis réessayez.')
      setIsLocating(false)
    }

    navigator.geolocation.getCurrentPosition(
      applyPosition,
      failLocation,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    )
  }

  return (
    <div className="pt-[max(0.5rem,env(safe-area-inset-top))]">
      <h1 className="text-[28px] font-bold tracking-[-0.03em]">Explorer</h1>
      <p className="mt-1 text-sm text-slate-500">Missions, associations et bénévoles dfi3a.</p>

      <label className="mt-5 flex min-h-12 items-center gap-2 rounded-[18px] border border-slate-300 bg-white px-4 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100" data-tour="explore-search">
        <Search aria-hidden="true" className="text-slate-400" size={20} />
        <input
          className="min-w-0 flex-1 bg-transparent text-base outline-none"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={activeDirectory === 'missions' ? 'Mission, association, mot-clé…' : activeDirectory === 'ngos' ? 'Nom ou ville de l’ONG…' : 'Nom, ville ou bio…'}
          type="search"
          value={query}
        />
      </label>

      <div className="mt-4 grid grid-cols-3 gap-1 rounded-[18px] bg-slate-100 p-1" data-tour="explore-directories" role="tablist" aria-label="Type de recherche">
        <DirectoryTabButton active={activeDirectory === 'missions'} icon={MapPin} label="Missions" onClick={() => setActiveDirectory('missions')} />
        <DirectoryTabButton active={activeDirectory === 'ngos'} icon={Building2} label="ONG" onClick={() => setActiveDirectory('ngos')} />
        <DirectoryTabButton active={activeDirectory === 'users'} icon={UserRound} label="Utilisateurs" onClick={() => setActiveDirectory('users')} />
      </div>

      {activeDirectory === 'missions' ? (
        <MissionResults
          filteredMissions={filteredMissions}
          hasUserLocation={hasUserLocation}
          isLoading={isLoading}
          isLocating={isLocating}
          loadError={loadError}
          locationAccuracy={locationAccuracy}
          locationFocusRequest={locationFocusRequest}
          locationMessage={locationMessage}
          missionView={missionView}
          onLocate={useMyLocation}
          onOpen={(mission) => navigate(`/missions/${mission.id}`)}
          onRetry={() => { setIsLoading(true); setLoadError(false); setLoadAttempt((attempt) => attempt + 1) }}
          onSelect={setSelectedMission}
          onViewChange={setMissionView}
          origin={searchOrigin}
          savedMissionIds={savedMissionIds}
          selectedMission={visibleSelectedMission}
          updateSaved={updateSaved}
          urgentOnly={urgentOnly}
        />
      ) : activeDirectory === 'ngos' ? (
        <NgoResults isLoading={directoryLoading} ngos={ngos} />
      ) : (
        <VolunteerResults isLoading={directoryLoading} volunteers={volunteers} />
      )}
    </div>
  )
}

function MissionResults({ filteredMissions, hasUserLocation, isLoading, isLocating, loadError, locationAccuracy, locationFocusRequest, locationMessage, missionView, onLocate, onOpen, onRetry, onSelect, onViewChange, origin, savedMissionIds, selectedMission, updateSaved, urgentOnly }: {
  filteredMissions: Mission[]
  hasUserLocation: boolean
  isLoading: boolean
  isLocating: boolean
  loadError: boolean
  locationAccuracy: number | null
  locationFocusRequest: number
  locationMessage: string
  missionView: MissionView
  onLocate: () => void
  onOpen: (mission: Mission) => void
  onRetry: () => void
  onSelect: (mission: Mission) => void
  onViewChange: (view: MissionView) => void
  origin: MapLocation
  savedMissionIds: Set<string>
  selectedMission: Mission | null
  updateSaved: (mission: Mission, saved: boolean) => Promise<void>
  urgentOnly: boolean
}) {
  return (
    <>
      <div className="mt-4 grid grid-cols-2 rounded-full bg-slate-100 p-1">
        <ViewTab active={missionView === 'list'} icon={List} label="Liste" onClick={() => onViewChange('list')} />
        <ViewTab active={missionView === 'map'} icon={MapIcon} label="Carte" onClick={() => onViewChange('map')} />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm font-semibold">{filteredMissions.length} mission{filteredMissions.length === 1 ? '' : 's'}</p>
        {urgentOnly && <span className="text-xs font-semibold text-rose-600">Urgentes uniquement</span>}
      </div>

      {isLoading ? <Loading /> : loadError ? (
        <Empty title="Impossible de charger les missions" text="Vérifiez votre connexion puis réessayez." action="Réessayer" onAction={onRetry} />
      ) : filteredMissions.length === 0 ? (
        <Empty title="Aucune mission trouvée" text="Essayez un autre mot-clé." />
      ) : missionView === 'list' ? (
        <section className="mt-4 grid grid-cols-2 gap-2" aria-label="Résultats de missions">
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
        <Suspense fallback={<Loading />}>
          <MissionMap
            focusUserLocationRequest={locationFocusRequest}
            isLocating={isLocating}
            locationMessage={locationMessage}
            missions={filteredMissions}
            onLocate={onLocate}
            onOpen={onOpen}
            onSelect={onSelect}
            origin={origin}
            originAccuracyMeters={locationAccuracy}
            selectedMission={selectedMission}
            showOrigin={hasUserLocation}
          />
        </Suspense>
      )}
    </>
  )
}

function NgoResults({ isLoading, ngos }: { isLoading: boolean; ngos: PublicNgo[] }) {
  if (isLoading) return <Loading />
  if (ngos.length === 0) return <Empty title="Aucune ONG trouvée" text="Essayez un autre nom ou une autre ville." />
  return (
    <section className="mt-4 space-y-3" aria-label="Résultats des ONG">
      {ngos.map((ngo) => (
        <Link aria-label={`Voir le profil de ${ngo.name}`} className="flex gap-3 rounded-[22px] border border-slate-200 bg-white p-4 transition active:scale-[0.99]" key={ngo.id} to={`/ngos/${ngo.id}`}>
          {ngo.logoUrl ? <img alt="" className="size-14 shrink-0 rounded-[18px] object-cover" src={ngo.logoUrl} /> : <span className="grid size-14 shrink-0 place-items-center rounded-[18px] bg-sky-100 text-sky-700"><Building2 aria-hidden="true" size={25} /></span>}
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-1.5 font-bold">{ngo.name}<ShieldCheck aria-label="ONG vérifiée" className="shrink-0 text-emerald-600" size={16} /></h2>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin aria-hidden="true" size={13} />{ngo.mainCity}</p>
            {ngo.description && <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600">{ngo.description}</p>}
          </div>
        </Link>
      ))}
    </section>
  )
}

function VolunteerResults({ isLoading, volunteers }: { isLoading: boolean; volunteers: PublicVolunteer[] }) {
  if (isLoading) return <Loading />
  if (volunteers.length === 0) return <Empty title="Aucun utilisateur trouvé" text="Seuls les bénévoles ayant choisi d’apparaître dans la recherche sont visibles ici." />
  return (
    <section className="mt-4 space-y-3" aria-label="Résultats des utilisateurs">
      {volunteers.map((volunteer) => {
        const initials = volunteer.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
        return (
          <Link aria-label={`Voir le profil de ${volunteer.displayName}`} className="flex gap-3 rounded-[22px] border border-slate-200 bg-white p-4 transition active:scale-[0.99]" key={volunteer.userId} to={`/users/${volunteer.userId}`}>
            {volunteer.avatarUrl ? <img alt="" className="size-14 shrink-0 rounded-[18px] object-cover" src={volunteer.avatarUrl} /> : <span className="grid size-14 shrink-0 place-items-center rounded-[18px] bg-slate-700 font-bold text-sky-300">{initials || 'D'}</span>}
            <div className="min-w-0 flex-1">
              <h2 className="font-bold">{volunteer.displayName}</h2>
              {volunteer.city && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin aria-hidden="true" size={13} />{volunteer.city}</p>}
              {volunteer.bio && <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600">{volunteer.bio}</p>}
            </div>
          </Link>
        )
      })}
    </section>
  )
}

function DirectoryTabButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof MapPin; label: string; onClick: () => void }) {
  return <button aria-selected={active} className={`flex min-h-11 items-center justify-center gap-1.5 rounded-[14px] text-xs font-bold ${active ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'}`} onClick={onClick} role="tab" type="button"><Icon aria-hidden="true" size={16} />{label}</button>
}

function ViewTab({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof List; label: string; onClick: () => void }) {
  return <button aria-pressed={active} className={`flex min-h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold ${active ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'}`} onClick={onClick} type="button"><Icon aria-hidden="true" size={17} />{label}</button>
}

function Loading() {
  return <div className="grid min-h-64 place-items-center"><span className="size-9 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></div>
}

function Empty({ action, onAction, text, title }: { action?: string; onAction?: () => void; text: string; title: string }) {
  return <div className="mt-6 rounded-[22px] bg-slate-50 p-8 text-center"><p className="font-bold">{title}</p><p className="mt-1 text-sm text-slate-500">{text}</p>{action && onAction && <button className="mt-4 min-h-11 rounded-full bg-white px-5 text-sm font-bold text-sky-700 shadow-sm" onClick={onAction} type="button">{action}</button>}</div>
}
