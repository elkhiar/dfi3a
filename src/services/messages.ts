import { supabase } from '../lib/supabase'
import { getAvatarPublicUrl } from './profiles'
import { getNgoLogoPublicUrl } from './ngos'

export type InboxConversation = {
  id: string
  kind: 'mission' | 'friend'
  title: string
  subtitle: string
  primaryAvatarUrl: string | null
  secondaryAvatarUrl: string | null
  actionPath: string
  latestAt: string | null
  unreadCount: number
}

export type FriendMessage = {
  id: string
  senderUserId: string
  content: string
  createdAt: string
  readAt: string | null
}

export async function getMyInboxConversations(): Promise<InboxConversation[]> {
  const [{ data: missionRows, error: missionError }, { data: friendRows, error: friendError }] = await Promise.all([
    supabase.rpc('get_my_mission_conversations'),
    supabase.rpc('get_my_friend_conversations'),
  ])
  if (missionError) throw missionError
  if (friendError) throw friendError

  const missions: InboxConversation[] = (missionRows ?? []).map((row: Record<string, any>) => ({
    id: `mission-${row.mission_id}`,
    kind: 'mission',
    title: row.mission_title,
    subtitle: row.latest_content || 'Aucun message pour le moment',
    primaryAvatarUrl: getNgoLogoPublicUrl(row.ngo_logo_path),
    secondaryAvatarUrl: row.latest_author_role === 'ngo'
      ? getNgoLogoPublicUrl(row.latest_author_avatar_path)
      : getAvatarPublicUrl(row.latest_author_avatar_path),
    actionPath: `/missions/${row.mission_slug}/chat`,
    latestAt: row.latest_at,
    unreadCount: Number(row.unread_count ?? 0),
  }))

  const friends: InboxConversation[] = (friendRows ?? []).map((row: Record<string, any>) => ({
    id: `friend-${row.friend_user_id}`,
    kind: 'friend',
    title: row.display_name || 'Ami dfi3a',
    subtitle: row.latest_content || 'Commencez la conversation',
    primaryAvatarUrl: getAvatarPublicUrl(row.avatar_path),
    secondaryAvatarUrl: null,
    actionPath: `/messages/${row.friend_user_id}`,
    latestAt: row.latest_at,
    unreadCount: Number(row.unread_count ?? 0),
  }))

  return [...missions, ...friends].sort((first, second) => {
    if (!first.latestAt) return 1
    if (!second.latestAt) return -1
    return new Date(second.latestAt).getTime() - new Date(first.latestAt).getTime()
  })
}

export async function getFriendMessages(friendUserId: string): Promise<FriendMessage[]> {
  const { data, error } = await supabase.rpc('get_friend_messages', {
    p_friend_user_id: friendUserId,
    p_limit: 150,
  })
  if (error) throw error
  return (data ?? []).map((row: Record<string, any>) => ({
    id: row.message_id,
    senderUserId: row.sender_user_id,
    content: row.content,
    createdAt: row.created_at,
    readAt: row.read_at,
  }))
}

export async function canMessageUser(userId: string) {
  const { data, error } = await supabase.rpc('can_message_user', { p_recipient_user_id: userId })
  if (error) throw error
  return Boolean(data)
}

export async function sendFriendMessage(friendUserId: string, content: string) {
  const { data, error } = await supabase.rpc('send_friend_message', {
    p_friend_user_id: friendUserId,
    p_content: content,
  })
  if (error) throw error
  return data as string
}

export async function markFriendMessagesRead(friendUserId: string) {
  const { error } = await supabase.rpc('mark_friend_messages_read', {
    p_friend_user_id: friendUserId,
  })
  if (error) throw error
}

export function subscribeToFriendMessages(userId: string, friendUserId: string, onChange: () => void) {
  const channel = supabase
    .channel(`friend-messages-${userId}-${friendUserId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_messages', filter: `sender_user_id=eq.${friendUserId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_messages', filter: `recipient_user_id=eq.${friendUserId}` }, onChange)
    .subscribe()

  return () => { void supabase.removeChannel(channel) }
}
