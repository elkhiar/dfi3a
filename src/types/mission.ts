export type MissionDifficulty = 'standard' | 'demanding' | 'high'

export type MissionParticipantPreview = {
  displayName: string
  avatarUrl: string | null
}

export type Mission = {
  id: string
  databaseId?: string
  title: string
  summary: string
  description: string
  category: string
  tags: string[]
  city: string
  generalArea: string
  approximateLatitude?: number | null
  approximateLongitude?: number | null
  startsAt: string
  endsAt: string
  activeDurationHours: number
  registrationDeadline: string
  difficulty: MissionDifficulty
  points: number
  isUrgent: boolean
  capacity: number | null
  registrationCount: number
  participantPreviews: MissionParticipantPreview[]
  ngoName: string
  coverImageUrl: string
  requirements: string[]
  accessibility: string
}
