import { ArrowLeft, BellRing, Building2, MapPin, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { getMyFollowedNgos } from '../services/ngos'
import type { FollowedNgo } from '../services/ngos'

export function FollowedNgosPage() {
  const navigate = useNavigate()
  const { isLoading: isAuthLoading, user } = useAuth()
  const [ngos, setNgos] = useState<FollowedNgo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!user) return
    let isCurrent = true
    void getMyFollowedNgos()
      .then((results) => { if (isCurrent) setNgos(results) })
      .catch(() => { if (isCurrent) setLoadError(true) })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [user])

  if (isAuthLoading) return <Loading />
  if (!user) return <Navigate replace to="/auth?mode=login&returnTo=%2Ffollowing" />

  return (
    <div className="pt-[max(0.5rem,env(safe-area-inset-top))]">
      <button aria-label="Retour au profil" className="grid size-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-700" onClick={() => navigate('/profile')} type="button"><ArrowLeft aria-hidden="true" size={20} /></button>
      <div className="mt-5"><p className="text-xs font-semibold text-sky-600">Vos abonnements</p><h1 className="mt-1 text-[28px] font-bold tracking-[-0.03em]">ONG suivies</h1><p className="mt-1 text-sm text-slate-500">Leurs nouvelles missions apparaîtront dans vos notifications.</p></div>

      {isLoading ? <Loading /> : loadError ? (
        <div className="mt-6 rounded-[22px] bg-rose-50 p-7 text-center"><p className="font-bold text-rose-800">Liste indisponible</p><p className="mt-1 text-sm text-rose-700">Vérifiez votre connexion puis réessayez.</p></div>
      ) : ngos.length === 0 ? (
        <div className="mt-6 rounded-[24px] bg-slate-50 p-8 text-center"><span className="mx-auto grid size-14 place-items-center rounded-full bg-sky-100 text-sky-700"><BellRing aria-hidden="true" size={24} /></span><h2 className="mt-4 font-bold">Vous ne suivez aucune ONG</h2><p className="mt-1 text-sm leading-6 text-slate-500">Découvrez les associations dans Explorer et suivez celles qui vous intéressent.</p><Link className="mt-5 inline-flex min-h-11 items-center rounded-full bg-sky-500 px-5 text-sm font-bold text-white" to="/explore">Explorer les ONG</Link></div>
      ) : (
        <section className="mt-5 space-y-3" aria-label="Liste des ONG suivies">
          {ngos.map((ngo) => (
            <Link aria-label={`Voir le profil de ${ngo.name}`} className="flex gap-3 rounded-[22px] border border-slate-200 bg-white p-4 transition active:scale-[0.99]" key={ngo.id} to={`/ngos/${ngo.id}`}>
              {ngo.logoUrl ? <img alt="" className="size-14 shrink-0 rounded-[18px] object-cover" src={ngo.logoUrl} /> : <span className="grid size-14 shrink-0 place-items-center rounded-[18px] bg-sky-100 text-sky-700"><Building2 aria-hidden="true" size={25} /></span>}
              <span className="min-w-0 flex-1"><strong className="flex items-center gap-1.5">{ngo.name}<ShieldCheck aria-label="ONG vérifiée" className="shrink-0 text-emerald-600" size={16} /></strong><span className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin aria-hidden="true" size={13} />{ngo.mainCity}</span>{ngo.description && <span className="mt-2 line-clamp-2 block text-sm leading-5 text-slate-600">{ngo.description}</span>}</span>
            </Link>
          ))}
        </section>
      )}
    </div>
  )
}

function Loading() {
  return <div className="grid min-h-64 place-items-center"><span className="size-9 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></div>
}
