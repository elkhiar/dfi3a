import { Building2, CalendarDays, Plus, ShieldAlert, Siren } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { getMyAccountType, getMyNgoApplication, getMyNgoMissions } from '../services/ngos'
import type { NgoApplicationSnapshot } from '../services/ngos'

type NgoMissionRow = Awaited<ReturnType<typeof getMyNgoMissions>>[number]

export function NgoDashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const [application, setApplication] = useState<NgoApplicationSnapshot | null>(null)
  const [missions, setMissions] = useState<NgoMissionRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!user) return
    let isCurrent = true

    void Promise.all([getMyAccountType(), getMyNgoApplication()])
      .then(async ([type, snapshot]) => {
        if (!isCurrent) return
        if (type !== 'ngo' || snapshot?.status !== 'approved') {
          setApplication(snapshot)
          return
        }
        setApplication(snapshot)
        const nextMissions = await getMyNgoMissions()
        if (isCurrent) setMissions(nextMissions)
      })
      .catch(() => { if (isCurrent) setErrorMessage('Impossible de charger votre espace ONG.') })
      .finally(() => { if (isCurrent) setIsLoading(false) })

    return () => { isCurrent = false }
  }, [user])

  if (!isAuthLoading && !user) return <AccessCard />
  if (isAuthLoading || isLoading) return <main className="grid min-h-dvh place-items-center bg-white"><span className="size-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></main>
  if (errorMessage) return <main className="grid min-h-dvh place-items-center bg-white p-6 text-center"><div><h1 className="text-xl font-bold">Chargement impossible</h1><p className="mt-2 text-sm text-slate-500">{errorMessage}</p><button className="mt-5 min-h-11 rounded-full bg-sky-500 px-5 text-sm font-bold text-white" onClick={() => window.location.reload()} type="button">Réessayer</button></div></main>
  if (!application || application.status !== 'approved') return <AccessCard />

  return (
    <div className="pt-[max(0.5rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-4">
        <div><p className="text-xs font-semibold text-sky-600">Accueil ONG</p><h1 className="mt-1 text-2xl font-bold">{application.name}</h1></div>
        <Link aria-label="Créer une mission" className="grid size-11 place-items-center rounded-full bg-sky-500 text-white" to="/ngo/missions/new"><Plus aria-hidden="true" size={22} /></Link>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <Metric label="Missions" value={String(missions.length)} />
        <Metric label="À venir" value={String(missions.filter((mission) => new Date(mission.starts_at) > new Date()).length)} />
      </section>

      {missions.some((mission) => mission.urgency_status === 'pending') && <div className="mt-4 flex items-center gap-3 rounded-[20px] bg-amber-50 p-4 text-amber-900"><Siren aria-hidden="true" size={21} /><p className="text-sm font-semibold">Une demande urgente est en cours de validation.</p></div>}

      <div className="mt-7 flex items-center justify-between"><h2 className="text-xl font-bold">Vos missions</h2><Link className="flex min-h-11 items-center gap-1.5 rounded-full bg-sky-500 px-4 text-sm font-bold text-white" to="/ngo/missions/new"><Plus aria-hidden="true" size={17} />Créer</Link></div>

      {missions.length === 0 ? (
        <div className="mt-5 rounded-[24px] bg-white p-8 text-center"><CalendarDays className="mx-auto text-sky-500" size={29} /><h3 className="mt-3 font-bold">Aucune mission publiée</h3><p className="mt-1 text-sm text-slate-500">Créez votre première mission pour mobiliser des bénévoles.</p></div>
      ) : (
        <section className="mt-4 space-y-3">{missions.map((mission) => <article className="rounded-[20px] bg-white p-4 shadow-sm" key={mission.id}><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{mission.title}</h3><p className="mt-1 text-xs text-slate-500">{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(mission.starts_at))}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${mission.urgency_status === 'approved' ? 'bg-rose-50 text-rose-600' : mission.urgency_status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{mission.urgency_status === 'approved' ? 'Urgente' : mission.urgency_status === 'pending' ? 'Urgence en attente' : mission.status}</span></div><p className="mt-3 text-xs font-semibold text-sky-600">{mission.total_points} points</p><div className="mt-3 flex gap-2 border-t border-slate-100 pt-3"><Link className="flex-1 text-center text-xs font-bold text-slate-600" to={`/missions/${mission.slug}`}>Voir la mission</Link><Link className="flex-1 text-center text-xs font-bold text-sky-700" to={`/ngo/missions/${mission.id}/attendance`}>Gérer les présences</Link></div></article>)}</section>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-[20px] bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div> }
function AccessCard() { return <main className="mx-auto grid min-h-dvh max-w-md place-items-center bg-white p-6 text-center"><div><span className="mx-auto grid size-16 place-items-center rounded-full bg-sky-100 text-sky-700"><ShieldAlert aria-hidden="true" size={29} /></span><h1 className="mt-5 text-2xl font-bold">Accès ONG requis</h1><p className="mt-2 text-sm leading-6 text-slate-600">Un compte ONG approuvé est nécessaire pour ouvrir ce tableau de bord.</p><Link className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-sky-500 px-5 text-sm font-bold text-white" to="/ngo/apply"><Building2 aria-hidden="true" size={18} />Voir ma demande</Link></div></main> }
