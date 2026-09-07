import { supabase } from '../lib/supabase'
import { getAvatarPublicUrl } from './profiles'
import { getNgoLogoPublicUrl } from './ngos'

export type MissionChatContext = {
  missionId: string
  missionSlug: string
  missionTitle: string
  missionEndsAt: string
  missionStatus: 'draft' | 'published' | 'completed' | 'cancelled'
  viewerRole: 'volunteer' | 'ngo' | 'admin' | 'unknown'
  canRead: boolean
  canSend: boolean
  canModerate: boolean
}

export type MissionChatMessage = {
  id: string
  authorUserId: string
  authorDisplayName: string
  authorRole: 'volunteer' | 'ngo' | 'admin'
  authorAvatarUrl: string | null
  authorProfilePath: string | null
  content: string
  createdAt: string
}

export async function getMissionChatContext(missionId: string): Promise<MissionChatContext> {
  const { data, error } = await supabase.rpc('get_mission_chat_context', {
    p_mission_id: missionId,
  })
  if (error) throw error
  const row = data?.[0]
  if (!row) throw new Error('mission_not_found')

  return {
    missionId: row.mission_id,
    missionSlug: row.mission_slug,
    missionTitle: row.mission_title,
    missionEndsAt: row.mission_ends_at,
    missionStatus: row.mission_status,
    viewerRole: row.viewer_role,
    canRead: row.can_read,
    canSend: row.can_send,
    canModerate: row.can_moderate,
  }
}

export async function getMissionChatMessages(missionId: string) {
  const { data, error } = await supabase.rpc('get_mission_chat_messages_v2', {
    p_mission_id: missionId,
    p_limit: 100,
  })
  if (error) throw error

  return (data ?? []).map((row: Record<string, any>) => ({
    id: row.message_id,
    authorUserId: row.author_user_id,
    authorDisplayName: row.author_display_name,
    authorRole: row.author_role,
    authorAvatarUrl: row.author_role === 'ngo'
      ? getNgoLogoPublicUrl(row.author_avatar_path)
      : getAvatarPublicUrl(row.author_avatar_path),
    authorProfilePath: row.author_role === 'ngo' && row.author_ngo_id
      ? `/ngos/${row.author_ngo_id}`
      : row.author_role === 'volunteer' ? `/users/${row.author_user_id}` : null,
    content: row.content,
    createdAt: row.created_at,
  })) as MissionChatMessage[]
}

export async function sendMissionChatMessage(missionId: string, content: string) {
  const { data, error } = await supabase.rpc('send_mission_chat_message', {
    p_mission_id: missionId,
    p_content: content,
  })
  if (error) throw error
  return data as string
}

export async function reportMissionChatMessage(messageId: string, reason: string) {
  const { error } = await supabase.rpc('report_mission_chat_message', {
    p_message_id: messageId,
    p_reason: reason,
  })
  if (error) throw error
}

export async function moderateMissionChatMessage(messageId: string) {
  const { error } = await supabase.rpc('moderate_mission_chat_message', {
    p_message_id: messageId,
  })
  if (error) throw error
}

export function subscribeToMissionChat(missionId: string, onChange: () => void) {
  const channel = supabase
    .channel(`mission-chat-${missionId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'mission_chat_messages', filter: `mission_id=eq.${missionId}` },
      onChange,
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
