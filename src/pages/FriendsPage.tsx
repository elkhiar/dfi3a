import { ArrowLeft, Check, Clock3, MapPin, UserRoundCheck, UsersRound, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import {
  cancelFriendRequest,
  getMyFriendConnections,
  respondFriendRequest,
} from '../services/profiles'
import type { FriendConnection } from '../services/profiles'

type FriendsTab = 'friends' | 'requests'

export function FriendsPage() {
  const navigate = useNavigate()
  const { isLoading: isAuthLoading, user } = useAuth()
  const [connections, setConnections] = useState<FriendConnection[]>([])
  const [activeTab, setActiveTab] = useState<FriendsTab>('friends')
  const [isLoading, setIsLoading] = useState(true)
  const [actionUserId, setActionUserId] = useState('')
  const [loadError, setLoadError] = useState(false)
  const [actionMessage, setActionMessage] = useState('')

  const loadConnections = () => {
    void getMyFriendConnections()
      .then(setConnections)
      .catch(() => setLoadError(true))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    if (user) loadConnections()
  }, [user])

  const grouped = useMemo(() => ({
    friends: connections.filter((connection) => connection.relationshipState === 'friends'),
    requests: connections.filter((connection) => connection.relationshipState !== 'friends'),
  }), [connections])

  const respond = async (connection: FriendConnection, accept: boolean) => {
    setActionUserId(connection.userId)
    setActionMessage('')
    try {
      await respondFriendRequest(connection.userId, accept)
      loadConnections()
    } catch {
      setActionMessage('Cette demande n’a pas pu être mise à jour.')
    } finally {
      setActionUserId('')
    }
  }

  const cancel = async (connection: FriendConnection) => {
    setActionUserId(connection.userId)
    setActionMessage('')
    try {
      await cancelFriendRequest(connection.userId)
      loadConnections()
    } catch {
      setActionMessage('Cette demande n’a pas pu être annulée.')
    } finally {
      setActionUserId('')
    }
  }

  if (isAuthLoading) return <Loading />
  if (!user) return <Navigate replace to="/auth?mode=login&returnTo=%2Ffriends" />
  const visibleConnections = grouped[activeTab]

  return (
    <div className="pt-[max(0.5rem,env(safe-area-inset-top))]">
      <button aria-label="Retour au profil" className="grid size-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-700" onClick={() => navigate('/profile')} type="button"><ArrowLeft aria-hidden="true" size={20} /></button>
      <div className="mt-5"><p className="text-xs font-semibold text-sky-600">Votre réseau</p><h1 className="mt-1 text-[28px] font-bold tracking-[-0.03em]">Amis</h1><p className="mt-1 text-sm text-slate-500">Retrouvez les bénévoles que vous pourrez inviter aux missions.</p></div>

      <div className="mt-5 grid grid-cols-2 rounded-full bg-slate-100 p-1">
        <TabButton active={activeTab === 'friends'} count={grouped.friends.length} label="Mes amis" onClick={() => setActiveTab('friends')} />
        <TabButton active={activeTab === 'requests'} count={grouped.requests.length} label="Demandes" onClick={() => setActiveTab('requests')} />
      </div>
      {actionMessage && <p className="mt-3 rounded-[14px] bg-rose-50 p-3 text-center text-xs text-rose-700" role="alert">{actionMessage}</p>}

      {isLoading ? <Loading /> : loadError ? (
        <div className="mt-6 rounded-[22px] bg-rose-50 p-7 text-center"><p className="font-bold text-rose-800">Réseau indisponible</p><p className="mt-1 text-sm text-rose-700">Vérifiez votre connexion puis réessayez.</p></div>
      ) : visibleConnections.length === 0 ? (
        <div className="mt-6 rounded-[24px] bg-slate-50 p-8 text-center"><span className="mx-auto grid size-14 place-items-center rounded-full bg-sky-100 text-sky-700">{activeTab === 'friends' ? <UsersRound aria-hidden="true" size={25} /> : <Clock3 aria-hidden="true" size={25} />}</span><h2 className="mt-4 font-bold">{activeTab === 'friends' ? 'Aucun ami pour le moment' : 'Aucune demande en attente'}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{activeTab === 'friends' ? 'Recherchez des bénévoles dans Explorer pour leur envoyer une demande.' : 'Les demandes reçues et envoyées apparaîtront ici.'}</p>{activeTab === 'friends' && <Link className="mt-5 inline-flex min-h-11 items-center rounded-full bg-sky-500 px-5 text-sm font-bold text-white" to="/explore">Trouver des bénévoles</Link>}</div>
      ) : (
        <section className="mt-5 space-y-3" aria-label={activeTab === 'friends' ? 'Liste de vos amis' : 'Demandes d’amitié'}>
          {visibleConnections.map((connection) => (
            <ConnectionCard
              connection={connection}
              disabled={actionUserId === connection.userId}
              key={connection.userId}
              onAccept={() => void respond(connection, true)}
              onCancel={() => void cancel(connection)}
              onReject={() => void respond(connection, false)}
            />
          ))}
        </section>
      )}
    </div>
  )
}

function ConnectionCard({ connection, disabled, onAccept, onCancel, onReject }: { connection: FriendConnection; disabled: boolean; onAccept: () => void; onCancel: () => void; onReject: () => void }) {
  const initials = connection.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return (
    <article className="rounded-[22px] border border-slate-200 bg-white p-4">
      <Link className="flex gap-3" to={`/users/${connection.userId}`}>
        {connection.avatarUrl ? <img alt="" className="size-14 shrink-0 rounded-[18px] object-cover" src={connection.avatarUrl} /> : <span className="grid size-14 shrink-0 place-items-center rounded-[18px] bg-slate-700 font-bold text-sky-300">{initials || 'D'}</span>}
        <span className="min-w-0 flex-1"><strong className="block">{connection.displayName}</strong>{connection.city && <span className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin aria-hidden="true" size={13} />{connection.city}</span>}{connection.relationshipState === 'friends' && <span className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-700"><UserRoundCheck aria-hidden="true" size={14} />Ami</span>}</span>
      </Link>
      {connection.relationshipState === 'incoming_pending' && <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3"><button className="min-h-10 rounded-full border border-slate-300 text-xs font-bold text-slate-600 disabled:opacity-50" disabled={disabled} onClick={onReject} type="button"><X aria-hidden="true" className="mr-1 inline" size={15} />Refuser</button><button className="min-h-10 rounded-full bg-sky-500 text-xs font-bold text-white disabled:opacity-50" disabled={disabled} onClick={onAccept} type="button"><Check aria-hidden="true" className="mr-1 inline" size={15} />Accepter</button></div>}
      {connection.relationshipState === 'outgoing_pending' && <div className="mt-3 border-t border-slate-100 pt-3"><button className="min-h-10 w-full rounded-full border border-slate-300 text-xs font-bold text-slate-600 disabled:opacity-50" disabled={disabled} onClick={onCancel} type="button">Annuler la demande envoyée</button></div>}
    </article>
  )
}

function TabButton({ active, count, label, onClick }: { active: boolean; count: number; label: string; onClick: () => void }) {
  return <button aria-pressed={active} className={`min-h-11 rounded-full text-sm font-bold ${active ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'}`} onClick={onClick} type="button">{label} <span className="ml-1 text-xs opacity-70">{count}</span></button>
}

function Loading() {
  return <div className="grid min-h-64 place-items-center"><span className="size-9 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></div>
}
