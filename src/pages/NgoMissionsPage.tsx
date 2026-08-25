import { CalendarDays, MapPin, Plus, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MOROCCO_TIME_ZONE } from '../lib/date-time'
import { getMyNgoMissions } from '../services/ngos'

type Mission = Awaited<ReturnType<typeof getMyNgoMissions>>[number]
type MissionTab = 'active' | 'past'

const missionStatusLabels: Record<string, string> = {
  draft: 'Brouillon',
  published: 'Publiée',
  completed: 'Terminée',
  cancelled: 'Annulée',
}

export function NgoMissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([])
  const [activeTab, setActiveTab] = useState<MissionTab>('active')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [openedAt] = useState(() => Date.now())

  useEffect(() => {
    let isCurrent = true
    void getMyNgoMissions()
      .then((rows) => { if (isCurrent) setMissions(rows) })
      .catch(() => { if (isCurrent) setErrorMessage('Impossible de charger vos missions.') })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [])

  const visibleMissions = missions.filter((mission) => activeTab === 'active'
    ? mission.status !== 'completed' && new Date(mission.starts_at).getTime() >= openedAt
    : mission.status === 'completed' || new Date(mission.starts_at).getTime() < openedAt,
  )

  return (
    <div className="pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-semibold text-sky-600">Espace ONG</p><h1 className="mt-1 text-[28px] font-bold tracking-[-0.03em]">Mes missions</h1></div>
        <Link aria-label="Créer une mission" className="grid size-11 place-items-center rounded-full bg-sky-500 text-white" to="/ngo/missions/new"><Plus aria-hidden="true" size={22} /></Link>
      </div>

      <div className="mt-6 grid grid-cols-2 rounded-full bg-slate-200 p-1">
        <Tab active={activeTab === 'active'} onClick={() => setActiveTab('active')}>À venir</Tab>
        <Tab active={activeTab === 'past'} onClick={() => setActiveTab('past')}>Terminées</Tab>
      </div>

      {isLoading ? (
        <div className="grid min-h-64 place-items-center"><span className="size-9 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></div>
      ) : errorMessage ? (
        <p className="mt-6 rounded-[18px] bg-rose-50 p-4 text-sm text-rose-700" role="alert">{errorMessage}</p>
      ) : visibleMissions.length === 0 ? (
        <section className="mt-6 rounded-[24px] bg-white p-8 text-center shadow-sm"><CalendarDays className="mx-auto text-sky-500" size={30} /><h2 className="mt-3 font-bold">Aucune mission {activeTab === 'active' ? 'à venir' : 'terminée'}</h2><p className="mt-1 text-sm text-slate-500">{activeTab === 'active' ? 'Publiez une mission pour mobiliser des bénévoles.' : 'Vos missions finalisées apparaîtront ici.'}</p></section>
      ) : (
        <section className="mt-5 space-y-3">{visibleMissions.map((mission) => <MissionCard key={mission.id} mission={mission} />)}</section>
      )}
    </div>
  )
}

function MissionCard({ mission }: { mission: Mission }) {
  return (
    <article className="rounded-[22px] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">{mission.title}</h2><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin aria-hidden="true" size={13} />Mission publiée</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${mission.urgency_status === 'approved' ? 'bg-rose-50 text-rose-600' : mission.urgency_status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{mission.urgency_status === 'approved' ? 'Urgente' : mission.urgency_status === 'pending' ? 'Urgence en attente' : missionStatusLabels[mission.status] ?? mission.status}</span></div>
      <p className="mt-3 text-xs text-slate-500">{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: MOROCCO_TIME_ZONE }).format(new Date(mission.starts_at))}</p>
      <p className="mt-2 text-sm font-bold text-sky-600">{mission.total_points} points</p>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3"><Link className="min-h-10 rounded-full bg-slate-100 px-3 py-2.5 text-center text-xs font-bold text-slate-700" to={`/missions/${mission.slug}`}>Voir</Link><Link className="flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-sky-50 px-3 text-xs font-bold text-sky-700" to={`/ngo/missions/${mission.id}/attendance`}><UsersRound aria-hidden="true" size={15} />Présences</Link></div>
    </article>
  )
}

function Tab({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button aria-pressed={active} className={`min-h-11 rounded-full text-sm font-semibold ${active ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'}`} onClick={onClick} type="button">{children}</button>
}
