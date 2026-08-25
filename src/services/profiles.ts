import { supabase } from '../lib/supabase'

export type VolunteerProfile = {
  userId: string
  firstName: string
  lastName: string
  birthdate: string
  city: string
  bio: string
  showInParticipants: boolean
  showInLeaderboard: boolean
  showCity: boolean
}

export type PointsSummary = {
  totalPoints: number
  monthlyPoints: number
  completedMissions: number
}

export type LeaderboardEntry = {
  rank: number
  userId: string
  displayName: string
  city: string | null
  points: number
  isCurrentUser: boolean
}

export async function getMyProfile(): Promise<VolunteerProfile> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) throw new Error('authentication_required')

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'user_id, first_name, last_name, birthdate, city, bio, show_in_participants, show_in_leaderboard, show_city',
    )
    .eq('user_id', authData.user.id)
    .single()

  if (error) throw error

  return {
    userId: data.user_id,
    firstName: data.first_name ?? '',
    lastName: data.last_name ?? '',
    birthdate: data.birthdate ?? '',
    city: data.city ?? '',
    bio: data.bio ?? '',
    showInParticipants: data.show_in_participants,
    showInLeaderboard: data.show_in_leaderboard,
    showCity: data.show_city,
  }
}

export async function updateMyProfile(
  userId: string,
  changes: Omit<VolunteerProfile, 'userId'>,
) {
  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: changes.firstName,
      last_name: changes.lastName,
      birthdate: changes.birthdate || null,
      city: changes.city,
      bio: changes.bio || null,
      show_in_participants: changes.showInParticipants,
      show_in_leaderboard: changes.showInLeaderboard,
      show_city: changes.showCity,
    })
    .eq('user_id', userId)

  if (error) throw error
}

export async function getMyPointsSummary(): Promise<PointsSummary> {
  const { data, error } = await supabase.rpc('get_my_points_summary')
  if (error) throw error

  const row = data?.[0]
  return {
    totalPoints: Number(row?.total_points ?? 0),
    monthlyPoints: Number(row?.monthly_points ?? 0),
    completedMissions: Number(row?.completed_missions ?? 0),
  }
}

export async function getLeaderboard(period: 'month' | 'all'): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_leaderboard', { p_period: period })
  if (error) throw error

  return (data ?? []).map((row: Record<string, any>) => ({
    rank: Number(row.rank),
    userId: row.user_id,
    displayName: row.display_name || 'Bénévole dfi3a',
    city: row.city,
    points: Number(row.points),
    isCurrentUser: row.is_current_user,
  }))
}
