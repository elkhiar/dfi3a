import { BellRing, CalendarCheck2, Camera, ChevronRight, Edit3, LogOut, MapPin, Save, Sparkles, Trophy, UsersRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { supabase } from '../lib/supabase'
import {
  getMyPointsSummary,
  getMyProfile,
  getAvatarPublicUrl,
  deleteProfileAvatar,
  uploadProfileAvatar,
  updateMyProfile,
} from '../services/profiles'
import type { PointsSummary, VolunteerProfile } from '../services/profiles'

const emptyPoints: PointsSummary = {
  totalPoints: 0,
  monthlyPoints: 0,
  completedMissions: 0,
}

export function ProfilePage() {
  const navigate = useNavigate()
  const { user, isLoading: isAuthLoading } = useAuth()
  const [profile, setProfile] = useState<VolunteerProfile | null>(null)
  const [draft, setDraft] = useState<VolunteerProfile | null>(null)
  const [points, setPoints] = useState<PointsSummary>(emptyPoints)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [loadError, setLoadError] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return

    let isCurrent = true

    void Promise.all([
      getMyProfile(),
      getMyPointsSummary().catch(() => emptyPoints),
    ])
      .then(([volunteerProfile, pointsSummary]) => {
        if (!isCurrent) return
        setProfile(volunteerProfile)
        setDraft(volunteerProfile)
        setPoints(pointsSummary)
      })
      .catch(() => {
        if (isCurrent) setLoadError(true)
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [user])

  if (!isAuthLoading && !user) {
    return (
      <div className="pt-8 text-center">
        <h1 className="text-2xl font-bold">Votre profil dfi3a</h1>
        <p className="mt-2 text-sm text-slate-500">Connectez-vous pour gérer votre profil et vos préférences.</p>
        <Link className="mt-5 inline-flex rounded-full bg-sky-500 px-5 py-3 text-sm font-bold text-white" to="/auth?mode=login&returnTo=%2Fprofile">
          Se connecter
        </Link>
      </div>
    )
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/auth?mode=login', { replace: true })
  }

  if (loadError) {
    return (
      <div className="grid min-h-72 place-items-center px-5 text-center">
        <div>
          <p className="font-bold">Impossible de charger ce profil.</p>
          <button className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-rose-200 px-5 text-sm font-semibold text-rose-600" onClick={() => void signOut()} type="button">
            <LogOut aria-hidden="true" size={18} /> Se déconnecter
          </button>
        </div>
      </div>
    )
  }

  if (isAuthLoading || isLoading || !profile || !draft) {
    return (
      <div className="grid min-h-72 place-items-center">
        <span className="block size-9 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
      </div>
    )
  }

  const initials = `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}` || 'D'

  const saveProfile = async () => {
    setIsSaving(true)
    setMessage('')

    try {
      await updateMyProfile(profile.userId, draft)
      setProfile(draft)
      setIsEditing(false)
      setMessage('Profil enregistré.')
    } catch {
      setMessage('Impossible d’enregistrer le profil.')
    } finally {
      setIsSaving(false)
    }
  }

  const changeAvatar = async (file: File | undefined) => {
    if (!file || !user) return
    setMessage('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('Choisissez une image JPG, PNG ou WebP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('La photo doit faire moins de 5 Mo.')
      return
    }

    setIsUploadingAvatar(true)
    let nextPath = ''
    try {
      nextPath = await uploadProfileAvatar(user.id, file)
      const nextProfile = { ...draft, avatarPath: nextPath }
      await updateMyProfile(profile.userId, nextProfile)
      const previousPath = profile.avatarPath
      setProfile(nextProfile)
      setDraft(nextProfile)
      setMessage('Photo de profil mise à jour.')
      if (previousPath && previousPath !== nextPath) {
        void deleteProfileAvatar(previousPath).catch(() => undefined)
      }
    } catch {
      if (nextPath) void deleteProfileAvatar(nextPath).catch(() => undefined)
      setMessage('Impossible d’enregistrer cette photo.')
    } finally {
      setIsUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  return (
    <div className="pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-bold tracking-[-0.03em]">Profil</h1>
        <button
          className="grid size-11 place-items-center rounded-full border border-slate-200 text-slate-600"
          onClick={() => {
            if (isEditing) void saveProfile()
            else setIsEditing(true)
          }}
          type="button"
        >
          {isEditing ? <Save aria-label="Enregistrer" size={19} /> : <Edit3 aria-label="Modifier" size={19} />}
        </button>
      </div>

      <section className="mt-5 flex items-center gap-4">
        <div className="relative shrink-0">
          {profile.avatarPath ? (
            <img alt={`Photo de ${profile.firstName}`} className="size-20 rounded-[26px] object-cover" src={getAvatarPublicUrl(profile.avatarPath) ?? undefined} />
          ) : (
            <span className="grid size-20 place-items-center rounded-[26px] bg-sky-500 text-2xl font-bold text-white">
              {initials.toUpperCase()}
            </span>
          )}
          <input
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => void changeAvatar(event.target.files?.[0])}
            ref={avatarInputRef}
            type="file"
          />
          <button
            aria-label="Changer la photo de profil"
            className="absolute -bottom-2 -right-2 grid size-9 place-items-center rounded-full border-2 border-white bg-slate-700 text-white shadow-md disabled:opacity-60"
            disabled={isUploadingAvatar}
            onClick={() => avatarInputRef.current?.click()}
            type="button"
          >
            {isUploadingAvatar ? <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Camera aria-hidden="true" size={17} />}
          </button>
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold">{profile.firstName} {profile.lastName}</h2>
          <p className="mt-1 truncate text-sm text-slate-500">{user?.email}</p>
          {profile.city && (
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <MapPin aria-hidden="true" size={13} /> {profile.city}
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-[24px] bg-slate-700 p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-sky-200">Total vérifié</p>
            <p className="mt-1 text-3xl font-bold">{points.totalPoints} <span className="text-lg text-sky-300">pts</span></p>
          </div>
          <span className="grid size-12 place-items-center rounded-full bg-sky-300 text-slate-700">
            <Trophy aria-hidden="true" size={23} />
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/15 pt-4">
          <Stat icon={Sparkles} label="Ce mois" value={`${points.monthlyPoints} pts`} />
          <Stat icon={CalendarCheck2} label="Missions validées" value={String(points.completedMissions)} />
        </div>
      </section>

      {isEditing ? (
        <section className="mt-6 space-y-4">
          <h2 className="text-lg font-bold">Informations privées</h2>
          <div className="grid grid-cols-2 gap-3">
            <ProfileField label="Prénom" value={draft.firstName} onChange={(firstName) => setDraft({ ...draft, firstName })} />
            <ProfileField label="Nom" value={draft.lastName} onChange={(lastName) => setDraft({ ...draft, lastName })} />
          </div>
          <ProfileField label="Ville" value={draft.city} onChange={(city) => setDraft({ ...draft, city })} />
          <ProfileField label="Date de naissance · privée" type="date" value={draft.birthdate} onChange={(birthdate) => setDraft({ ...draft, birthdate })} />
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Bio</span>
            <textarea className="min-h-24 w-full resize-none rounded-[16px] border border-slate-300 p-3 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" maxLength={300} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} value={draft.bio} />
          </label>
          <button className="min-h-12 w-full rounded-full bg-sky-500 text-sm font-bold text-white disabled:opacity-60" disabled={isSaving} onClick={() => void saveProfile()} type="button">
            {isSaving ? 'Enregistrement…' : 'Enregistrer le profil'}
          </button>
        </section>
      ) : profile.bio ? (
        <p className="mt-5 rounded-[20px] bg-slate-50 p-4 text-sm leading-6 text-slate-600">{profile.bio}</p>
      ) : null}

      <div className="mt-5 divide-y divide-slate-100 overflow-hidden rounded-[22px] border border-slate-200 bg-white">
        <Link className="flex min-h-16 items-center gap-3 px-4" to="/friends"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700"><UsersRound aria-hidden="true" size={19} /></span><span className="min-w-0 flex-1"><strong className="block text-sm">Amis et demandes</strong><span className="mt-0.5 block text-xs text-slate-500">Gérer votre réseau bénévole</span></span><ChevronRight aria-hidden="true" className="text-slate-400" size={19} /></Link>
        <Link className="flex min-h-16 items-center gap-3 px-4" to="/following"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700"><BellRing aria-hidden="true" size={19} /></span><span className="min-w-0 flex-1"><strong className="block text-sm">ONG suivies</strong><span className="mt-0.5 block text-xs text-slate-500">Gérer vos abonnements</span></span><ChevronRight aria-hidden="true" className="text-slate-400" size={19} /></Link>
      </div>

      <section className="mt-6">
        <h2 className="text-lg font-bold">Confidentialité</h2>
        <div className="mt-3 divide-y divide-slate-100 rounded-[22px] border border-slate-200 px-4">
          <PrivacyToggle checked={draft.showInDirectory} label="Apparaître dans la recherche d’utilisateurs" onChange={(showInDirectory) => setDraft({ ...draft, showInDirectory })} />
          <PrivacyToggle checked={draft.showInParticipants} label="Visible parmi les participants" onChange={(showInParticipants) => setDraft({ ...draft, showInParticipants })} />
          <PrivacyToggle checked={draft.showInLeaderboard} label="Participer au classement" onChange={(showInLeaderboard) => setDraft({ ...draft, showInLeaderboard })} />
          <PrivacyToggle checked={draft.showCity} label="Afficher ma ville" onChange={(showCity) => setDraft({ ...draft, showCity })} />
        </div>
        {(draft.showInDirectory !== profile.showInDirectory || draft.showInParticipants !== profile.showInParticipants || draft.showInLeaderboard !== profile.showInLeaderboard || draft.showCity !== profile.showCity) && (
          <button className="mt-3 min-h-11 w-full rounded-full bg-sky-500 text-sm font-bold text-white" onClick={() => void saveProfile()} type="button">Enregistrer les préférences</button>
        )}
      </section>

      {message && <p className="mt-4 text-center text-sm text-slate-600" role="status">{message}</p>}

      <button className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-rose-200 text-sm font-semibold text-rose-600" onClick={() => void signOut()} type="button">
        <LogOut aria-hidden="true" size={18} /> Se déconnecter
      </button>
    </div>
  )
}

function Stat({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string }) {
  return <div className="flex items-center gap-2"><Icon aria-hidden="true" className="text-sky-300" size={18} /><div><p className="text-[10px] text-white/60">{label}</p><p className="text-sm font-bold">{value}</p></div></div>
}

function ProfileField({ label, onChange, type = 'text', value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold">{label}</span><input className="min-h-12 w-full rounded-[16px] border border-slate-300 px-3 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" onChange={(event) => onChange(event.target.value)} type={type} value={value} /></label>
}

function PrivacyToggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-14 items-center justify-between gap-3"><span className="text-sm font-medium">{label}</span><input checked={checked} className="size-5 accent-sky-500" onChange={(event) => onChange(event.target.checked)} type="checkbox" /></label>
}
