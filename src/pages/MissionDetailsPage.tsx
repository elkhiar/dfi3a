import {
  Accessibility,
  ArrowLeft,
  Ban,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Gauge,
  Heart,
  MapPin,
  MessageCircle,
  ShieldAlert,
  UsersRound,
} from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AvatarStack } from '../components/AvatarStack'
import { CancelRegistrationSheet } from '../components/CancelRegistrationSheet'
import { CancelMissionSheet } from '../components/CancelMissionSheet'
import { DBuxAmount } from '../components/DBuxIcon'
import { JoinMissionSheet } from '../components/JoinMissionSheet'
import { useAuth } from '../auth/auth-context'
import {
  getMissionBySlug,
  getMissionPrivateDetails,
  getMissionViewerContext,
  getMySavedMissionIds,
  getMyRegistration,
  setMissionSaved,
} from '../services/missions'
import type { MissionPrivateDetails } from '../services/missions'
import type { MissionViewerContext } from '../services/missions'
import type { Mission } from '../types/mission'

const difficultyLabels = {
  standard: 'Standard',
  demanding: 'Soutenue',
  high: 'Élevée',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Casablanca',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Casablanca',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function MissionDetailsPage() {
  const { missionId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isSaved, setIsSaved] = useState(false)
  const [isJoined, setIsJoined] = useState(false)
  const [isJoinSheetOpen, setIsJoinSheetOpen] = useState(false)
  const [isCancelSheetOpen, setIsCancelSheetOpen] = useState(false)
  const [isMissionCancelSheetOpen, setIsMissionCancelSheetOpen] = useState(false)
  const [viewerState, setViewerState] = useState<MissionViewerContext & { key: string }>({ accountType: null, ownsMission: false, key: '' })
  const [mission, setMission] = useState<Mission | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [viewerErrorKey, setViewerErrorKey] = useState('')
  const [viewerAttempt, setViewerAttempt] = useState(0)
  const [currentTime, setCurrentTime] = useState(() => Date.now())
  const [privateDetails, setPrivateDetails] = useState<MissionPrivateDetails | null>(null)

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!missionId) return

    let isCurrent = true
    void Promise.resolve()
      .then(() => {
        if (!isCurrent) return null
        setIsLoading(true)
        setLoadError(false)
        return getMissionBySlug(missionId)
      })
      .then((remoteMission) => {
        if (!isCurrent) return
        setMission(remoteMission)
      })
      .catch(() => {
        if (!isCurrent) return
        setMission(null)
        setLoadError(true)
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [loadAttempt, missionId])

  useEffect(() => {
    if (!user || !mission?.databaseId) return

    let isCurrent = true
    const viewerKey = `${user.id}:${mission.databaseId}`
    void getMissionViewerContext(mission.databaseId)
      .then(async (context) => {
        if (!isCurrent) return
        setIsJoined(false)
        setIsSaved(false)
        setPrivateDetails(null)
        setViewerErrorKey('')

        if (context.accountType === 'volunteer') {
          const [registration, savedIds] = await Promise.all([
            getMyRegistration(mission.databaseId!),
            getMySavedMissionIds(),
          ])
          if (!isCurrent) return
          setIsSaved(savedIds.has(mission.databaseId!))
          if (registration) {
            setIsJoined(true)
            const details = await getMissionPrivateDetails(mission.databaseId!)
            if (!isCurrent) return
            setPrivateDetails(details)
          }
        } else if (context.accountType === 'ngo' && context.ownsMission) {
          const details = await getMissionPrivateDetails(mission.databaseId!)
          if (!isCurrent) return
          setPrivateDetails(details)
        }

        if (isCurrent) setViewerState({ ...context, key: viewerKey })
      })
      .catch(() => {
        if (isCurrent) setViewerErrorKey(viewerKey)
      })

    return () => { isCurrent = false }
  }, [mission?.databaseId, user, viewerAttempt])

  const toggleSaved = async () => {
    if (!user) {
      navigate(`/auth?mode=login&returnTo=${encodeURIComponent(`/missions/${mission?.id}`)}`)
      return
    }
    if (!mission?.databaseId) return

    const nextSaved = !isSaved
    setIsSaved(nextSaved)

    try {
      await setMissionSaved(mission.databaseId, nextSaved)
    } catch {
      setIsSaved(!nextSaved)
    }
  }

  if (isLoading) {
    return (
      <main className="grid min-h-dvh place-items-center bg-white">
        <span className="block size-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center bg-white p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Impossible de charger la mission</h1>
          <p className="mt-2 text-sm text-slate-500">Vérifiez votre connexion puis réessayez.</p>
          <button className="mt-6 min-h-12 rounded-full bg-sky-500 px-6 text-sm font-bold text-white" onClick={() => { setIsLoading(true); setLoadError(false); setLoadAttempt((attempt) => attempt + 1) }} type="button">Réessayer</button>
          <Link className="mt-4 block text-sm font-semibold text-slate-600" to="/explore">Retour à Explorer</Link>
        </div>
      </main>
    )
  }

  if (!mission) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center bg-white p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Mission introuvable</h1>
          <p className="mt-2 text-sm text-slate-500">
            Cette mission n’est plus disponible.
          </p>
          <Link
            className="mt-6 inline-flex rounded-full bg-sky-500 px-5 py-3 text-sm font-semibold text-white"
            to="/"
          >
            Retour à l’accueil
          </Link>
        </div>
      </main>
    )
  }

  const remainingPlaces =
    mission.capacity === null
      ? null
      : Math.max(mission.capacity - mission.registrationCount, 0)
  const currentViewerKey = user && mission.databaseId ? `${user.id}:${mission.databaseId}` : ''
  const viewerError = Boolean(currentViewerKey && viewerErrorKey === currentViewerKey)
  const hasCurrentViewerContext = Boolean(user && viewerState.key === currentViewerKey)
  const viewerContext = hasCurrentViewerContext
    ? viewerState
    : { accountType: null, ownsMission: false, key: '' }
  const isViewerContextLoading = Boolean(user && !hasCurrentViewerContext && !viewerError)
  const visiblePrivateDetails = hasCurrentViewerContext ? privateDetails : null
  const canVolunteerInteract = !user || viewerContext.accountType === 'volunteer'
  const hasStarted = new Date(mission.startsAt).getTime() <= currentTime
  const registrationClosed = new Date(mission.registrationDeadline).getTime() <= currentTime
  const isFull = remainingPlaces === 0
  const actionDisabled = hasStarted || (!isJoined && (registrationClosed || isFull))
  const actionLabel: ReactNode = isJoined
    ? hasStarted ? 'Mission commencée' : 'Gérer mon inscription'
    : hasStarted ? 'Mission commencée'
      : registrationClosed ? 'Inscriptions closes'
        : isFull ? 'Mission complète'
          : <>Participer · <DBuxAmount amount={mission.points} iconClassName="h-3.5 w-auto" /></>

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-white pb-28 text-slate-950 shadow-sm">
      <header className="relative h-[248px] overflow-hidden rounded-b-[28px] bg-slate-900">
        <img
          alt=""
          className="absolute inset-0 size-full object-cover"
          src={mission.coverImageUrl}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/55" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <button
            aria-label="Retour"
            className="grid size-11 place-items-center rounded-full bg-white/95 text-slate-800 shadow-sm"
            onClick={() => navigate(-1)}
            type="button"
          >
            <ArrowLeft aria-hidden="true" size={21} />
          </button>
          {canVolunteerInteract && !isViewerContextLoading && (
            <button
              aria-label={isSaved ? 'Retirer des favoris' : 'Enregistrer la mission'}
              aria-pressed={isSaved}
              className="grid size-11 place-items-center rounded-full bg-white/95 text-sky-500 shadow-sm"
              onClick={() => void toggleSaved()}
              type="button"
            >
              <Heart aria-hidden="true" fill={isSaved ? 'currentColor' : 'none'} size={21} />
            </button>
          )}
        </div>

        {mission.isUrgent && (
          <span className="absolute bottom-4 left-4 rounded-full bg-rose-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Mission urgente
          </span>
        )}
      </header>

      <main className="px-4 pt-5">
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600">
            {mission.category}
          </span>
          {mission.tags.map((tag) => (
            <span
              className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600"
              key={tag}
            >
              {tag}
            </span>
          ))}
        </div>

        <h1 className="mt-3 text-[28px] font-bold leading-[1.05] tracking-[-0.03em]">
          {mission.title}
        </h1>

        <div className="mt-4 flex w-full items-center gap-3 text-left">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sky-100 font-bold text-sky-700">
            {mission.ngoName.slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 text-sm font-semibold">
              <span className="truncate">{mission.ngoName}</span>
              <CheckCircle2 aria-label="ONG vérifiée" className="text-sky-500" size={16} />
            </span>
            <span className="text-xs text-slate-500">Organisation vérifiée</span>
          </span>
        </div>

        <section className="mt-5 grid grid-cols-2 gap-2" aria-label="Informations principales">
          <InfoCard
            icon={CalendarDays}
            label={formatDate(mission.startsAt)}
            value={`${formatTime(mission.startsAt)} – ${formatTime(mission.endsAt)}`}
          />
          <InfoCard
            icon={Clock3}
            label="Durée estimée"
            value={`${mission.activeDurationHours} heures`}
          />
          <InfoCard
            icon={UsersRound}
            label={remainingPlaces === null ? 'Places illimitées' : 'Places disponibles'}
            value={remainingPlaces === null ? 'Sans limite' : `${remainingPlaces} restantes`}
          />
          <InfoCard
            icon={Gauge}
            label={`Difficulté ${difficultyLabels[mission.difficulty].toLowerCase()}`}
            value={<DBuxAmount amount={mission.points} />}
            valueClassName="text-sky-600"
          />
        </section>

        <section className="mt-6" aria-labelledby="location-heading">
          <h2 className="text-lg font-bold" id="location-heading">
            Lieu approximatif
          </h2>
          <div className="relative mt-2 h-32 overflow-hidden rounded-[22px] border border-sky-100 bg-sky-50">
            <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(#7dd3fc_1px,transparent_1px),linear-gradient(90deg,#7dd3fc_1px,transparent_1px)] [background-size:28px_28px]" />
            <div className="absolute inset-0 grid place-items-center">
              <span className="grid size-11 place-items-center rounded-full bg-sky-500 text-white shadow-lg ring-8 ring-sky-200/60">
                <MapPin aria-hidden="true" size={21} />
              </span>
            </div>
            <div className="absolute inset-x-2 bottom-2 rounded-2xl bg-white/95 px-3 py-2 text-sm shadow-sm backdrop-blur">
              <span className="font-semibold">{mission.generalArea}</span>
              <span className="text-slate-500">, {mission.city}</span>
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {visiblePrivateDetails
              ? visiblePrivateDetails.meetingInstructions
              : 'L’adresse exacte et les instructions seront visibles après l’inscription.'}
          </p>
          {visiblePrivateDetails && (
            <div className="mt-3 rounded-[18px] bg-sky-50 p-3">
              <p className="text-xs font-semibold text-sky-700">Lieu de rendez-vous</p>
              <p className="mt-1 text-sm font-bold">{visiblePrivateDetails.exactAddress}</p>
            </div>
          )}
        </section>

        <ContentSection title="À propos de la mission">
          <p className="text-sm leading-6 text-slate-600">{mission.description}</p>
        </ContentSection>

        <ContentSection title="Conditions de participation">
          <ul className="space-y-3">
            {mission.requirements.map((requirement) => (
              <li className="flex gap-2.5 text-sm leading-5 text-slate-600" key={requirement}>
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-sky-50 text-sky-600">
                  <Check aria-hidden="true" size={13} strokeWidth={3} />
                </span>
                {requirement}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-3 rounded-2xl bg-slate-50 p-3">
            <Accessibility aria-hidden="true" className="shrink-0 text-sky-600" size={20} />
            <p className="text-xs leading-5 text-slate-600">{mission.accessibility}</p>
          </div>
        </ContentSection>

        <ContentSection title="Participants">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 p-3.5">
            <div>
              <p className="text-sm font-semibold">
                {mission.registrationCount}{' '}
                {mission.registrationCount === 1 ? 'bénévole inscrit' : 'bénévoles inscrits'}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{isJoined ? 'Vous participez à cette mission' : canVolunteerInteract ? 'Rejoignez cette équipe solidaire' : 'Inscriptions enregistrées pour cette mission'}</p>
            </div>
            <div className="rounded-full bg-slate-700 px-2 py-1.5">
              <AvatarStack count={mission.registrationCount} />
            </div>
          </div>
        </ContentSection>

        {canVolunteerInteract && <section className="mt-6 rounded-[22px] border border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-3">
            <ShieldAlert aria-hidden="true" className="shrink-0 text-amber-700" size={21} />
            <div>
              <h2 className="text-sm font-bold text-amber-950">Conditions d’annulation</h2>
              <p className="mt-1 text-xs leading-5 text-amber-900/75">
                Annulation gratuite avant la date limite. Une annulation tardive retire <DBuxAmount amount="10" iconClassName="h-3.5 w-auto" /> et une absence <DBuxAmount amount="25" iconClassName="h-3.5 w-auto" />.
              </p>
            </div>
          </div>
        </section>}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-md gap-2 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        {isViewerContextLoading ? (
          <div className="grid min-h-12 flex-1 place-items-center"><span className="size-6 animate-spin rounded-full border-2 border-sky-100 border-t-sky-500" /></div>
        ) : viewerError ? (
          <button className="min-h-12 flex-1 rounded-full bg-rose-50 px-5 text-sm font-bold text-rose-700" onClick={() => { setViewerErrorKey(''); setViewerAttempt((attempt) => attempt + 1) }} type="button">Réessayer la vérification du compte</button>
        ) : viewerContext.accountType === 'ngo' ? (
          viewerContext.ownsMission && mission.databaseId ? <div className="grid flex-1 grid-cols-2 gap-2">
            <Link className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-full bg-sky-500 px-3 text-center text-xs font-bold text-white" state={{ fromMission: true }} to={`/missions/${mission.databaseId}/chat`}><MessageCircle aria-hidden="true" size={17} />Ouvrir le groupe de discussion</Link>
            <Link className="grid min-h-12 place-items-center rounded-full bg-slate-100 px-3 text-center text-xs font-bold text-slate-700" to={`/ngo/missions/${mission.databaseId}/edit`}>Modifier la mission</Link>
            <Link className="grid min-h-12 place-items-center rounded-full bg-slate-100 px-3 text-center text-xs font-bold text-slate-700" to={`/ngo/missions/${mission.databaseId}/attendance`}>Gérer les présences</Link>
            {!hasStarted && <button className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-full border border-rose-200 text-xs font-bold text-rose-600" onClick={() => setIsMissionCancelSheetOpen(true)} type="button"><Ban aria-hidden="true" size={16} />Annuler la mission</button>}
          </div> : <Link className="grid min-h-12 flex-1 place-items-center rounded-full bg-sky-500 px-5 text-sm font-bold text-white" to="/ngo/dashboard">Retour à l’espace ONG</Link>
        ) : viewerContext.accountType === 'admin' ? (
          <Link className="grid min-h-12 flex-1 place-items-center rounded-full bg-slate-900 px-5 text-sm font-bold text-white" to="/admin">Retour aux validations</Link>
        ) : <>
          {isJoined && mission.databaseId && <Link aria-label="Ouvrir le groupe de discussion" className="grid size-12 shrink-0 place-items-center rounded-full border border-sky-500 text-sky-600" state={{ fromMission: true }} to={`/missions/${mission.databaseId}/chat`}><MessageCircle aria-hidden="true" size={20} /></Link>}
          <button
            aria-pressed={isSaved}
            className="grid size-12 shrink-0 place-items-center rounded-full border border-sky-500 text-sky-600"
            onClick={() => void toggleSaved()}
            type="button"
          >
            <Heart aria-hidden="true" fill={isSaved ? 'currentColor' : 'none'} size={20} />
            <span className="sr-only">Enregistrer</span>
          </button>
          <button
            className={`min-h-12 flex-1 rounded-full px-5 text-sm font-bold shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 ${
              isJoined
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-sky-500 text-white hover:bg-sky-600'
            }`}
            disabled={actionDisabled}
            onClick={() => {
              if (!user) {
                navigate(`/auth?mode=signup&returnTo=${encodeURIComponent(`/missions/${mission.id}`)}`)
                return
              }

              if (isJoined) setIsCancelSheetOpen(true)
              else setIsJoinSheetOpen(true)
            }}
            type="button"
          >
            {actionLabel}
          </button>
        </>}
      </div>

      {canVolunteerInteract && isJoinSheetOpen && (
        <JoinMissionSheet
          mission={mission}
          onClose={() => setIsJoinSheetOpen(false)}
          onJoined={(details) => {
            setIsJoined(true)
            setPrivateDetails(details)
            setMission((current) =>
              current
                ? { ...current, registrationCount: current.registrationCount + 1 }
                : current,
            )
          }}
        />
      )}
      {canVolunteerInteract && isCancelSheetOpen && (
        <CancelRegistrationSheet
          mission={mission}
          onCancelled={() => {
            setIsJoined(false)
            setPrivateDetails(null)
            setIsCancelSheetOpen(false)
            setMission((current) => current ? { ...current, registrationCount: Math.max(0, current.registrationCount - 1) } : current)
          }}
          onClose={() => setIsCancelSheetOpen(false)}
        />
      )}
      {viewerContext.accountType === 'ngo' && viewerContext.ownsMission && mission.databaseId && isMissionCancelSheetOpen && (
        <CancelMissionSheet
          missionId={mission.databaseId}
          missionTitle={mission.title}
          onCancelled={() => navigate('/ngo/missions', { replace: true })}
          onClose={() => setIsMissionCancelSheetOpen(false)}
        />
      )}
    </div>
  )
}

type InfoCardProps = {
  icon: typeof CalendarDays
  label: string
  value: ReactNode
  valueClassName?: string
}

function InfoCard({ icon: Icon, label, value, valueClassName = '' }: InfoCardProps) {
  return (
    <div className="min-h-24 rounded-[20px] border border-slate-200 p-3">
      <Icon aria-hidden="true" className="text-sky-500" size={19} />
      <p className="mt-2 line-clamp-1 text-[11px] text-slate-500">{label}</p>
      <p className={`mt-0.5 text-sm font-bold ${valueClassName}`}>{value}</p>
    </div>
  )
}

type ContentSectionProps = {
  children: React.ReactNode
  title: string
}

function ContentSection({ children, title }: ContentSectionProps) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-lg font-bold">{title}</h2>
      {children}
    </section>
  )
}
