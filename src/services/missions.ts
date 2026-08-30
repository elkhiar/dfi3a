import { supabase } from '../lib/supabase'
import { getCategoryIllustrationPath } from '../lib/category-illustrations'
import type { Mission } from '../types/mission'

export type MissionPrivateDetails = {
  exactAddress: string
  meetingInstructions: string
  organizerContact: string
}

export type MissionViewerContext = {
  accountType: 'volunteer' | 'ngo' | 'admin' | null
  ownsMission: boolean
}

export type VolunteerMissionHistoryEntry = {
  registrationId: string
  missionSlug: string
  missionTitle: string
  categoryName: string
  city: string
  generalArea: string
  startsAt: string
  endsAt: string
  coverImageUrl: string
  ngoName: string
  missionStatus: 'draft' | 'published' | 'completed' | 'cancelled'
  registrationStatus: 'joined' | 'cancelled'
  attendanceStatus: 'not_verified' | 'present' | 'absent'
  pointsApplied: number
  cancellationReason: string
}

export function mapMissionRow(row: Record<string, any>): Mission {
  return {
    id: row.slug,
    databaseId: row.id,
    title: row.title,
    summary: row.summary,
    description: row.description,
    category: row.category_name,
    tags: row.tags ?? [],
    city: row.city,
    generalArea: row.general_area,
    approximateLatitude:
      row.approximate_latitude === undefined ? undefined : Number(row.approximate_latitude),
    approximateLongitude:
      row.approximate_longitude === undefined ? undefined : Number(row.approximate_longitude),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    activeDurationHours: row.active_duration_minutes / 60,
    registrationDeadline: row.registration_deadline,
    difficulty: row.difficulty,
    points: row.total_points,
    isUrgent: row.is_urgent,
    capacity: row.capacity,
    registrationCount: row.registration_count,
    ngoName: row.ngo_name,
    coverImageUrl: row.cover_image_path || getCategoryIllustrationPath(row.category_name || 'other'),
    requirements: row.requirements ?? [],
    accessibility: row.accessibility ?? 'Aucune information d’accessibilité fournie.',
  }
}

export async function getMissionBySlug(slug: string): Promise<Mission | null> {
  const { data, error } = await supabase.rpc('get_public_mission', { p_slug: slug })

  if (error) throw error

  const row = data?.[0]
  if (!row) return null

  return mapMissionRow(row)
}

export async function getMissionViewerContext(missionId: string): Promise<MissionViewerContext> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) return { accountType: null, ownsMission: false }

  const [{ data: profile, error: profileError }, { data: missionRow, error: missionError }] = await Promise.all([
    supabase.from('profiles').select('account_type').eq('user_id', authData.user.id).single(),
    supabase.from('missions').select('ngo_id').eq('id', missionId).single(),
  ])
  if (profileError) throw profileError
  if (missionError) throw missionError

  const accountType = profile.account_type as MissionViewerContext['accountType']
  if (accountType !== 'ngo') return { accountType, ownsMission: false }

  const { data: ngo, error: ngoError } = await supabase
    .from('ngos')
    .select('id')
    .eq('owner_user_id', authData.user.id)
    .maybeSingle()
  if (ngoError) throw ngoError

  return { accountType, ownsMission: ngo?.id === missionRow.ngo_id }
}

export async function getPublicMissions(): Promise<Mission[]> {
  const { data, error } = await supabase.rpc('get_public_missions')
  if (error) throw error
  const now = Date.now()
  return (data ?? [])
    .map((row: Record<string, any>) => mapMissionRow(row))
    .filter((mission: Mission) => new Date(mission.endsAt).getTime() > now)
}

export async function setMissionSaved(missionId: string, saved: boolean) {
  const { error } = await supabase.rpc('set_mission_saved', {
    p_mission_id: missionId,
    p_saved: saved,
  })

  if (error) throw error
  return saved
}

export async function getMySavedMissionIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from('saved_missions').select('mission_id')
  if (error) throw error
  return new Set((data ?? []).map((row) => row.mission_id))
}

export async function getMySavedMissions(): Promise<Mission[]> {
  const { data, error } = await supabase
    .from('saved_missions')
    .select('saved_at, missions!inner(slug)')
    .order('saved_at', { ascending: false })

  if (error) throw error

  const slugs = (data ?? [])
    .map((row) => {
      const relatedMission = Array.isArray(row.missions) ? row.missions[0] : row.missions
      return relatedMission?.slug
    })
    .filter((slug): slug is string => Boolean(slug))

  const missions = await Promise.all(slugs.map((slug) => getMissionBySlug(slug)))
  return missions.filter((mission): mission is Mission => mission !== null)
}

export async function getMyRegistration(missionId: string) {
  const { data, error } = await supabase
    .from('registrations')
    .select('id, status')
    .eq('mission_id', missionId)
    .eq('status', 'joined')
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getMissionPrivateDetails(
  missionId: string,
): Promise<MissionPrivateDetails | null> {
  const { data, error } = await supabase
    .from('mission_private_details')
    .select('exact_address, meeting_instructions, organizer_contact')
    .eq('mission_id', missionId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    exactAddress: data.exact_address,
    meetingInstructions: data.meeting_instructions,
    organizerContact: data.organizer_contact,
  }
}

export async function getMyJoinedMissions(): Promise<Mission[]> {
  const { data, error } = await supabase
    .from('registrations')
    .select('joined_at, missions!inner(slug)')
    .eq('status', 'joined')

  if (error) throw error

  const slugs = (data ?? [])
    .map((row) => {
      const relatedMission = Array.isArray(row.missions) ? row.missions[0] : row.missions
      return relatedMission?.slug
    })
    .filter((slug): slug is string => Boolean(slug))

  const missions = await Promise.all(slugs.map((slug) => getMissionBySlug(slug)))

  return missions
    .filter((mission): mission is Mission => mission !== null)
    .filter((mission) => new Date(mission.endsAt).getTime() > Date.now())
    .sort(
      (first, second) =>
        new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime(),
    )
}

export async function getMyMissionHistory(): Promise<VolunteerMissionHistoryEntry[]> {
  const { data, error } = await supabase.rpc('get_my_mission_history')
  if (error) throw error

  return (data ?? []).map((row: Record<string, any>) => ({
    registrationId: row.registration_id,
    missionSlug: row.mission_slug,
    missionTitle: row.mission_title,
    categoryName: row.category_name,
    city: row.city,
    generalArea: row.general_area,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    coverImageUrl: row.cover_image_path || getCategoryIllustrationPath(row.category_name || 'other'),
    ngoName: row.ngo_name,
    missionStatus: row.mission_status,
    registrationStatus: row.registration_status,
    attendanceStatus: row.attendance_status,
    pointsApplied: Number(row.points_applied),
    cancellationReason: row.cancellation_reason ?? '',
  }))
}
