import { Building2, CheckCircle2, LogOut, Mail, MapPin, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { supabase } from '../lib/supabase'
import { getMyNgoApplication } from '../services/ngos'
import type { NgoApplicationSnapshot } from '../services/ngos'

export function NgoProfilePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [application, setApplication] = useState<NgoApplicationSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let isCurrent = true
    void getMyNgoApplication()
      .then((snapshot) => { if (isCurrent) setApplication(snapshot) })
      .catch(() => { if (isCurrent) setLoadError(true) })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/auth?mode=login', { replace: true })
  }

  if (isLoading) return <div className="grid min-h-72 place-items-center"><span className="size-9 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></div>
  if (loadError) return <div className="grid min-h-72 place-items-center p-6 text-center"><div><h1 className="text-xl font-bold">Profil indisponible</h1><p className="mt-2 text-sm text-slate-500">Vérifiez votre connexion puis réessayez.</p><button className="mt-5 min-h-11 rounded-full bg-sky-500 px-5 text-sm font-bold text-white" onClick={() => window.location.reload()} type="button">Réessayer</button></div></div>

  return (
    <div className="pt-[max(0.5rem,env(safe-area-inset-top))]">
      <p className="text-xs font-semibold text-sky-600">Compte organisation</p><h1 className="mt-1 text-[28px] font-bold tracking-[-0.03em]">Profil ONG</h1>
      <section className="mt-6 rounded-[26px] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4"><span className="grid size-16 shrink-0 place-items-center rounded-[20px] bg-sky-500 text-white"><Building2 aria-hidden="true" size={29} /></span><div className="min-w-0"><h2 className="truncate text-xl font-bold">{application?.name || 'Organisation'}</h2><p className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 aria-hidden="true" size={14} />ONG vérifiée</p></div></div>
        {application?.description && <p className="mt-5 text-sm leading-6 text-slate-600">{application.description}</p>}
        {application?.mainCity && <p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><MapPin aria-hidden="true" size={17} />{application.mainCity}</p>}
      </section>

      <section className="mt-5 rounded-[22px] bg-slate-700 p-4 text-white"><div className="flex items-center gap-3"><ShieldCheck className="text-sky-300" size={24} /><div><p className="font-bold">Compte approuvé par dfi3a</p><p className="mt-1 text-xs text-white/65">Vous pouvez publier et gérer les présences.</p></div></div></section>

      <section className="mt-5 rounded-[22px] bg-white p-4 shadow-sm"><h2 className="font-bold">Contact du compte</h2><p className="mt-3 flex items-center gap-2 text-sm text-slate-600"><Mail aria-hidden="true" size={17} />{user?.email}</p></section>

      <Link className="mt-5 flex min-h-12 items-center justify-center rounded-full bg-sky-500 text-sm font-bold text-white" to="/ngo/dashboard">Retour à l’accueil ONG</Link>
      <button className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-rose-200 text-sm font-semibold text-rose-600" onClick={() => void signOut()} type="button"><LogOut aria-hidden="true" size={18} />Se déconnecter</button>
    </div>
  )
}
