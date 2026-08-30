import {
  ArrowLeft,
  BellPlus,
  BellRing,
  Building2,
  CalendarCheck2,
  ExternalLink,
  MapPin,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MissionCard } from '../components/MissionCard'
import { useAuth } from '../auth/auth-context'
import { getPublicNgoProfile, isFollowingNgo, setNgoFollowed } from '../services/ngos'
import type { PublicNgoMission, PublicNgoProfile } from '../services/ngos'

type MissionTab = 'upcoming' | 'completed'
const pageLoadedAt = Date.now()

const socialLabels: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  twitter: 'X / Twitter',
  x: 'X / Twitter',
  youtube: 'YouTube',
}

function safeExternalUrl(value: unknown) {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

export function NgoPublicProfilePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { ngoId = '' } = useParams()
  const [profile, setProfile] = useState<PublicNgoProfile | null>(null)
  const [missions, setMissions] = useState<PublicNgoMission[]>([])
  const [activeTab, setActiveTab] = useState<MissionTab>('upcoming')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [isFollowLoading, setIsFollowLoading] = useState(false)
  const [followMessage, setFollowMessage] = useState('')

  useEffect(() => {
    let isCurrent = true
    void getPublicNgoProfile(ngoId)
      .then((result) => {
        if (!isCurrent || !result) return
        setProfile(result.profile)
        setMissions(result.missions)
      })
      .catch(() => { if (isCurrent) setLoadError(true) })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [ngoId])

  useEffect(() => {
    if (!user || !ngoId) return
    let isCurrent = true
    void isFollowingNgo(ngoId)
      .then((following) => { if (isCurrent) setIsFollowing(following) })
      .catch(() => undefined)
    return () => { isCurrent = false }
  }, [ngoId, user])

  const groupedMissions = useMemo(() => {
    return {
      upcoming: missions.filter(({ mission, status }) => status === 'published' && new Date(mission.endsAt).getTime() > pageLoadedAt),
      completed: missions.filter(({ mission, status }) => status === 'completed' || new Date(mission.endsAt).getTime() <= pageLoadedAt),
    }
  }, [missions])

  if (isLoading) return <Loading />
  if (loadError) return <StatePage title="Profil indisponible" text="Vérifiez votre connexion puis réessayez." onBack={() => navigate(-1)} />
  if (!profile) return <StatePage title="Association introuvable" text="Cette association n’est pas disponible ou n’est plus approuvée." onBack={() => navigate('/explore')} />

  const websiteUrl = safeExternalUrl(profile.websiteUrl)
  const socialLinks = Object.entries(profile.socialLinks)
    .map(([name, value]) => ({ name, url: safeExternalUrl(value) }))
    .filter((link): link is { name: string; url: string } => Boolean(link.url))
  const memberSince = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(profile.memberSince))
  const visibleMissions = groupedMissions[activeTab]

  const toggleFollowing = async () => {
    if (!user) {
      navigate(`/auth?mode=login&returnTo=${encodeURIComponent(`/ngos/${ngoId}`)}`)
      return
    }
    const nextValue = !isFollowing
    setIsFollowLoading(true)
    setFollowMessage('')
    try {
      await setNgoFollowed(ngoId, nextValue)
      setIsFollowing(nextValue)
      setFollowMessage(nextValue ? 'Vous serez informé de ses nouvelles missions.' : 'Vous ne suivez plus cette ONG.')
    } catch {
      setFollowMessage('Impossible de modifier cet abonnement pour le moment.')
    } finally {
      setIsFollowLoading(false)
    }
  }

  return (
    <div className="pt-[max(0.5rem,env(safe-area-inset-top))]">
      <button aria-label="Retour" className="grid size-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-700" onClick={() => navigate(-1)} type="button"><ArrowLeft aria-hidden="true" size={20} /></button>

      <section className="mt-4 rounded-[28px] bg-slate-700 p-5 text-white">
        <div className="flex items-start gap-4">
          {profile.logoUrl ? <img alt={`Logo de ${profile.name}`} className="size-20 shrink-0 rounded-[24px] bg-white object-cover" src={profile.logoUrl} /> : <span className="grid size-20 shrink-0 place-items-center rounded-[24px] bg-sky-300 text-slate-700"><Building2 aria-hidden="true" size={34} /></span>}
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300"><ShieldCheck aria-hidden="true" size={13} />ONG vérifiée</span>
            <h1 className="mt-2 text-[25px] font-bold leading-tight tracking-[-0.03em]">{profile.name}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-white/70"><MapPin aria-hidden="true" size={14} />{profile.mainCity}</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-white/55">Membre de dfi3a depuis {memberSince}</p>
        <button aria-pressed={isFollowing} className={`mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold transition disabled:opacity-60 ${isFollowing ? 'bg-white/10 text-sky-200 ring-1 ring-white/20' : 'bg-sky-300 text-slate-700'}`} disabled={isFollowLoading} onClick={() => void toggleFollowing()} type="button">
          {isFollowing ? <BellRing aria-hidden="true" size={19} /> : <BellPlus aria-hidden="true" size={19} />}
          {isFollowLoading ? 'Mise à jour…' : isFollowing ? 'ONG suivie' : 'Suivre cette ONG'}
        </button>
        {followMessage && <p className="mt-2 text-center text-xs text-white/70" role="status">{followMessage}</p>}
      </section>

      {profile.categories.length > 0 && <div className="scrollbar-none -mr-4 mt-4 flex gap-2 overflow-x-auto pr-4 pb-1" aria-label="Causes de l’association">{profile.categories.map((category) => <span className="shrink-0 rounded-full bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700" key={category}>{category}</span>)}</div>}

      <section className="mt-6">
        <h2 className="text-lg font-bold">À propos</h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{profile.description || 'Cette association n’a pas encore ajouté de présentation publique.'}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-bold">Son activité sur dfi3a</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat icon={CalendarCheck2} label="Missions" value={profile.missionCount} />
          <Stat icon={ShieldCheck} label="Terminées" value={profile.completedMissionCount} />
          <Stat icon={UsersRound} label="Participations" value={profile.volunteerParticipationCount} />
        </div>
      </section>

      {(websiteUrl || socialLinks.length > 0) && (
        <section className="mt-6">
          <h2 className="text-lg font-bold">Liens officiels</h2>
          <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-[20px] border border-slate-200 bg-white">
            {websiteUrl && <ExternalLinkRow href={websiteUrl} label="Site officiel" />}
            {socialLinks.map(({ name, url }) => <ExternalLinkRow href={url} key={`${name}-${url}`} label={socialLabels[name.toLowerCase()] || name} />)}
          </div>
        </section>
      )}

      <section className="mt-7">
        <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-semibold text-sky-600">Missions publiques</p><h2 className="mt-1 text-xl font-bold">Agir avec {profile.name}</h2></div></div>
        <div className="mt-4 grid grid-cols-2 rounded-full bg-slate-100 p-1">
          <MissionTabButton active={activeTab === 'upcoming'} count={groupedMissions.upcoming.length} label="À venir" onClick={() => setActiveTab('upcoming')} />
          <MissionTabButton active={activeTab === 'completed'} count={groupedMissions.completed.length} label="Terminées" onClick={() => setActiveTab('completed')} />
        </div>

        {visibleMissions.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {visibleMissions.map(({ mission }) => <MissionCard key={mission.id} mission={mission} showSaveButton={false} />)}
          </div>
        ) : (
          <div className="mt-4 rounded-[22px] bg-slate-50 p-7 text-center"><p className="font-bold">{activeTab === 'upcoming' ? 'Aucune mission à venir' : 'Aucune mission terminée'}</p><p className="mt-1 text-sm text-slate-500">{activeTab === 'upcoming' ? 'Revenez bientôt pour découvrir ses prochaines actions.' : 'L’historique public apparaîtra ici.'}</p></div>
        )}
      </section>
    </div>
  )
}

function Stat({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: number }) {
  return <div className="rounded-[18px] bg-sky-50 p-3 text-center"><Icon aria-hidden="true" className="mx-auto text-sky-600" size={20} /><p className="mt-2 text-xl font-bold text-slate-800">{value}</p><p className="mt-0.5 text-[10px] font-semibold text-slate-500">{label}</p></div>
}

function ExternalLinkRow({ href, label }: { href: string; label: string }) {
  return <a className="flex min-h-13 items-center justify-between gap-3 px-4 text-sm font-semibold text-slate-700" href={href} rel="noreferrer" target="_blank"><span>{label}</span><ExternalLink aria-hidden="true" className="text-sky-600" size={17} /></a>
}

function MissionTabButton({ active, count, label, onClick }: { active: boolean; count: number; label: string; onClick: () => void }) {
  return <button aria-pressed={active} className={`min-h-11 rounded-full text-sm font-bold ${active ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'}`} onClick={onClick} type="button">{label} <span className="ml-1 text-xs opacity-70">{count}</span></button>
}

function Loading() {
  return <div className="grid min-h-72 place-items-center"><span className="size-9 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></div>
}

function StatePage({ onBack, text, title }: { onBack: () => void; text: string; title: string }) {
  return <div className="grid min-h-72 place-items-center px-5 text-center"><div><h1 className="text-xl font-bold">{title}</h1><p className="mt-2 text-sm text-slate-500">{text}</p><button className="mt-5 min-h-11 rounded-full bg-sky-500 px-5 text-sm font-bold text-white" onClick={onBack} type="button">Retour</button></div></div>
}
