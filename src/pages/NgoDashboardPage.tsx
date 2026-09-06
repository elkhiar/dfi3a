import {
  ArrowRight,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock3,
  MessageCircle,
  Pencil,
  Plus,
  ShieldAlert,
  Siren,
  Sparkles,
  TrendingUp,
  UsersRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { NotificationBell } from '../components/NotificationBell'
import { MOROCCO_TIME_ZONE } from '../lib/date-time'
import { getMyAccountType, getMyNgoApplication, getMyNgoMissions } from '../services/ngos'
import type { NgoApplicationSnapshot, NgoOwnedMission } from '../services/ngos'

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: MOROCCO_TIME_ZONE,
})

function getCountdown(startsAt: string, now: number) {
  const minutes = Math.max(0, Math.round((new Date(startsAt).getTime() - now) / 60_000))
  if (minutes < 60) return `Dans ${minutes} min`
  if (minutes < 1_440) return `Dans ${Math.round(minutes / 60)} h`
  return `Dans ${Math.round(minutes / 1_440)} j`
}

export function NgoDashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const [application, setApplication] = useState<NgoApplicationSnapshot | null>(null)
  const [missions, setMissions] = useState<NgoOwnedMission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [openedAt] = useState(() => Date.now())

  useEffect(() => {
    if (!user) return
    let isCurrent = true
    void Promise.all([getMyAccountType(), getMyNgoApplication()])
      .then(async ([type, snapshot]) => {
        if (!isCurrent) return
        setApplication(snapshot)
        if (type === 'ngo' && snapshot?.status === 'approved') {
          const nextMissions = await getMyNgoMissions()
          if (isCurrent) setMissions(nextMissions)
        }
      })
      .catch(() => { if (isCurrent) setErrorMessage('Impossible de charger votre espace ONG.') })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [user])

  const dashboard = useMemo(() => {
    const active = missions.filter((mission) => mission.status === 'published' && new Date(mission.ends_at).getTime() >= openedAt)
    const upcoming = active.filter((mission) => new Date(mission.starts_at).getTime() >= openedAt)
    return {
      active,
      upcoming,
      nextMission: upcoming[0] ?? active[0] ?? null,
      registrations: active.reduce((total, mission) => total + mission.registration_count, 0),
      urgentPending: missions.filter((mission) => mission.urgency_status === 'pending').length,
    }
  }, [missions, openedAt])

  if (!isAuthLoading && !user) return <AccessCard />
  if (isAuthLoading || isLoading) return <main className="grid min-h-dvh place-items-center bg-white"><span className="size-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></main>
  if (errorMessage) return <main className="grid min-h-dvh place-items-center bg-white p-6 text-center"><div><h1 className="text-xl font-bold">Chargement impossible</h1><p className="mt-2 text-sm text-slate-500">{errorMessage}</p><button className="mt-5 min-h-11 rounded-full bg-sky-500 px-5 text-sm font-bold text-white" onClick={() => window.location.reload()} type="button">Réessayer</button></div></main>
  if (!application || application.status !== 'approved') return <AccessCard />

  return (
    <div className="pt-[max(0.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {application.logoUrl ? <img alt={`Logo ${application.name}`} className="size-12 rounded-2xl border border-slate-100 bg-white object-cover shadow-sm" src={application.logoUrl} /> : <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sky-500 text-lg font-bold text-white">{application.name.slice(0, 1).toUpperCase()}</span>}
          <div className="min-w-0"><p className="text-xs font-semibold text-slate-400">Bonjour 👋</p><h1 className="truncate text-xl font-bold tracking-[-0.025em]">{application.name}</h1></div>
        </div>
        <NotificationBell className="bg-white shadow-sm" />
      </header>

      <Link className="mt-5 flex min-h-14 w-full items-center justify-between rounded-[20px] bg-sky-500 px-5 text-white shadow-lg shadow-sky-100 transition active:scale-[0.99]" to="/ngo/missions/new">
        <span className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-white/20"><Plus aria-hidden="true" size={21} /></span><span><span className="block text-sm font-bold">Publier une mission</span><span className="block text-[11px] text-white/75">Mobilisez votre communauté</span></span></span>
        <ArrowRight aria-hidden="true" size={20} />
      </Link>

      <section aria-label="Résumé de votre activité" className="mt-5 grid grid-cols-2 gap-3">
        <Metric icon={CalendarDays} label="Missions actives" tone="sky" value={dashboard.active.length} />
        <Metric icon={UsersRound} label="Inscriptions actives" tone="violet" value={dashboard.registrations} />
        <Metric icon={Clock3} label="À venir" tone="emerald" value={dashboard.upcoming.length} />
        <Metric icon={Siren} label="Urgences en attente" tone="amber" value={dashboard.urgentPending} />
      </section>

      {dashboard.urgentPending > 0 && <Link className="mt-4 flex items-center gap-3 rounded-[18px] border border-amber-100 bg-amber-50 p-4 text-amber-900" to="/ngo/missions"><Siren aria-hidden="true" className="shrink-0" size={20} /><span className="flex-1 text-xs font-semibold">{dashboard.urgentPending} demande{dashboard.urgentPending === 1 ? '' : 's'} urgente{dashboard.urgentPending === 1 ? '' : 's'} en cours de validation</span><ChevronRight aria-hidden="true" size={17} /></Link>}

      <div className="mt-7 flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-600">À surveiller</p><h2 className="mt-1 text-xl font-bold tracking-[-0.025em]">Prochaine mission</h2></div><Link className="text-xs font-bold text-sky-600" to="/ngo/missions">Tout voir</Link></div>
      {dashboard.nextMission ? <NextMissionCard mission={dashboard.nextMission} now={openedAt} /> : <EmptyMissionCard />}

      <section className="mt-7">
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold tracking-[-0.025em]">Accès rapides</h2><Sparkles aria-hidden="true" className="text-sky-500" size={19} /></div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <QuickLink icon={CalendarDays} label="Toutes les missions" to="/ngo/missions" />
          <QuickLink icon={MessageCircle} label="Messages" to="/ngo/messages" />
          <QuickLink icon={TrendingUp} label="Classement" to="/ngo/leaderboard" />
          <QuickLink icon={Building2} label="Profil ONG" to="/ngo/profile" />
        </div>
      </section>
    </div>
  )
}

function Metric({ icon: Icon, label, tone, value }: { icon: typeof CalendarDays; label: string; tone: 'sky' | 'violet' | 'emerald' | 'amber'; value: number }) {
  const tones = { sky: 'bg-sky-50 text-sky-600', violet: 'bg-violet-50 text-violet-600', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600' }
  return <article className="rounded-[22px] border border-slate-100 bg-white p-4 shadow-sm"><span className={`grid size-9 place-items-center rounded-xl ${tones[tone]}`}><Icon aria-hidden="true" size={18} /></span><p className="mt-4 text-2xl font-bold tracking-[-0.04em]">{value}</p><p className="mt-1 text-[11px] font-medium leading-4 text-slate-500">{label}</p></article>
}

function NextMissionCard({ mission, now }: { mission: NgoOwnedMission; now: number }) {
  const hasStarted = new Date(mission.starts_at).getTime() <= now
  const progress = mission.capacity ? Math.min(100, Math.round((mission.registration_count / mission.capacity) * 100)) : null
  return <article className="mt-4 overflow-hidden rounded-[26px] border border-slate-100 bg-white shadow-sm">
    {mission.cover_image_path && <div className="relative h-32 bg-slate-100"><img alt="" className="size-full object-cover" src={mission.cover_image_path} /><span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-slate-800 shadow-sm">{hasStarted ? 'En cours' : getCountdown(mission.starts_at, now)}</span>{mission.urgency_status === 'approved' && <span className="absolute right-3 top-3 rounded-full bg-rose-500 px-3 py-1.5 text-[10px] font-bold uppercase text-white">Urgente</span>}</div>}
    <div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="line-clamp-2 text-lg font-bold leading-tight">{mission.title}</h3><p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-500"><CalendarDays aria-hidden="true" size={14} />{dateFormatter.format(new Date(mission.starts_at))}</p></div>{!mission.cover_image_path && <span className="rounded-full bg-sky-50 px-3 py-1.5 text-[10px] font-bold text-sky-700">{hasStarted ? 'En cours' : getCountdown(mission.starts_at, now)}</span>}</div>
      <div className="mt-4"><div className="flex items-center justify-between text-xs"><span className="font-semibold text-slate-600">{mission.registration_count} bénévole{mission.registration_count === 1 ? '' : 's'}</span><span className="text-slate-400">{mission.capacity ? `${mission.capacity} places` : 'Places illimitées'}</span></div>{progress !== null && <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-500" style={{ width: `${progress}%` }} /></div>}</div>
      <div className="mt-4 grid grid-cols-2 gap-2"><Link className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-slate-100 px-3 text-xs font-bold text-slate-700" to={`/ngo/missions/${mission.id}/edit`}><Pencil aria-hidden="true" size={14} />Modifier</Link><Link className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-sky-500 px-3 text-xs font-bold text-white" to={hasStarted ? `/ngo/missions/${mission.id}/attendance` : `/missions/${mission.slug}`}><UsersRound aria-hidden="true" size={15} />{hasStarted ? 'Présences' : 'Voir la mission'}</Link></div>
      <Link className="mt-2 flex min-h-11 items-center justify-center gap-2 rounded-full border border-sky-100 text-xs font-bold text-sky-700" state={{ fromMission: true }} to={`/missions/${mission.id}/chat`}><MessageCircle aria-hidden="true" size={15} />Ouvrir le groupe de discussion</Link>
    </div>
  </article>
}

function QuickLink({ icon: Icon, label, to }: { icon: typeof CalendarDays; label: string; to: string }) { return <Link className="flex min-h-20 items-center gap-3 rounded-[20px] border border-slate-100 bg-white p-3 shadow-sm" to={to}><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-600"><Icon aria-hidden="true" size={19} /></span><span className="text-xs font-bold leading-4 text-slate-700">{label}</span></Link> }
function EmptyMissionCard() { return <div className="mt-4 rounded-[24px] border border-dashed border-sky-200 bg-sky-50/60 p-7 text-center"><CalendarDays className="mx-auto text-sky-500" size={28} /><h3 className="mt-3 font-bold">Votre prochaine mission commence ici</h3><p className="mt-1 text-xs leading-5 text-slate-500">Publiez une activité pour commencer à mobiliser des bénévoles.</p><Link className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-sky-500 px-5 text-xs font-bold text-white" to="/ngo/missions/new"><Plus aria-hidden="true" size={16} />Créer une mission</Link></div> }
function AccessCard() { return <main className="mx-auto grid min-h-dvh max-w-md place-items-center bg-white p-6 text-center"><div><span className="mx-auto grid size-16 place-items-center rounded-full bg-sky-100 text-sky-700"><ShieldAlert aria-hidden="true" size={29} /></span><h1 className="mt-5 text-2xl font-bold">Accès ONG requis</h1><p className="mt-2 text-sm leading-6 text-slate-600">Un compte ONG approuvé est nécessaire pour ouvrir ce tableau de bord.</p><Link className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-sky-500 px-5 text-sm font-bold text-white" to="/ngo/apply"><Building2 aria-hidden="true" size={18} />Voir ma demande</Link></div></main> }
