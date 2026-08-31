import { Ban, CalendarDays, CheckCircle2, Clock3, Heart, MapPin, Sparkles, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { DBuxAmount } from '../components/DBuxIcon'
import { getMyJoinedMissions, getMyMissionHistory, getMySavedMissions } from '../services/missions'
import type { Mission } from '../types/mission'
import type { VolunteerMissionHistoryEntry } from '../services/missions'

type EventsTab = 'joined' | 'saved' | 'history'

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
  const [history, setHistory] = useState<VolunteerMissionHistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (isAuthLoading) return

    if (!user) return

    let isCurrent = true

    void Promise.all([
      getMyJoinedMissions(),
      getMySavedMissions().catch(() => [] as Mission[]),
      getMyMissionHistory(),
    ])
      .then(([joinedMissions, volunteerSavedMissions, historyEntries]) => {
        if (!isCurrent) return
        setMissions(joinedMissions)
        setSavedMissions(volunteerSavedMissions)
        setHistory(historyEntries)
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

      <div className="mt-6 grid grid-cols-3 rounded-full bg-slate-100 p-1">
        <TabButton active={activeTab === 'joined'} onClick={() => setActiveTab('joined')}>
          À venir
        </TabButton>
        <TabButton active={activeTab === 'saved'} onClick={() => setActiveTab('saved')}>
          Enregistrées
        </TabButton>
        <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
          Historique
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
      ) : isLoading || isAuthLoading ? (
        <div className="grid min-h-72 place-items-center">
          <span className="block size-9 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
        </div>
      ) : errorMessage ? (
        <p className="mt-6 rounded-[18px] bg-rose-50 p-4 text-sm text-rose-700" role="alert">
          {errorMessage}
        </p>
      ) : activeTab === 'history' && history.length === 0 ? (
        <EmptyState
          description="Vos missions terminées et vos annulations apparaîtront ici."
          icon={Clock3}
          title="Aucun historique"
        />
      ) : activeTab === 'history' ? (
        <section className="mt-6 space-y-3" aria-label="Historique privé des missions">
          {history.map((entry) => <HistoryCard entry={entry} key={entry.registrationId} />)}
        </section>
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

function HistoryCard({ entry }: { entry: VolunteerMissionHistoryEntry }) {
  const isMissionCancelled = entry.missionStatus === 'cancelled'
  const status = isMissionCancelled
    ? { icon: Ban, label: 'Mission annulée', style: 'bg-amber-50 text-amber-800' }
    : entry.registrationStatus === 'cancelled'
      ? { icon: Ban, label: 'Inscription annulée', style: 'bg-slate-100 text-slate-700' }
      : entry.attendanceStatus === 'present'
        ? { icon: CheckCircle2, label: 'Présence validée', style: 'bg-emerald-50 text-emerald-800' }
        : entry.attendanceStatus === 'absent'
          ? { icon: XCircle, label: 'Absence', style: 'bg-rose-50 text-rose-700' }
          : { icon: Clock3, label: 'Validation en attente', style: 'bg-sky-50 text-sky-700' }
  const StatusIcon = status.icon
  const pointAmount = entry.pointsApplied > 0
    ? `+${entry.pointsApplied}`
    : entry.pointsApplied < 0
      ? `−${Math.abs(entry.pointsApplied)}`
      : '0'

  return (
    <article className="rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex gap-3">
        <img alt="" className="size-20 shrink-0 rounded-[16px] object-cover" src={entry.coverImageUrl} />
        <div className="min-w-0 flex-1">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${status.style}`}><StatusIcon aria-hidden="true" size={12} />{status.label}</span>
          <h2 className="mt-2 line-clamp-2 text-sm font-bold leading-tight">{entry.missionTitle}</h2>
          <p className="mt-1 truncate text-xs text-slate-500">{entry.ngoName}</p>
        </div>
        <span className={`shrink-0 text-xs font-bold ${entry.pointsApplied < 0 ? 'text-rose-600' : entry.pointsApplied > 0 ? 'text-emerald-700' : 'text-slate-400'}`}><DBuxAmount amount={pointAmount} iconClassName="h-3.5 w-auto" /></span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>{formatEventDate(entry.startsAt)} · {formatEventTime(entry.startsAt)}</span>
        <span className="flex min-w-0 items-center gap-1 truncate"><MapPin aria-hidden="true" size={12} />{entry.generalArea}</span>
      </div>
      {entry.cancellationReason && <p className="mt-3 rounded-[14px] bg-slate-50 p-3 text-xs leading-5 text-slate-600"><strong>Motif :</strong> {entry.cancellationReason}</p>}
    </article>
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
          <span className="font-bold text-sky-600"><DBuxAmount amount={mission.points} iconClassName="h-3.5 w-auto" /></span>
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
