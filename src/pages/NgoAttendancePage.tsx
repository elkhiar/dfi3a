import { ArrowLeft, Check, Clock3, LockKeyhole, UserRoundCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getMyAccountType } from '../services/ngos'
import { finalizeMissionAttendance, getMissionAttendance, setAttendanceStatus } from '../services/registrations'

type AttendanceRow = Awaited<ReturnType<typeof getMissionAttendance>>[number]
type MissionInfo = { id: string; title: string; starts_at: string; ends_at: string }

export function NgoAttendancePage() {
  const { missionId } = useParams()
  const navigate = useNavigate()
  const [mission, setMission] = useState<MissionInfo | null>(null)
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [isAllowed, setIsAllowed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const loadRows = async (id: string) => { setRows(await getMissionAttendance(id)) }

  useEffect(() => {
    if (!missionId) return
    let isCurrent = true
    void Promise.all([
      getMyAccountType(),
      supabase.from('missions').select('id, title, starts_at, ends_at').eq('id', missionId).single(),
    ]).then(async ([type, missionResult]) => {
      if (!isCurrent || missionResult.error) return
      const info = missionResult.data as MissionInfo
      setMission(info)
      const allowed = type === 'ngo' || type === 'admin'
      setIsAllowed(allowed)
      if (allowed && new Date() >= new Date(info.starts_at)) await loadRows(info.id)
      if (isCurrent) setIsLoading(false)
    }).catch(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [missionId])

  if (isLoading) return <main className="grid min-h-dvh place-items-center bg-white"><span className="size-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></main>
  if (!isAllowed || !mission) return <State icon={LockKeyhole} title="Accès refusé" text="Seule l’ONG organisatrice peut gérer cette présence." />
  if (new Date() < new Date(mission.starts_at)) return <State icon={Clock3} title="Liste encore verrouillée" text={`Elle sera disponible à partir du ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(mission.starts_at))}.`} />

  const updateStatus = async (registrationId: string, status: 'present' | 'absent') => { setErrorMessage(''); try { await setAttendanceStatus(registrationId, status); await loadRows(mission.id) } catch { setErrorMessage('La présence n’a pas pu être enregistrée.') } }
  const finalize = async () => { setErrorMessage(''); try { await finalizeMissionAttendance(mission.id); await loadRows(mission.id) } catch (error) { setErrorMessage(error instanceof Error ? error.message : 'La finalisation a échoué.') } }
  const incomplete = rows.some((row) => row.attendance_status === 'not_verified')
  const ended = new Date() >= new Date(mission.ends_at)

  return <main className="mx-auto min-h-dvh w-full max-w-2xl bg-slate-50 px-5 pb-10 pt-5"><button aria-label="Retour" className="grid size-11 place-items-center rounded-full border border-slate-200 bg-white" onClick={() => navigate(-1)} type="button"><ArrowLeft aria-hidden="true" size={20} /></button><p className="mt-6 text-xs font-semibold text-sky-600">Présence en temps réel</p><h1 className="mt-1 text-2xl font-bold">{mission.title}</h1><p className="mt-1 text-sm text-slate-500">{rows.length} bénévole{rows.length === 1 ? '' : 's'} inscrit{rows.length === 1 ? '' : 's'}</p>{errorMessage && <p className="mt-4 rounded-[16px] bg-rose-50 p-3 text-sm text-rose-700" role="alert">{errorMessage}</p>}<section className="mt-5 space-y-2">{rows.map((row) => <article className="flex items-center gap-3 rounded-[18px] bg-white p-3 shadow-sm" key={row.registration_id}><span className="grid size-10 place-items-center rounded-full bg-sky-100 font-bold text-sky-700">{String(row.display_name).slice(0, 1)}</span><p className="min-w-0 flex-1 truncate text-sm font-semibold">{row.display_name}</p><button aria-label={`Marquer ${row.display_name} absent`} className={`grid size-10 place-items-center rounded-full ${row.attendance_status === 'absent' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500'}`} disabled={row.finalized} onClick={() => void updateStatus(row.registration_id, 'absent')} type="button"><X aria-hidden="true" size={18} /></button><button aria-label={`Marquer ${row.display_name} présent`} className={`grid size-10 place-items-center rounded-full ${row.attendance_status === 'present' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`} disabled={row.finalized} onClick={() => void updateStatus(row.registration_id, 'present')} type="button"><Check aria-hidden="true" size={18} /></button></article>)}</section><button className="mt-6 min-h-12 w-full rounded-full bg-sky-500 text-sm font-bold text-white disabled:bg-slate-200 disabled:text-slate-400" disabled={!ended || incomplete || rows.every((row) => row.finalized)} onClick={() => void finalize()} type="button"><UserRoundCheck className="mr-2 inline" size={18} />Finaliser et attribuer les points</button>{!ended && <p className="mt-2 text-center text-xs text-slate-500">La finalisation sera disponible après la fin de la mission.</p>}</main>
}

function State({ icon: Icon, text, title }: { icon: typeof Clock3; text: string; title: string }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center bg-white p-6 text-center">
      <div>
        <Icon className="mx-auto text-sky-500" size={33} />
        <h1 className="mt-4 text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
        <Link className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-sky-500 px-5 text-sm font-bold text-white" to="/ngo/missions">
          <ArrowLeft aria-hidden="true" size={18} /> Retour à mes missions
        </Link>
      </div>
    </main>
  )
}
