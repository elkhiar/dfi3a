import type { MissionParticipantPreview } from '../types/mission'

type AvatarStackProps = {
  count: number
  participants: MissionParticipantPreview[]
}

function getInitials(displayName: string) {
  return displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('') || 'D'
}

export function AvatarStack({ count, participants }: AvatarStackProps) {
  const visibleParticipants = participants.slice(0, 3)
  if (visibleParticipants.length === 0) return null

  return (
    <div
      className="flex items-center"
      aria-label={`${count} participant${count === 1 ? '' : 's'} inscrit${count === 1 ? '' : 's'}, ${visibleParticipants.length} affiché${visibleParticipants.length === 1 ? '' : 's'}`}
    >
      {visibleParticipants.map((participant, index) => (
        <span
          className={`grid size-6 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-sky-100 text-[8px] font-bold text-sky-800 ${index > 0 ? '-ml-1.5' : ''}`}
          key={`${participant.displayName}-${index}`}
          title={participant.displayName}
        >
          {participant.avatarUrl ? (
            <img
              alt={participant.displayName}
              className="size-full object-cover"
              loading="lazy"
              src={participant.avatarUrl}
            />
          ) : (
            <span aria-hidden="true">{getInitials(participant.displayName)}</span>
          )}
        </span>
      ))}
      {count > visibleParticipants.length && (
        <span className="-ml-1 grid size-6 place-items-center rounded-full border-2 border-white bg-slate-700 text-[8px] font-bold text-white">
          +{count - visibleParticipants.length}
        </span>
      )}
    </div>
  )
}
