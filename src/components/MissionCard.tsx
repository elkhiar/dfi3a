import { CalendarDays, Heart, MapPin } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Mission } from '../types/mission'
import { AvatarStack } from './AvatarStack'

type MissionCardProps = {
  mission: Mission
  variant?: 'urgent' | 'standard'
  isSaved?: boolean
  onSavedChange?: (saved: boolean) => void
  showSaveButton?: boolean
}

const categoryStyles: Record<string, string> = {
  Environnement: 'bg-emerald-600',
  Santé: 'bg-rose-500',
  Éducation: 'bg-violet-600',
}

function formatMissionDate(value: string) {
  const date = new Date(value)

  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Casablanca',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(date)
    .replace(' ', ' à ')
}

export function MissionCard({
  mission,
  variant = 'standard',
  isSaved: controlledSaved,
  onSavedChange,
  showSaveButton = true,
}: MissionCardProps) {
  const [localSaved, setLocalSaved] = useState(false)
  const isSaved = controlledSaved ?? localSaved
  const isUrgent = variant === 'urgent'

  const toggleSaved = () => {
    const nextSaved = !isSaved
    if (onSavedChange) onSavedChange(nextSaved)
    else setLocalSaved(nextSaved)
  }

  if (isUrgent) {
    return (
      <article className="w-full bg-white text-slate-950">
        <div className="group relative isolate aspect-[1.62] w-full overflow-hidden rounded-[26px] bg-slate-900 shadow-sm">
          <img
            alt=""
            className="absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-[1.02]"
            src={mission.coverImageUrl}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/20" />
          <Link
            aria-label={`Voir la mission ${mission.title}`}
            className="absolute inset-0 z-10 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white"
            to={`/missions/${mission.id}`}
          />

          <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3.5 pointer-events-none">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-rose-500 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                Urgent
              </span>
              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm">
                {mission.points} <span className="text-sky-500">✦</span>
              </span>
            </div>
            {showSaveButton && <button
              aria-label={isSaved ? 'Retirer des favoris' : 'Enregistrer la mission'}
              aria-pressed={isSaved}
              className="pointer-events-auto grid size-10 place-items-center rounded-full bg-white/95 text-slate-700 shadow-sm transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              onClick={toggleSaved}
              type="button"
            >
              <Heart aria-hidden="true" fill={isSaved ? 'currentColor' : 'none'} size={20} />
            </button>}
          </div>
        </div>

        <div className="px-0.5 pt-3">
          <Link className="relative z-10 block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600" to={`/missions/${mission.id}`}>
            <h3 className="text-[21px] font-bold leading-tight tracking-[-0.025em]">{mission.title}</h3>
          </Link>
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-sky-600">
            <CalendarDays aria-hidden="true" size={13} />
            {formatMissionDate(mission.startsAt)}
          </p>
          <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-slate-500">
            <MapPin aria-hidden="true" className="shrink-0" size={13} />
            {mission.generalArea}, {mission.city} · {mission.ngoName}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <AvatarStack count={mission.registrationCount} />
            <span className="text-xs font-semibold text-slate-700">
              {mission.registrationCount > 0
                ? `${mission.registrationCount} ${mission.registrationCount === 1 ? 'bénévole inscrit' : 'bénévoles inscrits'}`
                : 'Soyez le premier à participer'}
            </span>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article
      className={`group relative isolate shrink-0 overflow-hidden bg-slate-900 text-white shadow-sm ${
        isUrgent
          ? 'h-[236px] w-[calc(100vw-3.5rem)] max-w-[372px] rounded-[26px] shadow-md'
          : 'aspect-[0.88] w-full rounded-[22px]'
      }`}
    >
      <img
        alt=""
        className="absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-[1.02]"
        src={mission.coverImageUrl}
      />
      <div className={`absolute inset-0 ${isUrgent ? 'bg-gradient-to-b from-black/15 via-black/5 to-black/90' : 'bg-gradient-to-b from-black/10 via-black/5 to-black/90'}`} />
      <Link
        aria-label={`Voir la mission ${mission.title}`}
        className="absolute inset-0 z-10 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white"
        to={`/missions/${mission.id}`}
      />

      <div className={`absolute inset-x-0 top-0 flex items-start justify-between ${isUrgent ? 'p-3.5' : 'p-2.5'}`}>
        {isUrgent ? (
          <span className="rounded-full bg-rose-500 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide shadow-sm">
            Urgent
          </span>
        ) : (
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-800 shadow-sm">
            {mission.points} <span className="text-sky-500">✦</span>
          </span>
        )}

        {isUrgent ? (
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm">
            {mission.points} <span className="text-sky-500">✦</span>
          </span>
        ) : (
          showSaveButton ? <button
            aria-label={isSaved ? 'Retirer des favoris' : 'Enregistrer la mission'}
            aria-pressed={isSaved}
            className="relative z-20 grid size-9 place-items-center rounded-full bg-black/10 text-sky-300 backdrop-blur-sm transition hover:bg-black/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            onClick={toggleSaved}
            type="button"
          >
            <Heart
              aria-hidden="true"
              fill={isSaved ? 'currentColor' : 'none'}
              size={20}
            />
          </button> : <span />
        )}
      </div>

      <div className={`absolute inset-x-0 bottom-0 ${isUrgent ? 'p-4' : 'p-2.5'}`}>
        {!isUrgent && (
          <span
            className={`mb-1 inline-flex rounded-full px-2 py-0.5 text-[8px] font-semibold ${
              categoryStyles[mission.category] ?? 'bg-sky-600'
            }`}
          >
            {mission.category}
          </span>
        )}

        <h3
          className={`font-semibold leading-[0.98] tracking-[-0.02em] ${
            isUrgent ? 'line-clamp-2 max-w-[300px] text-[25px] leading-[0.95]' : 'line-clamp-2 text-base'
          }`}
        >
          {mission.title}
        </h3>

        <p className={`flex items-center gap-1 truncate text-white/85 ${isUrgent ? 'mt-2 text-[11px]' : 'mt-1 text-[9px]'}`}>
          <MapPin aria-hidden="true" className="shrink-0" size={isUrgent ? 12 : 10} />
          {mission.generalArea}, {mission.city}
        </p>
        <p className={`mt-0.5 flex items-center gap-1 font-medium text-sky-300 ${isUrgent ? 'text-[11px]' : 'text-[9px]'}`}>
          <CalendarDays aria-hidden="true" size={isUrgent ? 12 : 10} />
          {formatMissionDate(mission.startsAt)}
        </p>

        {!isUrgent && (
          <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-white/20 pt-1.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white text-[8px] font-bold text-sky-700">
                {mission.ngoName.slice(0, 1)}
              </span>
              <span className="truncate text-[8px] text-white/90">{mission.ngoName}</span>
            </div>
            <AvatarStack count={mission.registrationCount} />
          </div>
        )}

        {isUrgent && (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/20 pt-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-[9px] font-bold text-sky-700">
                {mission.ngoName.slice(0, 1)}
              </span>
              <span className="truncate text-[10px] text-white/90">{mission.ngoName}</span>
            </div>
            <AvatarStack count={mission.registrationCount} />
          </div>
        )}
      </div>
    </article>
  )
}
