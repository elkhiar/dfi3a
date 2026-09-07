import { MessageCircle, MessagesSquare } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { getMyInboxConversations } from '../services/messages'
import type { InboxConversation } from '../services/messages'
import { subscribeToMyNotifications } from '../services/notifications'

type InboxFilter = 'all' | 'mission' | 'friend'

const filters: Array<{ id: InboxFilter; label: string }> = [
  { id: 'all', label: 'Tous' },
  { id: 'mission', label: 'Missions' },
  { id: 'friend', label: 'Privés' },
]

function formatConversationTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date)
  }
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(date)
}

export function MessagesPage() {
  const { isLoading: isAuthLoading, user } = useAuth()
  const [filter, setFilter] = useState<InboxFilter>('all')
  const [conversations, setConversations] = useState<InboxConversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!user) return
    let isCurrent = true
    void getMyInboxConversations()
      .then((rows) => { if (isCurrent) setConversations(rows) })
      .catch(() => { if (isCurrent) setErrorMessage('Impossible de charger vos conversations.') })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    const unsubscribe = subscribeToMyNotifications(user.id, () => {
      void getMyInboxConversations().then((rows) => { if (isCurrent) setConversations(rows) })
    })
    return () => { isCurrent = false; unsubscribe() }
  }, [user])

  const visibleConversations = useMemo(() => filter === 'all'
    ? conversations
    : conversations.filter((conversation) => conversation.kind === filter), [conversations, filter])

  if (isAuthLoading) return <div className="grid min-h-72 place-items-center"><span className="size-9 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></div>
  if (!user) return <Navigate replace to="/auth?mode=login&returnTo=%2Fmessages" />

  return (
    <div className="pt-[max(0.5rem,env(safe-area-inset-top))]">
      <p className="text-xs font-semibold text-sky-600">Vos conversations</p>
      <h1 className="mt-1 text-[28px] font-bold tracking-[-0.03em]">Messages</h1>
      <p className="mt-1 text-sm leading-5 text-slate-500">Échangez en privé ou avec les participants de vos missions.</p>

      <nav aria-label="Filtrer les conversations" className="mt-5 flex rounded-full bg-slate-100 p-1">
        {filters.map((item) => <button aria-pressed={filter === item.id} className={`min-h-10 flex-1 rounded-full text-xs font-bold transition ${filter === item.id ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'}`} key={item.id} onClick={() => setFilter(item.id)} type="button">{item.label}</button>)}
      </nav>

      {isLoading ? <div className="grid min-h-72 place-items-center"><span className="size-9 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></div>
        : errorMessage ? <p className="mt-6 rounded-[20px] bg-rose-50 p-4 text-sm text-rose-700">{errorMessage}</p>
          : visibleConversations.length === 0 ? <div className="mt-6 rounded-[24px] bg-slate-50 p-8 text-center"><MessagesSquare className="mx-auto text-sky-500" size={30} /><h2 className="mt-3 font-bold">Aucune conversation</h2><p className="mt-1 text-sm leading-5 text-slate-500">Rejoignez une mission ou ouvrez le profil d’un utilisateur pour commencer à discuter.</p></div>
            : <section className="mt-5 space-y-2" aria-label="Liste des conversations">{visibleConversations.map((conversation) => <ConversationRow conversation={conversation} key={conversation.id} />)}</section>}
    </div>
  )
}

function ConversationRow({ conversation }: { conversation: InboxConversation }) {
  return (
    <Link className="flex min-h-20 items-center gap-3 rounded-[22px] border border-slate-100 bg-white p-3 shadow-sm transition active:scale-[0.99]" to={conversation.actionPath}>
      <span className="relative grid size-14 shrink-0 place-items-center overflow-visible rounded-[18px] bg-sky-50 text-sky-600">
        {conversation.primaryAvatarUrl ? <img alt="" className="size-full rounded-[18px] object-cover" src={conversation.primaryAvatarUrl} /> : <MessageCircle aria-hidden="true" size={23} />}
        {conversation.kind === 'mission' && <span className="absolute -bottom-1 -right-1 grid size-7 place-items-center overflow-hidden rounded-full border-2 border-white bg-slate-700 text-[10px] font-bold text-sky-300">{conversation.secondaryAvatarUrl ? <img alt="" className="size-full object-cover" src={conversation.secondaryAvatarUrl} /> : <MessageCircle aria-hidden="true" size={13} />}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2"><strong className="truncate text-sm">{conversation.title}</strong>{conversation.kind === 'mission' && <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-700">Mission</span>}</span>
        <span className="mt-1 block truncate text-xs text-slate-500">{conversation.subtitle}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-2"><time className="text-[10px] font-semibold text-slate-400" dateTime={conversation.latestAt ?? undefined}>{formatConversationTime(conversation.latestAt)}</time>{conversation.unreadCount > 0 && <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-sky-500 px-1 text-[9px] font-bold text-white">{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</span>}</span>
    </Link>
  )
}
