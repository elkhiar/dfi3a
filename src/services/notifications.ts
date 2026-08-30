import { supabase } from '../lib/supabase'

export type NotificationRecord = {
  id: string
  type: string
  title: string
  body: string
  actionPath: string | null
  missionId: string | null
  ngoId: string | null
  readAt: string | null
  createdAt: string
}

type NotificationRow = {
  id: string
  type: string
  title: string
  body: string
  action_path: string | null
  mission_id: string | null
  ngo_id: string | null
  read_at: string | null
  created_at: string
}

const announceNotificationChange = () => {
  window.dispatchEvent(new Event('dfi3a:notifications-changed'))
}

export async function getMyNotifications() {
  const { data, error } = await supabase
    .from('notifications')
    .select('id,type,title,body,action_path,mission_id,ngo_id,read_at,created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error

  return ((data ?? []) as NotificationRow[]).map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    actionPath: row.action_path,
    missionId: row.mission_id,
    ngoId: row.ngo_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  })) satisfies NotificationRecord[]
}

export async function getUnreadNotificationCount() {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)

  if (error) throw error
  return count ?? 0
}

export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  })
  if (error) throw error
  announceNotificationChange()
}

export async function markAllNotificationsRead() {
  const { error } = await supabase.rpc('mark_all_notifications_read')
  if (error) throw error
  announceNotificationChange()
}
