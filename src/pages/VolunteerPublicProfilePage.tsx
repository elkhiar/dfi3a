import { ArrowLeft, CalendarDays, Check, MapPin, Trophy, UserMinus, UserPlus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { DBuxAmount } from '../components/DBuxIcon'
import {
  cancelFriendRequest,
  getFriendshipState,
  getPublicVolunteerProfile,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
} from '../services/profiles'
import type { FriendshipState, PublicVolunteerProfile } from '../services/profiles'

export function VolunteerPublicProfilePage() {
  const navigate = useNavigate()
  const { userId = '' } = useParams()
  const { user } = useAuth()
  const [profile, setProfile] = useState<PublicVolunteerProfile | null>(null)
  const [friendshipState, setFriendshipState] = useState<FriendshipState>('anonymous')
  const [isLoading, setIsLoading] = useState(true)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let isCurrent = true
    const requests: Promise<unknown>[] = [
      getPublicVolunteerProfile(userId).then((result) => { if (isCurrent) setProfile(result) }),
    ]
    if (user) requests.push(getFriendshipState(userId).then((state) => { if (isCurrent) setFriendshipState(state) }))
    void Promise.all(requests)
      .catch(() => { if (isCurrent) setLoadError(true) })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [user, userId])

  const runAction = async (action: () => Promise<FriendshipState>, successMessage: string) => {
    setIsActionLoading(true)
    setMessage('')
    try {
      const state = await action()
      setFriendshipState(state)
      setMessage(successMessage)
    } catch {
      setMessage('Cette action n’a pas pu être effectuée.')
    } finally {
      setIsActionLoading(false)
    }
  }

  const requestFriendship = () => {
    if (!user) {
      navigate(`/auth?mode=login&returnTo=${encodeURIComponent(`/users/${userId}`)}`)
      return
    }
    void runAction(() => sendFriendRequest(userId), 'Demande d’amitié envoyée.')
  }

  const cancelRequest = async () => {
    setIsActionLoading(true)
    setMessage('')
    try {
      await cancelFriendRequest(userId)
      setFriendshipState('none')
      setMessage('Demande annulée.')
    } catch {
      setMessage('Cette action n’a pas pu être effectuée.')
    } finally {
      setIsActionLoading(false)
    }
  }

  const removeFriendship = async () => {
    setIsActionLoading(true)
    setMessage('')
    try {
      await removeFriend(userId)
      setFriendshipState('none')
      setMessage('Cette personne a été retirée de vos amis.')
    } catch {
      setMessage('Cette action n’a pas pu être effectuée.')
    } finally {
      setIsActionLoading(false)
    }
  }

  if (isLoading) return <Loading />
  if (loadError) return <StatePage title="Profil indisponible" text="Vérifiez votre connexion puis réessayez." onBack={() => navigate(-1)} />
  if (!profile) return <StatePage title="Profil introuvable" text="Ce bénévole ne partage pas de profil public avec vous." onBack={() => navigate('/explore')} />

  const initials = profile.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const memberSince = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(profile.memberSince))

  return (
    <div className="pt-[max(0.5rem,env(safe-area-inset-top))]">
      <button aria-label="Retour" className="grid size-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-700" onClick={() => navigate(-1)} type="button"><ArrowLeft aria-hidden="true" size={20} /></button>

      <section className="mt-5 text-center">
        {profile.avatarUrl ? <img alt={`Photo de ${profile.displayName}`} className="mx-auto size-28 rounded-[34px] object-cover" src={profile.avatarUrl} /> : <span className="mx-auto grid size-28 place-items-center rounded-[34px] bg-slate-700 text-3xl font-bold text-sky-300">{initials || 'D'}</span>}
        <h1 className="mt-4 text-[27px] font-bold tracking-[-0.03em]">{profile.displayName}</h1>
        {profile.city && <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-slate-500"><MapPin aria-hidden="true" size={15} />{profile.city}</p>}
        <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-slate-400"><CalendarDays aria-hidden="true" size={13} />Membre depuis {memberSince}</p>
      </section>

      <FriendshipActions
        disabled={isActionLoading}
        onAccept={() => void runAction(() => respondFriendRequest(userId, true), 'Vous êtes maintenant amis.')}
        onAdd={requestFriendship}
        onCancel={() => void cancelRequest()}
        onReject={() => void runAction(() => respondFriendRequest(userId, false), 'Demande refusée.')}
        onRemove={() => void removeFriendship()}
        state={friendshipState}
      />
      {message && <p className="mt-3 text-center text-xs text-slate-500" role="status">{message}</p>}

      {profile.totalPoints != null && <section className="mt-6 flex items-center gap-3 rounded-[22px] bg-slate-700 p-4 text-white"><span className="grid size-12 place-items-center rounded-full bg-sky-300 text-slate-700"><Trophy aria-hidden="true" size={22} /></span><div><p className="text-xs text-white/60">D-bux vérifiés</p><p className="mt-0.5 text-2xl font-bold"><DBuxAmount amount={profile.totalPoints} iconClassName="h-6 w-auto" /></p></div></section>}

      <section className="mt-6">
        <h2 className="text-lg font-bold">À propos</h2>
        <p className="mt-3 whitespace-pre-line rounded-[22px] bg-slate-50 p-4 text-sm leading-6 text-slate-600">{profile.bio || 'Ce bénévole n’a pas encore ajouté de présentation.'}</p>
      </section>

      <p className="mt-6 rounded-[18px] bg-sky-50 p-4 text-xs leading-5 text-sky-800">L’historique des missions et les informations privées de cette personne ne sont pas affichés.</p>
    </div>
  )
}

function FriendshipActions({ disabled, onAccept, onAdd, onCancel, onReject, onRemove, state }: { disabled: boolean; onAccept: () => void; onAdd: () => void; onCancel: () => void; onReject: () => void; onRemove: () => void; state: FriendshipState }) {
  if (state === 'self') return <div className="mt-5 rounded-full bg-slate-100 py-3 text-center text-sm font-bold text-slate-600">Votre profil public</div>
  if (state === 'friends') return <button className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-slate-300 text-sm font-bold text-slate-700 disabled:opacity-60" disabled={disabled} onClick={onRemove} type="button"><UserMinus aria-hidden="true" size={18} />Retirer de mes amis</button>
  if (state === 'outgoing_pending') return <button className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-slate-300 text-sm font-bold text-slate-600 disabled:opacity-60" disabled={disabled} onClick={onCancel} type="button"><X aria-hidden="true" size={18} />Annuler la demande</button>
  if (state === 'incoming_pending') return <div className="mt-5 grid grid-cols-2 gap-2"><button className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-300 text-sm font-bold text-slate-600 disabled:opacity-60" disabled={disabled} onClick={onReject} type="button"><X aria-hidden="true" size={18} />Refuser</button><button className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-sky-500 text-sm font-bold text-white disabled:opacity-60" disabled={disabled} onClick={onAccept} type="button"><Check aria-hidden="true" size={18} />Accepter</button></div>
  return <button className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-sky-500 text-sm font-bold text-white disabled:opacity-60" disabled={disabled} onClick={onAdd} type="button"><UserPlus aria-hidden="true" size={18} />Ajouter en ami</button>
}

function Loading() {
  return <div className="grid min-h-72 place-items-center"><span className="size-9 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></div>
}

function StatePage({ onBack, text, title }: { onBack: () => void; text: string; title: string }) {
  return <div className="grid min-h-72 place-items-center px-5 text-center"><div><h1 className="text-xl font-bold">{title}</h1><p className="mt-2 text-sm text-slate-500">{text}</p><button className="mt-5 min-h-11 rounded-full bg-sky-500 px-5 text-sm font-bold text-white" onClick={onBack} type="button">Retour</button></div></div>
}
