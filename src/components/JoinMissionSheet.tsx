import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  MapPin,
  ShieldAlert,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { getMissionPrivateDetails } from '../services/missions'
import type { MissionPrivateDetails } from '../services/missions'
import { joinMission, JoinMissionError } from '../services/registrations'
import type { Mission } from '../types/mission'

type JoinStep = 'confirm' | 'conflict' | 'success'

type JoinMissionSheetProps = {
  mission: Mission
  onClose: () => void
  onJoined: (details: MissionPrivateDetails | null) => void
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Casablanca',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function JoinMissionSheet({ mission, onClose, onJoined }: JoinMissionSheetProps) {
  const [step, setStep] = useState<JoinStep>('confirm')
  const [acceptedRequirements, setAcceptedRequirements] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [privateDetails, setPrivateDetails] = useState<MissionPrivateDetails | null>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose])

  const completeJoin = async (acceptScheduleConflict: boolean) => {
    if (!mission.databaseId) {
      setErrorMessage('Cette mission n’est pas encore synchronisée avec la base de données.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      await joinMission(mission.databaseId, acceptScheduleConflict)
      const details = await getMissionPrivateDetails(mission.databaseId)
      setPrivateDetails(details)
      onJoined(details)
      setStep('success')
    } catch (error) {
      if (
        error instanceof JoinMissionError &&
        error.code === 'schedule_conflict' &&
        !acceptScheduleConflict
      ) {
        setStep('conflict')
        return
      }

      const messages: Record<string, string> = {
        already_joined: 'Vous participez déjà à cette mission.',
        mission_full: 'Cette mission est complète.',
        mission_not_available: 'Cette mission n’est plus disponible.',
        registration_closed: 'La période d’inscription est terminée.',
        mission_already_started: 'Cette mission a déjà commencé.',
        volunteer_account_required: 'Un compte bénévole est nécessaire pour participer.',
      }

      setErrorMessage(
        error instanceof JoinMissionError
          ? messages[error.code] || 'L’inscription a échoué. Veuillez réessayer.'
          : 'L’inscription a échoué. Veuillez réessayer.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 px-0 sm:px-4">
      <button
        aria-label="Fermer"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />

      <section
        aria-labelledby="join-sheet-title"
        aria-modal="true"
        className="relative z-10 max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[28px] sm:mb-4"
        role="dialog"
      >
        <div className="mx-auto mb-4 h-1 w-11 rounded-full bg-slate-200" />
        <button
          aria-label="Fermer"
          className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-slate-100 text-slate-600"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" size={19} />
        </button>

        {step === 'confirm' && (
          <>
            <p className="text-xs font-bold uppercase tracking-wide text-sky-600">
              Confirmation
            </p>
            <h2 className="mt-1 pr-12 text-2xl font-bold tracking-tight" id="join-sheet-title">
              Participer à cette mission ?
            </h2>

            <div className="mt-5 flex gap-3 rounded-[20px] bg-slate-50 p-3">
              <img
                alt=""
                className="size-20 shrink-0 rounded-[16px] object-cover"
                src={mission.coverImageUrl}
              />
              <div className="min-w-0 py-0.5">
                <p className="line-clamp-2 text-sm font-bold leading-4">{mission.title}</p>
                <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
                  <CalendarDays aria-hidden="true" size={13} />
                  {formatShortDate(mission.startsAt)}
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <MapPin aria-hidden="true" size={13} />
                  {mission.generalArea}, {mission.city}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-[18px] border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Récompense</p>
                <p className="mt-1 font-bold text-sky-600">{mission.points} points</p>
              </div>
              <div className="rounded-[18px] border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Durée estimée</p>
                <p className="mt-1 font-bold">{mission.activeDurationHours} heures</p>
              </div>
            </div>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[20px] border border-slate-200 p-4">
              <input
                checked={acceptedRequirements}
                className="peer sr-only"
                onChange={(event) => setAcceptedRequirements(event.target.checked)}
                type="checkbox"
              />
              <span className="grid size-6 shrink-0 place-items-center rounded-md border-2 border-slate-300 text-white peer-checked:border-sky-500 peer-checked:bg-sky-500">
                {acceptedRequirements && <Check aria-hidden="true" size={15} strokeWidth={3} />}
              </span>
              <span className="text-sm leading-5 text-slate-600">
                Je confirme avoir lu les conditions de participation et être disponible aux horaires indiqués.
              </span>
            </label>

            <div className="mt-4 flex gap-3 rounded-[18px] bg-amber-50 p-3">
              <ShieldAlert aria-hidden="true" className="shrink-0 text-amber-700" size={19} />
              <p className="text-xs leading-5 text-amber-900/80">
                Annulation tardive : −10 points. Absence non signalée : −25 points.
              </p>
            </div>

            <button
              className="mt-5 min-h-12 w-full rounded-full bg-sky-500 px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              disabled={!acceptedRequirements || isSubmitting}
              onClick={() => void completeJoin(false)}
              type="button"
            >
              {isSubmitting ? 'Inscription…' : 'Confirmer ma participation'}
            </button>
            {errorMessage && (
              <p className="mt-3 text-center text-sm text-rose-700" role="alert">
                {errorMessage}
              </p>
            )}
          </>
        )}

        {step === 'conflict' && (
          <>
            <span className="grid size-12 place-items-center rounded-full bg-amber-100 text-amber-700">
              <Clock3 aria-hidden="true" size={23} />
            </span>
            <h2 className="mt-4 pr-12 text-2xl font-bold tracking-tight" id="join-sheet-title">
              Conflit d’horaire
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Cette mission chevauche une autre mission à laquelle vous participez déjà.
            </p>

            <div className="mt-5 rounded-[20px] border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold text-amber-800">Mission existante</p>
              <p className="mt-1 text-sm font-bold">Distribution alimentaire solidaire</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
                <CalendarDays aria-hidden="true" size={14} />
                12 septembre · 11:00 – 14:00
              </p>
            </div>

            <button
              className="mt-5 min-h-12 w-full rounded-full bg-sky-500 px-5 text-sm font-bold text-white disabled:opacity-60"
              disabled={isSubmitting}
              onClick={() => void completeJoin(true)}
              type="button"
            >
              {isSubmitting ? 'Inscription…' : 'M’inscrire quand même'}
            </button>
            {errorMessage && (
              <p className="mt-3 text-center text-sm text-rose-700" role="alert">
                {errorMessage}
              </p>
            )}
            <button
              className="mt-2 min-h-12 w-full rounded-full text-sm font-semibold text-slate-600"
              onClick={onClose}
              type="button"
            >
              Annuler
            </button>
          </>
        )}

        {step === 'success' && (
          <div className="text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 aria-hidden="true" size={29} />
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight" id="join-sheet-title">
              Inscription confirmée !
            </h2>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-600">
              La mission apparaît maintenant dans Mes événements. Les informations privées sont disponibles sur sa page.
            </p>

            <div className="mt-5 rounded-[20px] bg-sky-50 p-4 text-left">
              <p className="text-xs font-semibold text-sky-700">Lieu de rendez-vous</p>
              <p className="mt-1 text-sm font-bold">
                {privateDetails?.exactAddress || 'Adresse disponible sur la page de la mission'}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                {privateDetails?.meetingInstructions ||
                  'Consultez les informations privées de la mission.'}
              </p>
            </div>

            <button
              className="mt-5 min-h-12 w-full rounded-full bg-sky-500 px-5 text-sm font-bold text-white"
              onClick={onClose}
              type="button"
            >
              Voir la mission
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
