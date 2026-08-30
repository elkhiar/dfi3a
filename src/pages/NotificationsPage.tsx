import {
  ArrowLeft,
  Bell,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarX2,
  CheckCheck,
  ShieldCheck,
  Siren,
  UserPlus,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notifications'
import type { NotificationRecord } from '../services/notifications'

const relativeTime = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

function formatNotificationTime(value: string) {
  const elapsedSeconds = Math.round((new Date(value).getTime() - Date.now()) / 1000)
  if (Math.abs(elapsedSeconds) < 60) return relativeTime.format(elapsedSeconds, 'second')
  const elapsedMinutes = Math.round(elapsedSeconds / 60)
  if (Math.abs(elapsedMinutes) < 60) return relativeTime.format(elapsedMinutes, 'minute')
  const elapsedHours = Math.round(elapsedMinutes / 60)
  if (Math.abs(elapsedHours) < 24) return relativeTime.format(elapsedHours, 'hour')
  const elapsedDays = Math.round(elapsedHours / 24)
  if (Math.abs(elapsedDays) < 7) return relativeTime.format(elapsedDays, 'day')
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value))
}

function NotificationIcon({ type }: { type: string }) {
  const Icon = type.startsWith('attendance_')
    ? type === 'attendance_present' ? CalendarCheck : CalendarX2
    : type === 'mission_cancelled' ? CalendarX2
      : type === 'mission_updated' ? CalendarClock
        : type === 'registration_joined' || type === 'registration_confirmed' || type === 'registration_cancelled' ? UserPlus
          : type.startsWith('urgency_') ? Siren
            : type.startsWith('ngo_application_') ? Building2
              : ShieldCheck

  return <Icon aria-hidden="true" size={20} />
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const { accountType, isAccountTypeLoading, isLoading: isAuthLoading, user } = useAuth()
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const requestNotifications = () => {
    void getMyNotifications()
      .then(setNotifications)
      .catch(() => setErrorMessage('Impossible de charger vos notifications.'))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    if (user) requestNotifications()
  }, [user])

  const retryNotifications = () => {
    setIsLoading(true)
    setErrorMessage('')
    requestNotifications()
  }

  if (isAuthLoading || (user && isAccountTypeLoading)) {
    return <main className="grid min-h-dvh place-items-center bg-white"><span className="size-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></main>
  }
  if (!user) return <Navigate replace to="/auth?mode=login&returnTo=%2Fnotifications" />

  const backPath = accountType === 'ngo' ? '/ngo/dashboard' : accountType === 'admin' ? '/admin' : '/'
  const unreadCount = notifications.filter((notification) => !notification.readAt).length

  const openNotification = async (notification: NotificationRecord) => {
    if (!notification.readAt) {
      const readAt = new Date().toISOString()
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt } : item))
      try {
        await markNotificationRead(notification.id)
      } catch {
        requestNotifications()
        return
      }
    }
    if (notification.actionPath?.startsWith('/')) navigate(notification.actionPath)
  }

  const markEverythingRead = async () => {
    const readAt = new Date().toISOString()
    const previous = notifications
    setNotifications((current) => current.map((notification) => ({ ...notification, readAt: notification.readAt ?? readAt })))
    try {
      await markAllNotificationsRead()
    } catch {
      setNotifications(previous)
      setErrorMessage('Les notifications n’ont pas pu être marquées comme lues.')
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md bg-slate-50 px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] text-slate-950">
      <header className="flex min-h-12 items-center justify-between gap-3">
        <button aria-label="Retour" className="grid size-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-700" onClick={() => navigate(backPath)} type="button"><ArrowLeft aria-hidden="true" size={21} /></button>
        {unreadCount > 0 && <button className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-sky-700" onClick={() => void markEverythingRead()} type="button"><CheckCheck aria-hidden="true" size={17} />Tout lire</button>}
      </header>

      <div className="mt-5">
        <p className="text-xs font-semibold text-sky-600">Votre activité</p>
        <h1 className="mt-1 text-[28px] font-bold">Notifications</h1>
        <p className="mt-1 text-sm text-slate-500">{unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Vous êtes à jour'}</p>
      </div>

      {errorMessage && <div className="mt-5 rounded-[18px] bg-rose-50 p-4 text-sm text-rose-700" role="alert"><p>{errorMessage}</p><button className="mt-2 min-h-10 font-bold" onClick={retryNotifications} type="button">Réessayer</button></div>}

      {isLoading ? (
        <div className="grid min-h-56 place-items-center"><span className="size-9 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></div>
      ) : notifications.length === 0 ? (
        <div className="mt-6 rounded-[24px] bg-white p-8 text-center shadow-sm"><span className="mx-auto grid size-14 place-items-center rounded-full bg-sky-50 text-sky-600"><Bell aria-hidden="true" size={25} /></span><h2 className="mt-4 font-bold">Aucune notification</h2><p className="mt-1 text-sm leading-6 text-slate-500">Les inscriptions, décisions et changements importants apparaîtront ici.</p></div>
      ) : (
        <section className="mt-5 space-y-2" aria-label="Liste des notifications">
          {notifications.map((notification) => (
            <button className={`flex w-full items-start gap-3 rounded-[20px] p-4 text-left shadow-sm transition ${notification.readAt ? 'bg-white' : 'bg-sky-50 ring-1 ring-sky-100'}`} key={notification.id} onClick={() => void openNotification(notification)} type="button">
              <span className={`grid size-10 shrink-0 place-items-center rounded-full ${notification.readAt ? 'bg-slate-100 text-slate-500' : 'bg-sky-500 text-white'}`}><NotificationIcon type={notification.type} /></span>
              <span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><strong className="text-sm">{notification.title}</strong>{!notification.readAt && <span aria-label="Non lue" className="mt-1.5 size-2 shrink-0 rounded-full bg-sky-500" />}</span><span className="mt-1 block text-sm leading-5 text-slate-600">{notification.body}</span><time className="mt-2 block text-[11px] font-semibold text-slate-400" dateTime={notification.createdAt}>{formatNotificationTime(notification.createdAt)}</time></span>
            </button>
          ))}
        </section>
      )}
    </main>
  )
}
