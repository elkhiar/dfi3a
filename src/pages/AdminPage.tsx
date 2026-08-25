import { ArrowLeft, Building2, Check, Clock3, ExternalLink, LogOut, ShieldCheck, Siren, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getMyAccountType } from '../services/ngos'
import {
  getNgoDocumentUrl,
  getPendingNgoApplications,
  getPendingUrgencyRequests,
  reviewNgoApplication,
  reviewUrgencyRequest,
} from '../services/admin'

type AdminTab = 'ngos' | 'urgencies'
type NgoQueueItem = Awaited<ReturnType<typeof getPendingNgoApplications>>[number]
type UrgencyQueueItem = Awaited<ReturnType<typeof getPendingUrgencyRequests>>[number]

export function AdminPage() {
  const navigate = useNavigate()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<AdminTab>('ngos')
  const [ngos, setNgos] = useState<NgoQueueItem[]>([])
  const [urgencies, setUrgencies] = useState<UrgencyQueueItem[]>([])
  const [errorMessage, setErrorMessage] = useState('')

  const loadQueues = async () => {
    const [ngoQueue, urgencyQueue] = await Promise.all([
      getPendingNgoApplications(),
      getPendingUrgencyRequests(),
    ])
    setNgos(ngoQueue)
    setUrgencies(urgencyQueue)
  }

  useEffect(() => {
    let isCurrent = true
    void getMyAccountType()
      .then(async (type) => {
        if (!isCurrent || type !== 'admin') return
        setIsAdmin(true)
        await loadQueues()
      })
      .catch(() => undefined)
      .finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [])

  if (isLoading) return <main className="grid min-h-dvh place-items-center bg-white"><span className="size-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></main>
  if (!isAdmin) return <main className="mx-auto grid min-h-dvh max-w-md place-items-center bg-white p-6 text-center"><div><ShieldCheck className="mx-auto text-sky-500" size={34} /><h1 className="mt-4 text-2xl font-bold">Accès administrateur</h1><p className="mt-2 text-sm text-slate-500">Ce tableau de bord est réservé à l’équipe dfi3a.</p></div></main>

  const reviewNgo = async (id: string, approved: boolean, reason = '') => {
    setErrorMessage('')
    try { await reviewNgoApplication(id, approved, reason); await loadQueues() }
    catch { setErrorMessage('La décision n’a pas pu être enregistrée.') }
  }
  const reviewUrgency = async (id: string, approved: boolean, reason = '') => {
    setErrorMessage('')
    try { await reviewUrgencyRequest(id, approved, reason); await loadQueues() }
    catch { setErrorMessage('La décision n’a pas pu être enregistrée.') }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/auth?mode=login', { replace: true })
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-4xl bg-slate-50 px-5 pb-12 pt-8 text-slate-950">
      <div className="flex items-center justify-between gap-3">
        <button aria-label="Retour" className="grid size-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-700" onClick={() => navigate(-1)} type="button"><ArrowLeft aria-hidden="true" size={21} /></button>
        <button className="flex min-h-11 items-center gap-2 rounded-full border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-600" onClick={() => void signOut()} type="button"><LogOut aria-hidden="true" size={17} />Se déconnecter</button>
      </div>
      <p className="mt-6 text-xs font-semibold text-sky-600">Administration dfi3a</p><h1 className="mt-1 text-[28px] font-bold">Validations</h1>
      <div className="mt-6 grid grid-cols-2 rounded-full bg-slate-200 p-1"><Tab active={activeTab === 'ngos'} onClick={() => setActiveTab('ngos')}>ONG · {ngos.length}</Tab><Tab active={activeTab === 'urgencies'} onClick={() => setActiveTab('urgencies')}>Urgences · {urgencies.length}</Tab></div>
      {errorMessage && <p className="mt-4 rounded-[16px] bg-rose-50 p-3 text-sm text-rose-700" role="alert">{errorMessage}</p>}
      {activeTab === 'ngos' ? <NgoQueue items={ngos} onReview={reviewNgo} /> : <UrgencyQueue items={urgencies} onReview={reviewUrgency} />}
    </main>
  )
}

function NgoQueue({ items, onReview }: { items: NgoQueueItem[]; onReview: (id: string, approved: boolean, reason?: string) => Promise<void> }) {
  if (!items.length) return <Empty icon={Building2} text="Aucune demande ONG en attente." />
  return <section className="mt-5 space-y-3">{items.map((item) => { const application = Array.isArray(item.ngo_applications) ? item.ngo_applications[0] : item.ngo_applications; return <article className="rounded-[22px] bg-white p-4 shadow-sm" key={item.id}><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">{item.name}</h2><p className="mt-1 text-xs text-slate-500">{item.main_city} · {application?.official_email}</p></div><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">En attente</span></div><dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-slate-400">Nom légal</dt><dd className="mt-1 font-semibold">{application?.legal_name}</dd></div><div><dt className="text-slate-400">N° enregistrement</dt><dd className="mt-1 font-semibold">{application?.registration_number}</dd></div></dl><button className="mt-4 flex items-center gap-1.5 text-xs font-bold text-sky-700" onClick={() => void openDocument(application?.registration_document_path)} type="button"><ExternalLink aria-hidden="true" size={14} />Voir le document</button><DecisionButtons id={item.id} onReview={onReview} /></article> })}</section>
}

async function openDocument(path?: string) { if (!path) return; const url = await getNgoDocumentUrl(path); window.open(url, '_blank', 'noopener,noreferrer') }

function UrgencyQueue({ items, onReview }: { items: UrgencyQueueItem[]; onReview: (id: string, approved: boolean, reason?: string) => Promise<void> }) {
  if (!items.length) return <Empty icon={Siren} text="Aucune demande urgente en attente." />
  return <section className="mt-5 space-y-3">{items.map((item) => { const ngo = Array.isArray(item.ngos) ? item.ngos[0] : item.ngos; return <article className="rounded-[22px] bg-white p-4 shadow-sm" key={item.id}><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">{item.title}</h2><p className="mt-1 text-xs text-slate-500">{ngo?.name}</p></div><Siren className="text-rose-500" size={20} /></div><p className="mt-4 rounded-[16px] bg-amber-50 p-3 text-sm leading-6 text-amber-950">{item.urgency_justification}</p><p className="mt-3 flex items-center gap-1 text-xs text-slate-500"><Clock3 aria-hidden="true" size={13} />Besoin avant {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.urgency_needed_by))}</p><DecisionButtons id={item.id} onReview={onReview} /></article> })}</section>
}

function DecisionButtons({ id, onReview }: { id: string; onReview: (id: string, approved: boolean, reason?: string) => Promise<void> }) { const [reason, setReason] = useState(''); return <div className="mt-4"><input className="min-h-11 w-full rounded-[14px] border border-slate-300 px-3 text-sm outline-none focus:border-sky-500" onChange={(event) => setReason(event.target.value)} placeholder="Motif facultatif ou raison du refus" value={reason} /><div className="mt-2 grid grid-cols-2 gap-2"><button className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-rose-200 text-sm font-bold text-rose-600" onClick={() => void onReview(id, false, reason)} type="button"><X aria-hidden="true" size={17} />Refuser</button><button className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-emerald-600 text-sm font-bold text-white" onClick={() => void onReview(id, true, reason)} type="button"><Check aria-hidden="true" size={17} />Approuver</button></div></div> }
function Tab({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) { return <button aria-pressed={active} className={`min-h-11 rounded-full text-sm font-semibold ${active ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'}`} onClick={onClick} type="button">{children}</button> }
function Empty({ icon: Icon, text }: { icon: typeof Building2; text: string }) { return <div className="mt-6 rounded-[22px] bg-white p-8 text-center"><Icon className="mx-auto text-sky-500" size={28} /><p className="mt-3 text-sm font-semibold">{text}</p></div> }
