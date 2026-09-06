import { CalendarDays, MessageCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MOROCCO_TIME_ZONE } from '../lib/date-time'
import { getMyNgoMissions } from '../services/ngos'
import type { NgoOwnedMission } from '../services/ngos'

export function NgoMessagesPage() {
  const [missions, setMissions] = useState<NgoOwnedMission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let isCurrent = true
    void getMyNgoMissions()
      .then((rows) => { if (isCurrent) setMissions(rows.filter((mission) => mission.status === 'published')) })
      .catch(() => { if (isCurrent) setHasError(true) })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [])

  return <div className="pt-[max(0.5rem,env(safe-area-inset-top))]">
    <p className="text-xs font-semibold text-sky-600">Communauté</p>
    <h1 className="mt-1 text-[28px] font-bold tracking-[-0.03em]">Messages</h1>
    <p className="mt-2 text-sm leading-5 text-slate-500">Retrouvez les groupes de discussion de vos missions publiées.</p>
    {isLoading ? <div className="grid min-h-64 place-items-center"><span className="size-9 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></div>
      : hasError ? <p className="mt-6 rounded-[18px] bg-rose-50 p-4 text-sm text-rose-700">Impossible de charger les discussions.</p>
        : missions.length === 0 ? <div className="mt-6 rounded-[24px] bg-white p-8 text-center shadow-sm"><MessageCircle className="mx-auto text-sky-500" size={30} /><h2 className="mt-3 font-bold">Aucune discussion active</h2><p className="mt-1 text-sm text-slate-500">Les groupes apparaîtront ici dès que vous publierez une mission.</p></div>
          : <section className="mt-6 space-y-3">{missions.map((mission) => <Link className="flex items-center gap-3 rounded-[22px] border border-slate-100 bg-white p-4 shadow-sm" key={mission.id} to={`/missions/${mission.id}/chat`}><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-600"><MessageCircle aria-hidden="true" size={21} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{mission.title}</span><span className="mt-1 flex items-center gap-1 text-[11px] text-slate-500"><CalendarDays aria-hidden="true" size={12} />{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: MOROCCO_TIME_ZONE }).format(new Date(mission.starts_at))}</span></span><span className="rounded-full bg-sky-500 px-3 py-2 text-[10px] font-bold text-white">Ouvrir</span></Link>)}</section>}
  </div>
}
