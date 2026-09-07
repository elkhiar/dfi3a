import { ArrowLeft, Send, UserRound } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { canMessageUser, getFriendMessages, markFriendMessagesRead, sendFriendMessage, subscribeToFriendMessages } from '../services/messages'
import type { FriendMessage } from '../services/messages'
import { getPublicVolunteerProfile } from '../services/profiles'
import type { PublicVolunteerProfile } from '../services/profiles'
import { markConversationNotificationsRead } from '../services/notifications'

function formatTime(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export function FriendChatPage() {
  const { userId = '' } = useParams()
  const navigate = useNavigate()
  const { isLoading: isAuthLoading, user } = useAuth()
  const [friend, setFriend] = useState<PublicVolunteerProfile | null>(null)
  const [messages, setMessages] = useState<FriendMessage[]>([])
  const [draft, setDraft] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [canSend, setCanSend] = useState(false)
  const [accessDenied, setAccessDenied] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    const rows = await getFriendMessages(userId)
    setMessages(rows)
    await Promise.all([
      markFriendMessagesRead(userId),
      markConversationNotificationsRead(`/messages/${userId}`),
    ])
  }, [userId])

  useEffect(() => {
    if (!user || !userId) return
    let isCurrent = true
    let unsubscribe: (() => void) | undefined
    void Promise.all([canMessageUser(userId), getPublicVolunteerProfile(userId)])
      .then(async ([allowed, profile]) => {
        if (!isCurrent) return
        setCanSend(allowed)
        setFriend(profile)
        try {
          await refresh()
        } catch {
          if (!allowed) { setAccessDenied(true); return }
          throw new Error('conversation_load_failed')
        }
        if (isCurrent) unsubscribe = subscribeToFriendMessages(user.id, userId, () => void refresh())
      })
      .catch(() => { if (isCurrent) setErrorMessage('Impossible d’ouvrir cette conversation.') })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false; unsubscribe?.() }
  }, [refresh, user, userId])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ block: 'end' }) }, [messages])

  if (isAuthLoading) return <main className="grid min-h-dvh place-items-center bg-white"><span className="size-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></main>
  if (!user) return <Navigate replace to={`/auth?mode=login&returnTo=${encodeURIComponent(`/messages/${userId}`)}`} />
  if (!userId) return <Navigate replace to="/messages" />

  const send = async () => {
    const content = draft.trim()
    if (!content || !canSend || isSending) return
    setIsSending(true)
    setErrorMessage('')
    try {
      await sendFriendMessage(userId, content)
      setDraft('')
      await refresh()
    } catch {
      setErrorMessage('Le message n’a pas pu être envoyé.')
    } finally { setIsSending(false) }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <button aria-label="Retour aux messages" className="grid size-11 place-items-center rounded-full bg-slate-100" onClick={() => navigate('/messages')} type="button"><ArrowLeft aria-hidden="true" size={21} /></button>
        <button className="flex min-w-0 flex-1 items-center gap-3 text-left" disabled={!friend} onClick={() => friend && navigate(`/users/${friend.userId}`)} type="button"><span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-700 font-bold text-sky-300">{friend?.avatarUrl ? <img alt="" className="size-full object-cover" src={friend.avatarUrl} /> : friend?.displayName.slice(0, 1).toUpperCase() || <UserRound size={18} />}</span><span className="truncate text-sm font-bold">{friend?.displayName || 'Conversation'}</span></button>
      </header>

      {isLoading ? <div className="grid flex-1 place-items-center"><span className="size-9 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></div>
        : accessDenied ? <div className="grid flex-1 place-items-center p-6 text-center"><div><h1 className="text-xl font-bold">Messages limités aux amis</h1><p className="mt-2 text-sm leading-6 text-slate-500">Cette personne a choisi de recevoir uniquement les messages de ses amis.</p><button className="mt-5 min-h-11 rounded-full bg-sky-500 px-5 text-sm font-bold text-white" onClick={() => navigate(`/users/${userId}`)} type="button">Envoyer une demande d’ami</button></div></div>
          : <><section className="flex-1 px-4 py-5"><div className="space-y-3">{messages.length === 0 && <div className="py-20 text-center"><UserRound className="mx-auto text-sky-400" size={30} /><p className="mt-3 text-sm font-semibold text-slate-600">Envoyez votre premier message</p></div>}{messages.map((message) => { const isMine = message.senderUserId === user.id; return <article className={`flex ${isMine ? 'justify-end' : 'justify-start'}`} key={message.id}><div className={`max-w-[82%] rounded-[20px] px-4 py-3 shadow-sm ${isMine ? 'rounded-br-md bg-sky-500 text-white' : 'rounded-bl-md bg-white text-slate-800'}`}><p className="whitespace-pre-wrap break-words text-sm leading-5">{message.content}</p><time className={`mt-1.5 block text-right text-[10px] ${isMine ? 'text-sky-100' : 'text-slate-400'}`} dateTime={message.createdAt}>{formatTime(message.createdAt)}</time></div></article> })}<div ref={messagesEndRef} /></div></section><footer className="sticky bottom-0 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{errorMessage && <p className="mb-2 rounded-[14px] bg-rose-50 px-3 py-2 text-xs text-rose-700">{errorMessage}</p>}{canSend ? <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); void send() }}><textarea aria-label="Votre message" className="max-h-32 min-h-12 flex-1 resize-none rounded-[20px] border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500" maxLength={1000} onChange={(event) => setDraft(event.target.value)} placeholder="Écrire un message…" rows={1} value={draft} /><button aria-label="Envoyer" className="grid size-12 place-items-center rounded-full bg-sky-500 text-white disabled:bg-slate-200" disabled={!draft.trim() || isSending} type="submit"><Send aria-hidden="true" size={20} /></button></form> : <p className="rounded-[16px] bg-slate-100 p-3 text-center text-xs font-semibold text-slate-600">Cette personne accepte maintenant uniquement les messages de ses amis.</p>}</footer></>}
    </main>
  )
}
