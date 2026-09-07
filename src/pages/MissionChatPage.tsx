import { ArrowLeft, Flag, MessageCircle, Send, ShieldCheck, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import {
  getMissionChatContext,
  getMissionChatMessages,
  moderateMissionChatMessage,
  reportMissionChatMessage,
  sendMissionChatMessage,
  subscribeToMissionChat,
} from '../services/mission-chat'
import type { MissionChatContext, MissionChatMessage } from '../services/mission-chat'
import { markConversationNotificationsRead } from '../services/notifications'

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Casablanca',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function MissionChatPage() {
  const { missionId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { isLoading: isAuthLoading, user } = useAuth()
  const [context, setContext] = useState<MissionChatContext | null>(null)
  const [messages, setMessages] = useState<MissionChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [reportTarget, setReportTarget] = useState<MissionChatMessage | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [isReporting, setIsReporting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const refreshMessages = async (targetMissionId: string) => {
    try {
      const nextMessages = await getMissionChatMessages(targetMissionId)
      setMessages(nextMessages)
    } catch {
      setErrorMessage('Impossible de mettre la conversation à jour.')
    }
  }

  useEffect(() => {
    if (!user || !missionId) return
    let isCurrent = true
    let unsubscribe: (() => void) | undefined

    void getMissionChatContext(missionId)
      .then(async (nextContext) => {
        if (!isCurrent) return
        setContext(nextContext)
        if (!nextContext.canRead) return
        const nextMessages = await getMissionChatMessages(missionId)
        if (!isCurrent) return
        setMessages(nextMessages)
        const notificationPath = `/missions/${nextContext.missionSlug}/chat`
        void markConversationNotificationsRead(notificationPath).catch(() => undefined)
        unsubscribe = subscribeToMissionChat(missionId, () => {
          void refreshMessages(missionId)
          void markConversationNotificationsRead(notificationPath).catch(() => undefined)
        })
      })
      .catch(() => {
        if (isCurrent) setErrorMessage('Impossible d’ouvrir le groupe de discussion.')
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
      unsubscribe?.()
    }
  }, [missionId, user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  if (isAuthLoading) return <main className="grid min-h-dvh place-items-center bg-white"><span className="size-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></main>
  if (!user) return <Navigate replace to={`/auth?mode=login&returnTo=${encodeURIComponent(`/missions/${missionId}/chat`)}`} />
  if (!missionId) return <Navigate replace to="/" />

  const sendMessage = async () => {
    const content = draft.trim()
    if (!content || !context?.canSend || isSending) return
    setIsSending(true)
    setErrorMessage('')
    try {
      await sendMissionChatMessage(missionId, content)
      setDraft('')
      await refreshMessages(missionId)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setErrorMessage(message.includes('chat_rate_limited')
        ? 'Attendez deux secondes avant d’envoyer un autre message.'
        : 'Le message n’a pas pu être envoyé.')
    } finally {
      setIsSending(false)
    }
  }

  const submitReport = async () => {
    if (!reportTarget || reportReason.trim().length < 3) return
    setIsReporting(true)
    try {
      await reportMissionChatMessage(reportTarget.id, reportReason.trim())
      setReportTarget(null)
      setReportReason('')
    } catch {
      setErrorMessage('Le signalement n’a pas pu être envoyé.')
    } finally {
      setIsReporting(false)
    }
  }

  const removeMessage = async (message: MissionChatMessage) => {
    if (!context?.canModerate || !window.confirm('Supprimer ce message du groupe ?')) return
    try {
      await moderateMissionChatMessage(message.id)
      setMessages((current) => current.filter((item) => item.id !== message.id))
    } catch {
      setErrorMessage('Le message n’a pas pu être supprimé.')
    }
  }

  const backPath = `/missions/${context?.missionSlug ?? missionId}`
  const goBackToMission = () => {
    if (location.state?.fromMission === true) {
      navigate(-1)
      return
    }

    navigate(backPath, { replace: true })
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-slate-50 text-slate-950 shadow-sm">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <button aria-label="Retour à la mission" className="grid size-11 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700" onClick={goBackToMission} type="button"><ArrowLeft aria-hidden="true" size={21} /></button>
        <div className="min-w-0 flex-1"><p className="text-[11px] font-semibold text-sky-600">Groupe de la mission</p><h1 className="truncate text-base font-bold">{context?.missionTitle ?? 'Discussion'}</h1></div>
        {context?.canModerate && <span aria-label="Vous modérez ce groupe" className="grid size-9 place-items-center rounded-full bg-sky-50 text-sky-700" title="Modérateur"><ShieldCheck aria-hidden="true" size={19} /></span>}
      </header>

      {isLoading ? (
        <div className="grid flex-1 place-items-center"><span className="size-9 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></div>
      ) : !context?.canRead ? (
        <div className="grid flex-1 place-items-center p-6 text-center"><div><span className="mx-auto grid size-16 place-items-center rounded-full bg-sky-100 text-sky-700"><MessageCircle aria-hidden="true" size={28} /></span><h2 className="mt-5 text-xl font-bold">Groupe réservé aux participants</h2><p className="mt-2 text-sm leading-6 text-slate-500">Inscrivez-vous à cette mission pour accéder à sa discussion.</p><button className="mt-6 min-h-12 rounded-full bg-sky-500 px-6 text-sm font-bold text-white" onClick={goBackToMission} type="button">Voir la mission</button></div></div>
      ) : (
        <>
          <section className="flex-1 px-4 py-5" aria-label="Messages du groupe">
            <div className="mb-5 rounded-[18px] bg-sky-50 p-3 text-center text-xs leading-5 text-sky-800">Ce groupe sert à l’organisation de la mission. Aucun fichier ou message privé n’est autorisé.</div>
            {messages.length === 0 ? (
              <div className="grid min-h-56 place-items-center text-center"><div><MessageCircle className="mx-auto text-sky-400" size={30} /><h2 className="mt-3 font-bold">Lancez la conversation</h2><p className="mt-1 text-sm text-slate-500">Posez une question ou partagez une information utile.</p></div></div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => {
                  const isMine = message.authorUserId === user.id
                  const authorProfilePath = isMine
                    ? message.authorRole === 'ngo' ? '/ngo/profile' : message.authorRole === 'volunteer' ? '/profile' : null
                    : message.authorProfilePath
                  return (
                    <article className={`flex ${isMine ? 'justify-end' : 'justify-start'}`} key={message.id}>
                      <div className={`max-w-[86%] rounded-[20px] px-3.5 py-3 shadow-sm ${isMine ? 'rounded-br-md bg-sky-500 text-white' : 'rounded-bl-md bg-white text-slate-800'}`}>
                        <div className="flex items-center justify-between gap-4">
                          <button className={`flex min-w-0 items-center gap-2 text-left ${authorProfilePath ? 'cursor-pointer' : 'cursor-default'}`} disabled={!authorProfilePath} onClick={() => authorProfilePath && navigate(authorProfilePath)} type="button">
                            <span className={`grid size-7 shrink-0 place-items-center overflow-hidden rounded-full text-[10px] font-bold ${isMine ? 'bg-white/20 text-white' : 'bg-slate-700 text-sky-300'}`}>{message.authorAvatarUrl ? <img alt="" className="size-full object-cover" src={message.authorAvatarUrl} /> : message.authorDisplayName.slice(0, 1).toUpperCase()}</span>
                            <span className={`truncate text-[11px] font-bold underline-offset-2 ${authorProfilePath ? 'hover:underline' : ''} ${isMine ? 'text-sky-50' : message.authorRole === 'ngo' ? 'text-sky-700' : 'text-slate-500'}`}>{message.authorDisplayName}{message.authorRole === 'ngo' ? ' · ONG' : ''}</span>
                          </button>
                          <div className="flex items-center gap-1">{!isMine && <button aria-label="Signaler le message" className="grid size-7 place-items-center rounded-full text-slate-400" onClick={() => { setReportTarget(message); setReportReason('') }} type="button"><Flag aria-hidden="true" size={13} /></button>}{context.canModerate && <button aria-label="Supprimer le message" className={`grid size-7 place-items-center rounded-full ${isMine ? 'text-white/80' : 'text-rose-400'}`} onClick={() => void removeMessage(message)} type="button"><Trash2 aria-hidden="true" size={14} /></button>}</div>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5">{message.content}</p>
                        <time className={`mt-1.5 block text-right text-[10px] ${isMine ? 'text-sky-100' : 'text-slate-400'}`} dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                      </div>
                    </article>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </section>

          <footer className="sticky bottom-0 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {errorMessage && <p className="mb-2 rounded-[14px] bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">{errorMessage}</p>}
            {context.canSend ? (
              <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); void sendMessage() }}>
                <label className="sr-only" htmlFor="chat-message">Votre message</label>
                <textarea className="max-h-32 min-h-12 flex-1 resize-none rounded-[20px] border border-slate-300 px-4 py-3 text-sm outline-none focus:border-sky-500" id="chat-message" maxLength={1000} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage() } }} placeholder="Écrire au groupe…" rows={1} value={draft} />
                <button aria-label="Envoyer" className="grid size-12 shrink-0 place-items-center rounded-full bg-sky-500 text-white disabled:bg-slate-200" disabled={!draft.trim() || isSending} type="submit"><Send aria-hidden="true" size={20} /></button>
              </form>
            ) : <p className="rounded-[16px] bg-slate-100 p-3 text-center text-xs font-semibold text-slate-600">Discussion en lecture seule : la mission est terminée, annulée ou votre inscription n’est plus active.</p>}
          </footer>
        </>
      )}

      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-3" role="presentation">
          <section aria-labelledby="report-title" aria-modal="true" className="w-full max-w-md rounded-[26px] bg-white p-5 shadow-xl" role="dialog">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold" id="report-title">Signaler ce message</h2><button aria-label="Fermer" className="grid size-10 place-items-center rounded-full bg-slate-100" onClick={() => setReportTarget(null)} type="button"><X aria-hidden="true" size={18} /></button></div>
            <p className="mt-2 line-clamp-3 rounded-[16px] bg-slate-50 p-3 text-sm text-slate-600">{reportTarget.content}</p>
            <label className="mt-4 block text-sm font-bold" htmlFor="report-reason">Pourquoi le signalez-vous ?</label>
            <textarea className="mt-2 min-h-24 w-full resize-none rounded-[16px] border border-slate-300 p-3 text-sm outline-none focus:border-sky-500" id="report-reason" maxLength={300} onChange={(event) => setReportReason(event.target.value)} placeholder="Message inapproprié, harcèlement, information trompeuse…" value={reportReason} />
            <button className="mt-3 min-h-12 w-full rounded-full bg-rose-500 text-sm font-bold text-white disabled:bg-slate-200" disabled={reportReason.trim().length < 3 || isReporting} onClick={() => void submitReport()} type="button">{isReporting ? 'Envoi…' : 'Envoyer le signalement'}</button>
          </section>
        </div>
      )}
    </main>
  )
}
