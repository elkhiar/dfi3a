import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DBuxAmount } from '../components/DBuxIcon'
import { supabase } from '../lib/supabase'
import { getMyAccountType } from '../services/ngos'
import {
  finalizeMissionAttendance,
  getMissionAttendance,
  setAttendanceStatus,
} from '../services/registrations'

type AttendanceRow = Awaited<ReturnType<typeof getMissionAttendance>>[number]
type MissionInfo = {
  id: string
  title: string
  starts_at: string
  ends_at: string
  total_points: number
}
type FinalizeResult = { present_count: number; absent_count: number }

const NO_SHOW_PENALTY = 25

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Africa/Casablanca',
  }).format(new Date(value))
}

function getAttendanceError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('attendance_incomplete')) return 'Il reste des présences à vérifier.'
  if (message.includes('mission_not_ended')) return 'La mission doit être terminée avant la validation finale.'
  if (message.includes('attendance_already_finalized')) return 'Cette présence a déjà été finalisée.'
  return 'L’opération n’a pas pu être enregistrée. Réessayez.'
}

export function NgoAttendancePage() {
  const { missionId } = useParams()
  const navigate = useNavigate()
  const [mission, setMission] = useState<MissionInfo | null>(null)
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [isAllowed, setIsAllowed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [finalizeResult, setFinalizeResult] = useState<FinalizeResult | null>(null)

  const loadRows = async (id: string) => {
    setRows(await getMissionAttendance(id))
  }

  useEffect(() => {
    if (!missionId) return
    let isCurrent = true

    void Promise.all([
      getMyAccountType(),
      supabase
        .from('missions')
        .select('id, title, starts_at, ends_at, total_points')
        .eq('id', missionId)
        .single(),
    ])
      .then(async ([type, missionResult]) => {
        if (!isCurrent || missionResult.error) return
        const info = missionResult.data as MissionInfo
        setMission(info)
        const allowed = type === 'ngo' || type === 'admin'
        setIsAllowed(allowed)
        if (allowed && new Date() >= new Date(info.starts_at)) await loadRows(info.id)
      })
      .catch(() => {
        if (isCurrent) setErrorMessage('Impossible de charger la liste des bénévoles.')
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [missionId])

  const counts = useMemo(
    () => ({
      present: rows.filter((row) => row.attendance_status === 'present').length,
      absent: rows.filter((row) => row.attendance_status === 'absent').length,
      pending: rows.filter((row) => row.attendance_status === 'not_verified').length,
    }),
    [rows],
  )

  if (isLoading) {
    return (
      <main className="grid min-h-dvh place-items-center bg-white">
        <span className="size-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
      </main>
    )
  }

  if (!isAllowed || !mission) {
    return <State icon={LockKeyhole} text="Seule l’ONG organisatrice peut gérer cette présence." title="Accès refusé" />
  }

  if (new Date() < new Date(mission.starts_at)) {
    return <State icon={Clock3} text={`Elle sera disponible à partir du ${formatDateTime(mission.starts_at)}.`} title="Liste encore verrouillée" />
  }

  const updateStatus = async (registrationId: string, status: 'present' | 'absent') => {
    setErrorMessage('')
    setIsUpdating(true)
    try {
      await setAttendanceStatus(registrationId, status)
      await loadRows(mission.id)
    } catch (error) {
      setErrorMessage(getAttendanceError(error))
    } finally {
      setIsUpdating(false)
    }
  }

  const markPendingPresent = async () => {
    const pendingRows = rows.filter((row) => row.attendance_status === 'not_verified' && !row.finalized)
    if (pendingRows.length === 0) return

    setErrorMessage('')
    setIsUpdating(true)
    try {
      await Promise.all(pendingRows.map((row) => setAttendanceStatus(row.registration_id, 'present')))
      await loadRows(mission.id)
    } catch (error) {
      await loadRows(mission.id).catch(() => undefined)
      setErrorMessage(getAttendanceError(error))
    } finally {
      setIsUpdating(false)
    }
  }

  const finalize = async () => {
    setErrorMessage('')
    setIsUpdating(true)
    try {
      const result = await finalizeMissionAttendance(mission.id)
      setFinalizeResult(result as FinalizeResult)
      setIsConfirming(false)
      await loadRows(mission.id)
    } catch (error) {
      setIsConfirming(false)
      setErrorMessage(getAttendanceError(error))
    } finally {
      setIsUpdating(false)
    }
  }

  const ended = new Date() >= new Date(mission.ends_at)
  const finalized = rows.length > 0 && rows.every((row) => row.finalized)
  const canFinalize = ended && counts.pending === 0 && rows.length > 0 && !finalized

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl bg-slate-50 px-5 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <button aria-label="Retour" className="grid size-11 place-items-center rounded-full border border-slate-200 bg-white" onClick={() => navigate(-1)} type="button">
        <ArrowLeft aria-hidden="true" size={20} />
      </button>

      <p className="mt-6 text-xs font-semibold text-sky-600">Présence en temps réel</p>
      <h1 className="mt-1 text-2xl font-bold">{mission.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{rows.length} bénévole{rows.length === 1 ? '' : 's'} inscrit{rows.length === 1 ? '' : 's'}</p>

      <section className="mt-5 grid grid-cols-3 gap-2" aria-label="Résumé des présences">
        <AttendanceCount color="emerald" label="Présents" value={counts.present} />
        <AttendanceCount color="rose" label="Absents" value={counts.absent} />
        <AttendanceCount color="amber" label="À vérifier" value={counts.pending} />
      </section>

      <section className="mt-4 rounded-[20px] border border-sky-100 bg-sky-50 p-4">
        <div className="flex gap-3">
          <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-sky-600" size={20} />
          <div>
            <h2 className="text-sm font-bold text-slate-800">Conséquences après finalisation</h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">Présent : <DBuxAmount amount={`+${mission.total_points}`} iconClassName="h-3.5 w-auto" /> · Absent : <DBuxAmount amount={`−${NO_SHOW_PENALTY}`} iconClassName="h-3.5 w-auto" />. La finalisation est définitive.</p>
          </div>
        </div>
      </section>

      {errorMessage && <p className="mt-4 rounded-[16px] bg-rose-50 p-3 text-sm text-rose-700" role="alert">{errorMessage}</p>}

      {finalizeResult && (
        <section className="mt-4 rounded-[20px] bg-emerald-50 p-4 text-emerald-800" role="status">
          <div className="flex items-start gap-3">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0" size={21} />
            <div>
              <h2 className="text-sm font-bold">Présences finalisées</h2>
              <p className="mt-1 text-xs leading-5">{finalizeResult.present_count} présence{finalizeResult.present_count === 1 ? '' : 's'} et {finalizeResult.absent_count} absence{finalizeResult.absent_count === 1 ? '' : 's'} enregistrées. Le classement est maintenant à jour.</p>
            </div>
          </div>
        </section>
      )}

      {counts.pending > 0 && (
        <button className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-sky-200 bg-white px-4 text-sm font-bold text-sky-700 disabled:opacity-50" disabled={isUpdating} onClick={() => void markPendingPresent()} type="button">
          <UsersRound aria-hidden="true" size={17} />
          Marquer les {counts.pending} non vérifié{counts.pending === 1 ? '' : 's'} comme présent{counts.pending === 1 ? '' : 's'}
        </button>
      )}

      <section className="mt-4 space-y-2" aria-label="Liste des bénévoles">
        {rows.length === 0 ? (
          <div className="rounded-[22px] bg-white p-8 text-center shadow-sm">
            <UsersRound className="mx-auto text-sky-500" size={29} />
            <h2 className="mt-3 font-bold">Aucun bénévole inscrit</h2>
            <p className="mt-1 text-sm text-slate-500">La liste se remplira dès qu’un bénévole rejoint la mission.</p>
          </div>
        ) : rows.map((row) => (
          <article className="rounded-[18px] bg-white p-3 shadow-sm" key={row.registration_id}>
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sky-100 font-bold text-sky-700">{String(row.display_name).slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{row.display_name}</p>
                <p className={`mt-0.5 text-[11px] font-semibold ${row.attendance_status === 'present' ? 'text-emerald-700' : row.attendance_status === 'absent' ? 'text-rose-600' : 'text-amber-700'}`}>
                  {row.attendance_status === 'present' ? 'Présent' : row.attendance_status === 'absent' ? 'Absent' : 'À vérifier'}{row.finalized ? ' · finalisé' : ''}
                </p>
              </div>
              <button aria-label={`Marquer ${row.display_name} absent`} className={`grid size-10 place-items-center rounded-full ${row.attendance_status === 'absent' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500'}`} disabled={row.finalized || isUpdating} onClick={() => void updateStatus(row.registration_id, 'absent')} type="button">
                <X aria-hidden="true" size={18} />
              </button>
              <button aria-label={`Marquer ${row.display_name} présent`} className={`grid size-10 place-items-center rounded-full ${row.attendance_status === 'present' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`} disabled={row.finalized || isUpdating} onClick={() => void updateStatus(row.registration_id, 'present')} type="button">
                <Check aria-hidden="true" size={18} />
              </button>
            </div>
          </article>
        ))}
      </section>

      <button className="mt-6 min-h-12 w-full rounded-full bg-sky-500 text-sm font-bold text-white disabled:bg-slate-200 disabled:text-slate-400" disabled={!canFinalize || isUpdating} onClick={() => setIsConfirming(true)} type="button">
        <UserRoundCheck className="mr-2 inline" size={18} />{finalized ? 'Présences déjà finalisées' : 'Finaliser et attribuer les points'}
      </button>

      {!ended && <p className="mt-2 text-center text-xs text-slate-500">La finalisation sera disponible après la fin de la mission, le {formatDateTime(mission.ends_at)}.</p>}
      {ended && counts.pending > 0 && <p className="mt-2 text-center text-xs text-amber-700">Vérifiez encore {counts.pending} bénévole{counts.pending === 1 ? '' : 's'} avant de finaliser.</p>}

      {isConfirming && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-3" role="presentation">
          <section aria-labelledby="attendance-confirm-title" aria-modal="true" className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-2xl" role="dialog">
            <span className="mx-auto block h-1.5 w-12 rounded-full bg-slate-200" />
            <h2 className="mt-5 text-xl font-bold" id="attendance-confirm-title">Confirmer les présences ?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{counts.present} bénévole{counts.present === 1 ? '' : 's'} recevront <DBuxAmount amount={mission.total_points} /> et {counts.absent} auront une pénalité de <DBuxAmount amount={`−${NO_SHOW_PENALTY}`} />. Cette action ne pourra plus être modifiée.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button className="min-h-12 rounded-full bg-slate-100 text-sm font-bold text-slate-700" disabled={isUpdating} onClick={() => setIsConfirming(false)} type="button">Revenir</button>
              <button className="min-h-12 rounded-full bg-sky-500 text-sm font-bold text-white disabled:opacity-60" disabled={isUpdating} onClick={() => void finalize()} type="button">{isUpdating ? 'Finalisation…' : 'Confirmer'}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

function AttendanceCount({ color, label, value }: { color: 'amber' | 'emerald' | 'rose'; label: string; value: number }) {
  const styles = { amber: 'bg-amber-50 text-amber-800', emerald: 'bg-emerald-50 text-emerald-800', rose: 'bg-rose-50 text-rose-700' }
  return <div className={`rounded-[18px] px-2 py-3 text-center ${styles[color]}`}><p className="text-xl font-bold">{value}</p><p className="mt-0.5 text-[10px] font-semibold">{label}</p></div>
}

function State({ icon: Icon, text, title }: { icon: typeof Clock3; text: string; title: string }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center bg-white p-6 text-center">
      <div>
        <Icon className="mx-auto text-sky-500" size={33} />
        <h1 className="mt-4 text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
        <Link className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-sky-500 px-5 text-sm font-bold text-white" to="/ngo/missions"><ArrowLeft aria-hidden="true" size={18} /> Retour à mes missions</Link>
      </div>
    </main>
  )
}
