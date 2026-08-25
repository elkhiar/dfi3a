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
}: MissionCardProps) {
  const [localSaved, setLocalSaved] = useState(false)
  const isSaved = controlledSaved ?? localSaved
  const isUrgent = variant === 'urgent'

  const toggleSaved = () => {
    const nextSaved = !isSaved
    if (onSavedChange) onSavedChange(nextSaved)
    else setLocalSaved(nextSaved)
  }

  return (
    <article
      className={`group relative isolate shrink-0 overflow-hidden bg-slate-900 text-white shadow-sm ${
        isUrgent
          ? 'h-[154px] w-[260px] rounded-[20px]'
          : 'aspect-[0.88] w-full rounded-[22px]'
      }`}
    >
      <img
        alt=""
        className="absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-[1.02]"
        src={mission.coverImageUrl}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/5 to-black/90" />
      <Link
        aria-label={`Voir la mission ${mission.title}`}
        className="absolute inset-0 z-10 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white"
        to={`/missions/${mission.id}`}
      />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
        {isUrgent ? (
          <span className="rounded-full bg-rose-500 px-2 py-1 text-[9px] font-bold uppercase tracking-wide">
            Urgent
          </span>
        ) : (
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-800 shadow-sm">
            {mission.points} <span className="text-sky-500">✦</span>
          </span>
        )}

        {isUrgent ? (
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-800 shadow-sm">
            {mission.points} <span className="text-sky-500">✦</span>
          </span>
        ) : (
          <button
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
          </button>
        )}
      </div>

      <div className={`absolute inset-x-0 bottom-0 ${isUrgent ? 'p-3' : 'p-2.5'}`}>
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
            isUrgent ? 'max-w-[210px] text-xl' : 'line-clamp-2 text-base'
          }`}
        >
          {mission.title}
        </h3>

        <p className="mt-1 flex items-center gap-1 truncate text-[9px] text-white/85">
          <MapPin aria-hidden="true" className="shrink-0" size={10} />
          {mission.generalArea}, {mission.city}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[9px] font-medium text-sky-300">
          <CalendarDays aria-hidden="true" size={10} />
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
          <div className="absolute bottom-3 right-3">
            <AvatarStack count={mission.registrationCount} />
          </div>
        )}
      </div>
    </article>
  )
}
