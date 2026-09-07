import { supabase } from '../lib/supabase'

export type VolunteerProfile = {
  userId: string
  firstName: string
  lastName: string
  birthdate: string
  city: string
  bio: string
  avatarPath: string
  showInDirectory: boolean
  messagesFromFriendsOnly: boolean
  showInParticipants: boolean
  showInLeaderboard: boolean
  showCity: boolean
}

export type PublicVolunteer = {
  userId: string
  displayName: string
  city: string | null
  bio: string | null
  avatarUrl: string | null
}

export type FriendshipState = 'anonymous' | 'self' | 'none' | 'outgoing_pending' | 'incoming_pending' | 'friends'

export type PublicVolunteerProfile = PublicVolunteer & {
  memberSince: string
  totalPoints: number | null
}

export type FriendConnection = PublicVolunteer & {
  relationshipState: Exclude<FriendshipState, 'anonymous' | 'self' | 'none'>
  relationshipUpdatedAt: string
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
  avatarUrl: string | null
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
      'user_id, first_name, last_name, birthdate, city, bio, avatar_path, show_in_directory, messages_from_friends_only, show_in_participants, show_in_leaderboard, show_city',
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
    avatarPath: data.avatar_path ?? '',
    showInDirectory: data.show_in_directory ?? true,
    messagesFromFriendsOnly: data.messages_from_friends_only ?? false,
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
      avatar_path: changes.avatarPath || null,
      show_in_directory: changes.showInDirectory,
      messages_from_friends_only: changes.messagesFromFriendsOnly,
      show_in_participants: changes.showInParticipants,
      show_in_leaderboard: changes.showInLeaderboard,
      show_city: changes.showCity,
    })
    .eq('user_id', userId)

  if (error) throw error
}

export function getAvatarPublicUrl(path: string | null | undefined) {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  return supabase.storage.from('profile-avatars').getPublicUrl(path).data.publicUrl
}

export async function uploadProfileAvatar(userId: string, file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from('profile-avatars').upload(path, file, {
    cacheControl: '3600',
  })
  if (error) throw error
  return path
}

export async function deleteProfileAvatar(path: string) {
  if (!path || /^https?:\/\//i.test(path)) return
  const { error } = await supabase.storage.from('profile-avatars').remove([path])
  if (error) throw error
}

export async function searchPublicVolunteers(query: string): Promise<PublicVolunteer[]> {
  const { data, error } = await supabase.rpc('search_public_volunteers', {
    p_query: query.trim(),
  })
  if (error) throw error

  return (data ?? []).map((row: Record<string, any>) => ({
    userId: row.user_id,
    displayName: row.display_name,
    city: row.city,
    bio: row.bio,
    avatarUrl: getAvatarPublicUrl(row.avatar_path),
  }))
}

export async function getPublicVolunteerProfile(userId: string): Promise<PublicVolunteerProfile | null> {
  const { data, error } = await supabase.rpc('get_public_volunteer_profile', { p_user_id: userId })
  if (error) throw error
  const row = data?.[0] as Record<string, any> | undefined
  if (!row) return null
  return {
    userId: row.user_id,
    displayName: row.display_name,
    city: row.city,
    bio: row.bio,
    avatarUrl: getAvatarPublicUrl(row.avatar_path),
    memberSince: row.member_since,
    totalPoints: row.total_points == null ? null : Number(row.total_points),
  }
}

export async function getFriendshipState(userId: string): Promise<FriendshipState> {
  const { data, error } = await supabase.rpc('get_friendship_state', { p_other_user_id: userId })
  if (error) throw error
  return (data ?? 'none') as FriendshipState
}

export async function sendFriendRequest(userId: string): Promise<FriendshipState> {
  const { data, error } = await supabase.rpc('send_friend_request', { p_recipient_user_id: userId })
  if (error) throw error
  return data as FriendshipState
}

export async function respondFriendRequest(requesterUserId: string, accept: boolean): Promise<FriendshipState> {
  const { data, error } = await supabase.rpc('respond_friend_request', {
    p_requester_user_id: requesterUserId,
    p_accept: accept,
  })
  if (error) throw error
  return data as FriendshipState
}

export async function cancelFriendRequest(recipientUserId: string) {
  const { data, error } = await supabase.rpc('cancel_friend_request', { p_recipient_user_id: recipientUserId })
  if (error) throw error
  return Boolean(data)
}

export async function removeFriend(otherUserId: string) {
  const { data, error } = await supabase.rpc('remove_friend', { p_other_user_id: otherUserId })
  if (error) throw error
  return Boolean(data)
}

export async function getMyFriendConnections(): Promise<FriendConnection[]> {
  const { data, error } = await supabase.rpc('get_my_friend_connections')
  if (error) throw error
  return (data ?? []).map((row: Record<string, any>) => ({
    userId: row.user_id,
    displayName: row.display_name,
    city: row.city,
    bio: row.bio,
    avatarUrl: getAvatarPublicUrl(row.avatar_path),
    relationshipState: row.relationship_state,
    relationshipUpdatedAt: row.relationship_updated_at,
  }))
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
    avatarUrl: getAvatarPublicUrl(row.avatar_path),
    points: Number(row.points),
    isCurrentUser: row.is_current_user,
  }))
}
