import { Bell } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { getUnreadNotificationCount } from '../services/notifications'

export function NotificationBell({ className = '' }: { className?: string }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshCount = useCallback(() => {
    if (!user) return

    void getUnreadNotificationCount()
      .then(setUnreadCount)
      .catch(() => setUnreadCount(0))
  }, [user])

  useEffect(() => {
    refreshCount()
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshCount()
    }
    window.addEventListener('dfi3a:notifications-changed', refreshCount)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.removeEventListener('dfi3a:notifications-changed', refreshCount)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [refreshCount])

  const visibleUnreadCount = user ? unreadCount : 0

  return (
    <button
      aria-label={visibleUnreadCount > 0 ? `${visibleUnreadCount} notifications non lues` : 'Notifications'}
      className={`relative grid size-9 shrink-0 place-items-center rounded-full text-slate-600 ${className}`}
      onClick={() => navigate(user ? '/notifications' : '/auth?mode=login&returnTo=%2Fnotifications')}
      type="button"
    >
      <Bell aria-hidden="true" size={20} />
      {visibleUnreadCount > 0 && (
        <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">
          {visibleUnreadCount > 99 ? '99+' : visibleUnreadCount}
        </span>
      )}
    </button>
  )
}
