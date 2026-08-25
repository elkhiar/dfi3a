import { ArrowLeft, Check, ImagePlus, Save, ShieldAlert } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { AddressAutocomplete } from '../components/AddressAutocomplete'
import type { AddressSelection } from '../components/AddressAutocomplete'
import {
  deleteMissionImage,
  getMissionFormOptions,
  getNgoMissionForEdit,
  updateNgoMission,
  uploadMissionImage,
} from '../services/ngos'
import type { NgoMissionEditSnapshot } from '../services/ngos'

type Option = { slug: string; name_fr: string }
type Difficulty = NgoMissionEditSnapshot['difficulty']

const difficulties: Array<{ description: string; label: string; value: Difficulty }> = [
  { value: 'standard', label: 'Standard', description: 'Accessible à la majorité' },
  { value: 'demanding', label: 'Soutenue', description: 'Effort notable' },
  { value: 'high', label: 'Élevée', description: 'Très exigeante' },
]

function toLocalDateTime(value: string) {
  const date = new Date(value)
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function approximateLocation(latitude: number, longitude: number) {
  const distanceMeters = 60 + Math.random() * 40
  const angle = Math.random() * Math.PI * 2
  return {
    latitude: latitude + (distanceMeters * Math.cos(angle)) / 111_320,
    longitude: longitude + (distanceMeters * Math.sin(angle)) / (111_320 * Math.cos((latitude * Math.PI) / 180)),
  }
}

function durationLabel(startsAt: string, endsAt: string) {
  const minutes = Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000)
  if (!Number.isFinite(minutes) || minutes <= 0) return 'Calculée automatiquement'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${hours ? `${hours} h` : ''}${hours && rest ? ' ' : ''}${rest ? `${rest} min` : ''}`
}

export function NgoMissionEditPage() {
  const { missionId } = useParams()
  const navigate = useNavigate()
  const { user, isLoading: isAuthLoading } = useAuth()
  const [mission, setMission] = useState<NgoMissionEditSnapshot | null>(null)
  const [categories, setCategories] = useState<Option[]>([])
  const [tags, setTags] = useState<Option[]>([])
  const [categorySlug, setCategorySlug] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [registrationDeadline, setRegistrationDeadline] = useState('')
  const [capacity, setCapacity] = useState('')
  const [unlimitedCapacity, setUnlimitedCapacity] = useState(false)
  const [difficulty, setDifficulty] = useState<Difficulty>('standard')
  const [difficultyJustification, setDifficultyJustification] = useState('')
  const [requirements, setRequirements] = useState('')
  const [accessibility, setAccessibility] = useState('')
  const [meetingInstructions, setMeetingInstructions] = useState('')
  const [organizerContact, setOrganizerContact] = useState('')
  const [address, setAddress] = useState<AddressSelection | null>(null)
  const [image, setImage] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!user || !missionId) return
    let isCurrent = true
    void Promise.all([getNgoMissionForEdit(missionId), getMissionFormOptions()])
      .then(([snapshot, options]) => {
        if (!isCurrent) return
        setMission(snapshot)
        setCategories(options.categories)
        setTags(options.tags)
        setCategorySlug(snapshot.categorySlug)
        setSelectedTags(snapshot.tagSlugs)
        setTitle(snapshot.title)
        setDescription(snapshot.description)
        setStartsAt(toLocalDateTime(snapshot.startsAt))
        setEndsAt(toLocalDateTime(snapshot.endsAt))
        setRegistrationDeadline(toLocalDateTime(snapshot.registrationDeadline))
        setUnlimitedCapacity(snapshot.capacity === null)
        setCapacity(snapshot.capacity === null ? '' : String(snapshot.capacity))
        setDifficulty(snapshot.difficulty)
        setDifficultyJustification(snapshot.difficultyJustification)
        setRequirements(snapshot.requirements.join('\n'))
        setAccessibility(snapshot.accessibility)
        setMeetingInstructions(snapshot.meetingInstructions)
        setOrganizerContact(snapshot.organizerContact)
        setAddress({
          formatted: snapshot.exactAddress,
          latitude: snapshot.exactLatitude,
          longitude: snapshot.exactLongitude,
          city: snapshot.city,
          generalArea: snapshot.generalArea,
        })
      })
      .catch(() => { if (isCurrent) setErrorMessage('Cette mission est introuvable ou ne vous appartient pas.') })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [missionId, user])

  const toggleTag = (slug: string) => setSelectedTags((current) => current.includes(slug)
    ? current.filter((tag) => tag !== slug)
    : [...current, slug])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !mission || !address) { setErrorMessage('Sélectionnez une adresse dans les suggestions.'); return }
    const start = new Date(startsAt)
    const end = new Date(endsAt)
    const deadline = new Date(registrationDeadline)
    if (end <= start) { setErrorMessage('La fin doit être postérieure au début.'); return }
    if (start <= new Date()) { setErrorMessage('Le début de la mission doit rester dans le futur.'); return }
    if (deadline >= start) { setErrorMessage('La date limite doit précéder le début de la mission.'); return }
    if (!unlimitedCapacity && (!Number.isInteger(Number(capacity)) || Number(capacity) < 1)) { setErrorMessage('Le nombre de places doit être un entier supérieur à zéro.'); return }
    if (difficulty !== 'standard' && !difficultyJustification.trim()) { setErrorMessage('Justifiez le niveau de difficulté choisi.'); return }
    if (image && (image.size > 8 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(image.type))) { setErrorMessage('L’image doit être un fichier JPG, PNG ou WebP de 8 Mo maximum.'); return }

    setIsSubmitting(true)
    setErrorMessage('')
    let uploadedImageUrl = ''
    try {
      const approximate = approximateLocation(address.latitude, address.longitude)
      const coverImagePath = image ? await uploadMissionImage(user.id, image) : null
      if (coverImagePath) uploadedImageUrl = coverImagePath
      const result = await updateNgoMission({
        id: mission.id,
        categorySlug,
        title: title.trim(),
        description: description.trim(),
        tagSlugs: selectedTags,
        coverImagePath,
        city: address.city,
        generalArea: address.generalArea,
        approximateLatitude: approximate.latitude,
        approximateLongitude: approximate.longitude,
        exactAddress: address.formatted,
        exactLatitude: address.latitude,
        exactLongitude: address.longitude,
        meetingInstructions: meetingInstructions.trim(),
        organizerContact: organizerContact.trim(),
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        registrationDeadline: deadline.toISOString(),
        capacity: unlimitedCapacity ? null : Number(capacity),
        difficulty,
        difficultyJustification: difficultyJustification.trim(),
        requirements: requirements.split('\n').map((item) => item.trim()).filter(Boolean),
        accessibility: accessibility.trim(),
      })
      navigate(`/missions/${result.mission_slug}`, { replace: true })
    } catch (error) {
      if (uploadedImageUrl) void deleteMissionImage(uploadedImageUrl).catch(() => undefined)
      const message = typeof error === 'object' && error && 'message' in error ? String(error.message) : ''
      setErrorMessage(message || 'La mission n’a pas pu être modifiée.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isAuthLoading || isLoading) return <main className="grid min-h-dvh place-items-center bg-white"><span className="size-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></main>
  if (!user || !mission) return <Blocked message={errorMessage || 'Connectez-vous avec le compte ONG propriétaire.'} />

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl bg-white px-5 pb-12 pt-5 text-slate-950">
      <button aria-label="Retour" className="grid size-11 place-items-center rounded-full border border-slate-200" onClick={() => navigate(`/missions/${mission.slug}`)} type="button"><ArrowLeft aria-hidden="true" size={21} /></button>
      <p className="mt-6 text-xs font-semibold text-sky-600">Espace ONG</p>
      <h1 className="mt-1 text-[28px] font-bold tracking-[-0.03em]">Modifier la mission</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">Les modifications seront visibles immédiatement par les bénévoles.</p>

      <form className="mt-7 space-y-6" onSubmit={submit}>
        <Section title="Présentation">
          <Field label="Titre" onChange={setTitle} required value={title} />
          <Area label="Description" onChange={setDescription} required value={description} />
          <label className="block rounded-[20px] border border-dashed border-sky-300 bg-sky-50 p-4"><FieldLabel label="Remplacer l’image" required={false} /><span className="mt-3 flex items-center gap-2 text-sm font-semibold text-sky-800"><ImagePlus aria-hidden="true" size={19} />{image?.name || 'Conserver l’image actuelle'}</span><input accept="image/jpeg,image/png,image/webp" className="mt-3 block w-full text-xs" onChange={(event) => setImage(event.target.files?.[0] ?? null)} type="file" /></label>
        </Section>

        <Section title="Catégorie et tags">
          <div><FieldLabel label="Catégorie principale" required /><div className="mt-3 grid grid-cols-2 gap-2">{categories.map((category) => <Choice active={categorySlug === category.slug} key={category.slug} label={category.name_fr} onClick={() => setCategorySlug(category.slug)} />)}</div></div>
          <div><FieldLabel label="Tags descriptifs" required={false} /><div className="mt-3 flex flex-wrap gap-2">{tags.map((tag) => <Choice active={selectedTags.includes(tag.slug)} compact key={tag.slug} label={tag.name_fr} onClick={() => toggleTag(tag.slug)} />)}</div></div>
        </Section>

        <Section title="Date et capacité">
          <Field label="Début" onChange={setStartsAt} required type="datetime-local" value={startsAt} />
          <Field label="Fin" onChange={setEndsAt} required type="datetime-local" value={endsAt} />
          <div className="flex items-center justify-between rounded-[18px] bg-emerald-50 p-4 text-sm text-emerald-800"><span className="font-semibold">Durée calculée</span><strong>{durationLabel(startsAt, endsAt)}</strong></div>
          <Field label="Date limite d’inscription" onChange={setRegistrationDeadline} required type="datetime-local" value={registrationDeadline} />
          <Field disabled={unlimitedCapacity} label="Nombre de places" onChange={setCapacity} required={!unlimitedCapacity} type="number" value={capacity} />
          <label className="flex items-center gap-3 rounded-[18px] bg-slate-50 p-4 text-sm font-semibold"><input checked={unlimitedCapacity} className="size-5 accent-sky-500" onChange={(event) => setUnlimitedCapacity(event.target.checked)} type="checkbox" />Places illimitées</label>
        </Section>

        <Section title="Lieu de rendez-vous">
          <AddressAutocomplete onSelect={setAddress} selection={address} />
          <Area label="Instructions de rendez-vous" onChange={setMeetingInstructions} required={false} value={meetingInstructions} />
          <Field label="Contact organisateur" onChange={setOrganizerContact} required value={organizerContact} />
        </Section>

        <Section title="Participation">
          <div><FieldLabel label="Niveau de difficulté" required /><div className="mt-3 grid grid-cols-3 gap-2">{difficulties.map((option) => <button aria-pressed={difficulty === option.value} className={`min-h-24 rounded-[20px] border p-3 text-center ${difficulty === option.value ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-200 bg-white text-slate-700'}`} key={option.value} onClick={() => setDifficulty(option.value)} type="button"><span className="block text-sm font-bold">{option.label}</span><span className="mt-1 block text-[10px] leading-4 opacity-70">{option.description}</span></button>)}</div></div>
          {difficulty !== 'standard' && <Area label="Justification de la difficulté" onChange={setDifficultyJustification} required value={difficultyJustification} />}
          <Area label="Conditions ou prérequis — une par ligne" onChange={setRequirements} required={false} value={requirements} />
          <Area label="Accessibilité" onChange={setAccessibility} required={false} value={accessibility} />
        </Section>

        {errorMessage && <p className="rounded-[16px] bg-rose-50 p-3 text-sm text-rose-700" role="alert">{errorMessage}</p>}
        <button className="flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-sky-500 text-sm font-bold text-white disabled:opacity-60" disabled={isSubmitting} type="submit"><Save aria-hidden="true" size={18} />{isSubmitting ? 'Enregistrement…' : 'Enregistrer les modifications'}</button>
      </form>
    </main>
  )
}

function Blocked({ message }: { message: string }) { return <main className="mx-auto grid min-h-dvh max-w-md place-items-center bg-white p-6 text-center"><div><ShieldAlert className="mx-auto text-sky-500" size={32} /><h1 className="mt-4 text-2xl font-bold">Modification indisponible</h1><p className="mt-2 text-sm text-slate-500">{message}</p><Link className="mt-6 inline-flex min-h-12 items-center rounded-full bg-sky-500 px-5 text-sm font-bold text-white" to="/ngo/missions">Retour aux missions</Link></div></main> }
function Section({ children, title }: { children: React.ReactNode; title: string }) { return <section className="space-y-5 rounded-[24px] border border-slate-200 bg-white p-4"><h2 className="text-lg font-bold">{title}</h2>{children}</section> }
function FieldLabel({ label, required }: { label: string; required: boolean }) { return <span className="flex items-center justify-between gap-3 text-sm font-semibold"><span>{label}</span><span className={`text-[10px] font-bold uppercase tracking-wide ${required ? 'text-rose-500' : 'text-slate-400'}`}>{required ? 'Obligatoire' : 'Facultatif'}</span></span> }
function Field({ disabled = false, label, onChange, required, type = 'text', value }: { disabled?: boolean; label: string; onChange: (value: string) => void; required: boolean; type?: string; value: string }) { return <label className={`block ${disabled ? 'opacity-45' : ''}`}><FieldLabel label={label} required={required} /><input className="mt-1.5 min-h-12 w-full rounded-[16px] border border-slate-300 px-3 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100" disabled={disabled} min={type === 'number' ? '1' : undefined} onChange={(event) => onChange(event.target.value)} required={required} type={type} value={value} /></label> }
function Area({ label, onChange, required, value }: { label: string; onChange: (value: string) => void; required: boolean; value: string }) { return <label className="block"><FieldLabel label={label} required={required} /><textarea className="mt-1.5 min-h-28 w-full resize-none rounded-[16px] border border-slate-300 p-3 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" onChange={(event) => onChange(event.target.value)} required={required} value={value} /></label> }
function Choice({ active, compact = false, label, onClick }: { active: boolean; compact?: boolean; label: string; onClick: () => void }) { return <button aria-pressed={active} className={`${compact ? 'rounded-full px-3 py-2 text-xs' : 'min-h-12 rounded-[16px] px-3 text-sm'} border font-bold ${active ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-200 bg-slate-50 text-slate-600'}`} onClick={onClick} type="button">{active && <Check aria-hidden="true" className="mr-1.5 inline" size={14} />}{label}</button> }
