import { CalendarDays, CheckCircle2, Heart, MapPin, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { getMyJoinedMissions, getMySavedMissions } from '../services/missions'
import type { Mission } from '../types/mission'

type EventsTab = 'joined' | 'saved'

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Casablanca',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(value))
}

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Casablanca',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function MyEventsPage() {
  const location = useLocation()
  const { user, isLoading: isAuthLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<EventsTab>('joined')
  const [missions, setMissions] = useState<Mission[]>([])
  const [savedMissions, setSavedMissions] = useState<Mission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (isAuthLoading) return

    if (!user) return

    let isCurrent = true

    void Promise.all([
      getMyJoinedMissions(),
      getMySavedMissions().catch(() => [] as Mission[]),
    ])
      .then(([joinedMissions, volunteerSavedMissions]) => {
        if (!isCurrent) return
        setMissions(joinedMissions)
        setSavedMissions(volunteerSavedMissions)
      })
      .catch(() => {
        if (isCurrent) setErrorMessage('Impossible de charger vos événements.')
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [isAuthLoading, user])

  return (
    <div className="pt-[max(0.5rem,env(safe-area-inset-top))]">
      <p className="text-xs font-semibold text-sky-600">Votre engagement</p>
      <h1 className="mt-1 text-[28px] font-bold tracking-[-0.03em]">Mes événements</h1>
      <p className="mt-1 text-sm text-slate-500">Retrouvez vos prochaines missions et vos favoris.</p>

      <div className="mt-6 grid grid-cols-2 rounded-full bg-slate-100 p-1">
        <TabButton active={activeTab === 'joined'} onClick={() => setActiveTab('joined')}>
          À venir
        </TabButton>
        <TabButton active={activeTab === 'saved'} onClick={() => setActiveTab('saved')}>
          Enregistrées
        </TabButton>
      </div>

      {!isAuthLoading && !user ? (
        <EmptyState
          description="Connectez-vous pour retrouver les missions auxquelles vous participez."
          icon={CalendarDays}
          title="Vos événements vous attendent"
        >
          <Link
            className="mt-5 inline-flex min-h-11 items-center rounded-full bg-sky-500 px-5 text-sm font-bold text-white"
            to={`/auth?mode=login&returnTo=${encodeURIComponent(location.pathname)}`}
          >
            Se connecter
          </Link>
        </EmptyState>
      ) : activeTab === 'saved' && (isLoading || isAuthLoading) ? (
        <div className="grid min-h-72 place-items-center">
          <span className="block size-9 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
        </div>
      ) : activeTab === 'saved' && savedMissions.length === 0 ? (
        <EmptyState
          description="Les missions que vous enregistrerez apparaîtront ici."
          icon={Heart}
          title="Aucune mission enregistrée"
        />
      ) : activeTab === 'saved' ? (
        <section className="mt-6 space-y-3" aria-label="Missions enregistrées">
          {savedMissions.map((mission) => (
            <JoinedMissionCard key={mission.id} mission={mission} status="saved" />
          ))}
        </section>
      ) : isLoading || isAuthLoading ? (
        <div className="grid min-h-72 place-items-center">
          <span className="block size-9 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
        </div>
      ) : errorMessage ? (
        <p className="mt-6 rounded-[18px] bg-rose-50 p-4 text-sm text-rose-700" role="alert">
          {errorMessage}
        </p>
      ) : missions.length === 0 ? (
        <EmptyState
          description="Explorez les missions et rejoignez celle qui vous ressemble."
          icon={Sparkles}
          title="Aucune mission à venir"
        />
      ) : (
        <section className="mt-6 space-y-3" aria-label="Missions à venir">
          {missions.map((mission) => (
            <JoinedMissionCard key={mission.id} mission={mission} />
          ))}
        </section>
      )}
    </div>
  )
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      aria-pressed={active}
      className={`min-h-11 rounded-full text-sm font-semibold transition ${
        active ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

function JoinedMissionCard({
  mission,
  status = 'joined',
}: {
  mission: Mission
  status?: 'joined' | 'saved'
}) {
  return (
    <Link
      className="flex gap-3 rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm transition active:scale-[0.99]"
      to={`/missions/${mission.id}`}
    >
      <img
        alt=""
        className="h-28 w-28 shrink-0 rounded-[18px] object-cover"
        src={mission.coverImageUrl}
      />
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-700">
            {formatEventDate(mission.startsAt)}
          </span>
          <span
            className={`flex items-center gap-1 text-[10px] font-semibold ${
              status === 'joined' ? 'text-emerald-700' : 'text-sky-700'
            }`}
          >
            {status === 'joined' ? (
              <CheckCircle2 aria-hidden="true" size={13} />
            ) : (
              <Heart aria-hidden="true" fill="currentColor" size={13} />
            )}
            {status === 'joined' ? 'Inscrit' : 'Enregistrée'}
          </span>
        </div>
        <h2 className="mt-2 line-clamp-2 text-base font-bold leading-[1.05]">{mission.title}</h2>
        <p className="mt-2 flex items-center gap-1 truncate text-xs text-slate-500">
          <MapPin aria-hidden="true" size={13} />
          {mission.generalArea}, {mission.city}
        </p>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-slate-500">{formatEventTime(mission.startsAt)}</span>
          <span className="font-bold text-sky-600">{mission.points} pts</span>
        </div>
      </div>
    </Link>
  )
}

function EmptyState({
  children,
  description,
  icon: Icon,
  title,
}: {
  children?: React.ReactNode
  description: string
  icon: typeof CalendarDays
  title: string
}) {
  return (
    <div className="mt-8 rounded-[24px] bg-slate-50 px-6 py-10 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-sky-100 text-sky-700">
        <Icon aria-hidden="true" size={25} />
      </span>
      <h2 className="mt-4 text-lg font-bold">{title}</h2>
      <p className="mx-auto mt-1 max-w-xs text-sm leading-6 text-slate-500">{description}</p>
      {children}
    </div>
  )
}
