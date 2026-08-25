import { ArrowLeft, Check, ImagePlus, Info, ShieldAlert, Sparkles, X } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { AddressAutocomplete } from '../components/AddressAutocomplete'
import type { AddressSelection } from '../components/AddressAutocomplete'
import { getCategoryIllustrationPath } from '../lib/category-illustrations'
import { createNgoMission, deleteMissionImage, getMissionFormOptions, getMyNgoApplication, uploadMissionImage } from '../services/ngos'

type Option = { slug: string; name_fr: string }
type Difficulty = 'standard' | 'demanding' | 'high'
type RegistrationDeadlinePreset = '30m' | '1h' | '24h' | 'custom'
type RequirementGroup = 'skills' | 'equipment'

const difficulties: Array<{ description: string; label: string; value: Difficulty }> = [
  { value: 'standard', label: 'Standard', description: 'Accessible à la majorité' },
  { value: 'demanding', label: 'Soutenue', description: 'Effort ou technicité notable' },
  { value: 'high', label: 'Élevée', description: 'Conditions particulièrement exigeantes' },
]

const registrationDeadlineOptions: Array<{ label: string; value: RegistrationDeadlinePreset }> = [
  { value: '30m', label: '30 minutes avant' },
  { value: '1h', label: '1h avant' },
  { value: '24h', label: '24h avant' },
  { value: 'custom', label: 'Autre' },
]

const requirementGroups: Array<{ description: string; label: string; suggestions: string[]; value: RequirementGroup }> = [
  {
    value: 'skills',
    label: 'Compétences spécifiques',
    description: 'Savoir-faire utiles pour participer',
    suggestions: ['Premiers secours', 'Animation', 'Enseignement ou tutorat', 'Bricolage', 'Jardinage', 'Communication', 'Conduite'],
  },
  {
    value: 'equipment',
    label: 'Matériel spécifique à ramener',
    description: 'Équipement demandé aux bénévoles',
    suggestions: ['Gants de protection', 'Chaussures fermées', 'Tenue adaptée', 'Bouteille d’eau', 'Casquette', 'Protection solaire', 'Téléphone chargé'],
  },
]

const accessibilityOptions = [
  'Accessible aux PMR',
  'Accessible aux personnes malvoyantes',
  'Accessible aux personnes malentendantes',
  'Activité adaptable',
  'Accompagnant accepté',
]

function calculateDurationMinutes(startsAt: string, endsAt: string) {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null
  return Math.round((end.getTime() - start.getTime()) / 60_000)
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (!hours) return `${remainingMinutes} min`
  return remainingMinutes ? `${hours} h ${remainingMinutes} min` : `${hours} h`
}

function slugify(value: string) {
  return `${value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${crypto.randomUUID().slice(0, 6)}`
}

function approximateLocation(latitude: number, longitude: number) {
  const distanceMeters = 60 + Math.random() * 40
  const angle = Math.random() * Math.PI * 2
  const latitudeOffset = (distanceMeters * Math.cos(angle)) / 111_320
  const longitudeOffset = (distanceMeters * Math.sin(angle)) / (111_320 * Math.cos((latitude * Math.PI) / 180))
  return { latitude: latitude + latitudeOffset, longitude: longitude + longitudeOffset }
}

export function NgoMissionCreatePage() {
  const navigate = useNavigate()
  const { user, isLoading: isAuthLoading } = useAuth()
  const [categories, setCategories] = useState<Option[]>([])
  const [tags, setTags] = useState<Option[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isApproved, setIsApproved] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [requestUrgent, setRequestUrgent] = useState(false)
  const [unlimitedCapacity, setUnlimitedCapacity] = useState(false)
  const [registrationDeadlinePreset, setRegistrationDeadlinePreset] = useState<RegistrationDeadlinePreset>('1h')
  const [startsAtValue, setStartsAtValue] = useState('')
  const [endsAtValue, setEndsAtValue] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [address, setAddress] = useState<AddressSelection | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('standard')
  const [pendingDifficulty, setPendingDifficulty] = useState<Exclude<Difficulty, 'standard'> | null>(null)
  const [difficultyJustification, setDifficultyJustification] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [activeRequirementGroup, setActiveRequirementGroup] = useState<RequirementGroup | null>(null)
  const [selectedRequirements, setSelectedRequirements] = useState<Record<RequirementGroup, string[]>>({ skills: [], equipment: [] })
  const [customRequirement, setCustomRequirement] = useState('')
  const [showCustomRequirement, setShowCustomRequirement] = useState(false)
  const [selectedAccessibility, setSelectedAccessibility] = useState<string[]>([])
  const [showCustomAccessibility, setShowCustomAccessibility] = useState(false)
  const [customAccessibility, setCustomAccessibility] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [loadError, setLoadError] = useState(false)
  const calculatedDurationMinutes = calculateDurationMinutes(startsAtValue, endsAtValue)
  const activeRequirementOptions = requirementGroups.find((group) => group.value === activeRequirementGroup)

  useEffect(() => {
    if (!user) return
    let isCurrent = true
    void Promise.all([getMyNgoApplication(), getMissionFormOptions()])
      .then(([application, options]) => {
        if (!isCurrent) return
        setIsApproved(application?.status === 'approved')
        setCategories(options.categories)
        setTags(options.tags)
        setSelectedCategory(options.categories[0]?.slug ?? '')
      })
      .catch(() => { if (isCurrent) setLoadError(true) })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [user])

  const chooseDifficulty = (nextDifficulty: Difficulty) => {
    if (nextDifficulty === 'standard') {
      setDifficulty('standard')
      setDifficultyJustification('')
      return
    }
    setPendingDifficulty(nextDifficulty)
    setDialogError('')
  }

  const confirmDifficulty = () => {
    if (!difficultyJustification.trim()) {
      setDialogError('Expliquez brièvement pourquoi cette mission est plus exigeante.')
      return
    }
    if (pendingDifficulty) setDifficulty(pendingDifficulty)
    setPendingDifficulty(null)
    setDialogError('')
  }

  const toggleTag = (slug: string) => {
    setSelectedTags((current) => current.includes(slug)
      ? current.filter((tag) => tag !== slug)
      : [...current, slug],
    )
  }

  const toggleRequirement = (group: RequirementGroup, requirement: string) => {
    setSelectedRequirements((current) => ({
      ...current,
      [group]: current[group].includes(requirement)
        ? current[group].filter((item) => item !== requirement)
        : [...current[group], requirement],
    }))
  }

  const addCustomRequirement = () => {
    const requirement = customRequirement.trim()
    if (!activeRequirementGroup || !requirement) return
    setSelectedRequirements((current) => ({
      ...current,
      [activeRequirementGroup]: current[activeRequirementGroup].includes(requirement)
        ? current[activeRequirementGroup]
        : [...current[activeRequirementGroup], requirement],
    }))
    setCustomRequirement('')
    setShowCustomRequirement(false)
  }

  const toggleAccessibility = (option: string) => {
    setSelectedAccessibility((current) => current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option],
    )
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) return
    if (!selectedCategory) { setErrorMessage('Choisissez une catégorie.'); return }
    if (!address) { setErrorMessage('Sélectionnez une adresse dans les suggestions.'); return }

    setIsSubmitting(true)
    setErrorMessage('')
    const form = new FormData(event.currentTarget)
    const value = (name: string) => String(form.get(name) || '').trim()
    let uploadedImageUrl = ''

    try {
      const title = value('title')
      const description = value('description')
      const summary = description.replace(/\s+/g, ' ').slice(0, 180)
      const approximate = approximateLocation(address.latitude, address.longitude)
      const startsAt = new Date(startsAtValue)
      const endsAt = new Date(endsAtValue)
      const registrationDeadline = registrationDeadlinePreset === 'custom'
        ? new Date(value('registrationDeadline'))
        : new Date(startsAt.getTime() - ({ '30m': 30, '1h': 60, '24h': 1_440 }[registrationDeadlinePreset] * 60_000))

      if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || calculatedDurationMinutes == null) {
        setErrorMessage('La fin de la mission doit être postérieure à son début.')
        return
      }
      if (startsAt <= new Date()) {
        setErrorMessage('Le début de la mission doit être dans le futur.')
        return
      }
      if (Number.isNaN(registrationDeadline.getTime())) {
        setErrorMessage('Vérifiez la date limite d’inscription.')
        return
      }
      if (registrationDeadline >= startsAt) {
        setErrorMessage('La date limite d’inscription doit être antérieure au début de la mission.')
        return
      }

      if (!unlimitedCapacity && (!Number.isInteger(Number(value('capacity'))) || Number(value('capacity')) < 1)) {
        setErrorMessage('Le nombre de places doit être un entier supérieur à zéro.')
        return
      }
      if (image && (image.size > 8 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(image.type))) {
        setErrorMessage('L’image doit être un fichier JPG, PNG ou WebP de 8 Mo maximum.')
        return
      }
      if (requestUrgent) {
        const urgencyNeededAt = new Date(value('urgencyNeededBy'))
        if (Number.isNaN(urgencyNeededAt.getTime())) {
          setErrorMessage('Indiquez quand le besoin urgent doit être couvert.')
          return
        }
        if (urgencyNeededAt <= new Date()) {
          setErrorMessage('La date du besoin urgent doit être dans le futur.')
          return
        }
      }

      const coverImagePath = image
        ? await uploadMissionImage(user.id, image)
        : getCategoryIllustrationPath(selectedCategory)
      if (image) uploadedImageUrl = coverImagePath
      const requirements = [
        ...selectedRequirements.skills.map((item) => `Compétence : ${item}`),
        ...selectedRequirements.equipment.map((item) => `Matériel : ${item}`),
      ]
      const accessibility = [...selectedAccessibility, customAccessibility.trim()].filter(Boolean).join(' · ')

      const result = await createNgoMission({
        slug: slugify(title), categorySlug: selectedCategory, title, summary, description,
        coverImagePath, city: address.city, generalArea: address.generalArea,
        approximateLatitude: approximate.latitude, approximateLongitude: approximate.longitude,
        exactAddress: address.formatted, exactLatitude: address.latitude,
        exactLongitude: address.longitude,
        meetingInstructions: value('meetingInstructions'), organizerContact: value('organizerContact'),
        startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(),
        activeDurationMinutes: calculatedDurationMinutes,
        registrationDeadline: registrationDeadline.toISOString(),
        capacity: unlimitedCapacity ? null : Number(value('capacity')),
        difficulty, difficultyJustification,
        requirements,
        accessibility, tagSlugs: selectedTags,
        requestUrgent, urgencyJustification: value('urgencyJustification'),
        urgencyNeededBy: requestUrgent ? new Date(value('urgencyNeededBy')).toISOString() : null,
      })
      navigate(`/missions/${result.mission_slug}`, { replace: true })
    } catch (error) {
      if (uploadedImageUrl) void deleteMissionImage(uploadedImageUrl).catch(() => undefined)
      const message = typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : ''
      setErrorMessage(message || 'La mission n’a pas pu être créée.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isAuthLoading && !user) return <Blocked />
  if (isAuthLoading || isLoading) return <main className="grid min-h-dvh place-items-center bg-white"><span className="size-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></main>
  if (loadError) return <main className="grid min-h-dvh place-items-center bg-white p-6 text-center"><div><h1 className="text-xl font-bold">Formulaire indisponible</h1><p className="mt-2 text-sm text-slate-500">Les catégories n’ont pas pu être chargées.</p><button className="mt-5 min-h-11 rounded-full bg-sky-500 px-5 text-sm font-bold text-white" onClick={() => window.location.reload()} type="button">Réessayer</button></div></main>
  if (!isApproved) return <Blocked />

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl bg-white px-5 pb-12 pt-5 text-slate-950">
      <button aria-label="Retour" className="grid size-11 place-items-center rounded-full border border-slate-200" onClick={() => navigate('/ngo/missions')} type="button"><ArrowLeft aria-hidden="true" size={21} /></button>
      <p className="mt-6 text-xs font-semibold text-sky-600">Nouvelle publication</p>
      <h1 className="mt-1 text-[28px] font-bold tracking-[-0.03em]">Créer une mission</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">L’adresse exacte sera révélée uniquement aux bénévoles inscrits.</p>
      <div className="mt-4 flex gap-4 rounded-[16px] bg-slate-50 p-3 text-[11px]"><span className="font-bold text-rose-500">Obligatoire</span><span className="font-semibold text-slate-400">Facultatif</span></div>

      <form className="mt-7 space-y-6" onSubmit={submit}>
        <Section title="Présentation">
          <Field label="Titre" maxLength={120} minLength={3} name="title" />
          <Area label="Description" minLength={10} name="description" />
          <label className="block overflow-hidden rounded-[20px] border border-dashed border-sky-300 bg-sky-50">
            {!image && <img alt="Illustration proposée pour la catégorie sélectionnée" className="h-36 w-full object-cover" src={getCategoryIllustrationPath(selectedCategory)} />}
            <span className="block p-4">
              <FieldLabel label="Image de couverture" required={false} />
              <span className="mt-3 flex items-center gap-2 text-sm font-semibold text-sky-800"><ImagePlus aria-hidden="true" size={19} />{image?.name || 'Ajouter votre propre image'}</span>
              <input accept="image/jpeg,image/png,image/webp" className="mt-3 block w-full text-xs" onChange={(event) => setImage(event.target.files?.[0] ?? null)} type="file" />
              <span className="mt-2 block text-[11px] leading-5 text-slate-500">Sans photo, cette illustration sera utilisée automatiquement selon la catégorie.</span>
            </span>
          </label>
        </Section>

        <Section title="Catégorie et tags">
          <div><FieldLabel label="Catégorie principale" required /><div className="mt-3 grid grid-cols-2 gap-2">{categories.map((category) => <ChoiceButton active={selectedCategory === category.slug} key={category.slug} label={category.name_fr} onClick={() => setSelectedCategory(category.slug)} />)}</div></div>
          <div><FieldLabel label="Tags descriptifs" required={false} /><p className="mt-1 text-xs text-slate-500">Ils améliorent la recherche par mots-clés.</p><div className="mt-3 flex flex-wrap gap-2">{tags.map((tag) => <button aria-pressed={selectedTags.includes(tag.slug)} className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${selectedTags.includes(tag.slug) ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-300 bg-white text-slate-600'}`} key={tag.slug} onClick={() => toggleTag(tag.slug)} type="button">{selectedTags.includes(tag.slug) && <Check aria-hidden="true" className="mr-1 inline" size={13} />}{tag.name_fr}</button>)}</div></div>
        </Section>

        <Section title="Date et capacité">
          <Field label="Début" name="startsAt" onInput={(event) => setStartsAtValue(event.currentTarget.value)} type="datetime-local" value={startsAtValue} />
          <Field label="Fin" name="endsAt" onInput={(event) => setEndsAtValue(event.currentTarget.value)} type="datetime-local" value={endsAtValue} />
          <div className={`flex items-center justify-between gap-3 rounded-[18px] p-4 ${calculatedDurationMinutes == null ? 'bg-slate-50 text-slate-500' : 'bg-emerald-50 text-emerald-800'}`}>
            <span className="text-sm font-semibold">Durée de l’activité</span>
            <strong className="text-sm">{calculatedDurationMinutes == null ? 'Calculée automatiquement' : formatDuration(calculatedDurationMinutes)}</strong>
          </div>
          <div>
            <FieldLabel label="Date limite d’inscription" required />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {registrationDeadlineOptions.map((option) => (
                <ChoiceButton
                  active={registrationDeadlinePreset === option.value}
                  key={option.value}
                  label={option.label}
                  onClick={() => setRegistrationDeadlinePreset(option.value)}
                />
              ))}
            </div>
            {registrationDeadlinePreset === 'custom' && (
              <div className="mt-3 rounded-[18px] bg-sky-50 p-3">
                <Field label="Choisir la date et l’heure" name="registrationDeadline" type="datetime-local" />
              </div>
            )}
            {registrationDeadlinePreset !== 'custom' && (
              <p className="mt-2 text-xs leading-5 text-slate-500">La date limite sera calculée automatiquement à partir du début de la mission.</p>
            )}
          </div>
          <Field disabled={unlimitedCapacity} label="Nombre de places" min="1" name="capacity" required={!unlimitedCapacity} type="number" />
          <label className="flex items-center gap-3 rounded-[18px] bg-slate-50 p-4 text-sm font-semibold"><input checked={unlimitedCapacity} className="size-5 accent-sky-500" onChange={(event) => setUnlimitedCapacity(event.target.checked)} type="checkbox" />Places illimitées</label>
        </Section>

        <Section title="Lieu de rendez-vous">
          <AddressAutocomplete onSelect={setAddress} selection={address} />
          <Area label="Instructions de rendez-vous" name="meetingInstructions" required={false} />
          <Field label="Contact organisateur" name="organizerContact" placeholder="Téléphone ou e-mail" />
        </Section>

        <Section title="Participation et points">
          <div><FieldLabel label="Niveau de difficulté" required /><div className="mt-3 grid grid-cols-3 gap-2">{difficulties.map((option) => <button aria-pressed={difficulty === option.value} className={`min-h-24 rounded-[20px] border p-3 text-center transition ${difficulty === option.value ? 'border-sky-500 bg-sky-500 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700'}`} key={option.value} onClick={() => chooseDifficulty(option.value)} type="button"><span className="block text-sm font-bold">{option.label}</span><span className={`mt-1 block text-[10px] leading-4 ${difficulty === option.value ? 'text-white/75' : 'text-slate-400'}`}>{option.description}</span></button>)}</div></div>
          {difficulty !== 'standard' && <div className="flex items-start gap-2 rounded-[16px] bg-sky-50 p-3 text-xs leading-5 text-sky-800"><Info aria-hidden="true" className="mt-0.5 shrink-0" size={16} /><span><strong>Justification :</strong> {difficultyJustification}</span></div>}
          <div>
            <FieldLabel label="Conditions ou prérequis" required={false} />
            <p className="mt-1 text-xs leading-5 text-slate-500">Choisissez un type pour afficher des suggestions adaptées.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {requirementGroups.map((group) => (
                <button className="min-h-28 rounded-[20px] border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-sky-300 hover:bg-sky-50" key={group.value} onClick={() => { setActiveRequirementGroup(group.value); setCustomRequirement(''); setShowCustomRequirement(false) }} type="button">
                  <span className="block text-sm font-bold text-slate-800">{group.label}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-slate-500">{group.description}</span>
                  <span className="mt-2 block text-[11px] font-bold text-sky-600">{selectedRequirements[group.value].length ? `${selectedRequirements[group.value].length} sélectionné${selectedRequirements[group.value].length > 1 ? 's' : ''}` : 'Choisir'}</span>
                </button>
              ))}
            </div>
            {[...selectedRequirements.skills, ...selectedRequirements.equipment].length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {[...selectedRequirements.skills, ...selectedRequirements.equipment].map((requirement) => <span className="rounded-full bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800" key={requirement}>{requirement}</span>)}
              </div>
            )}
          </div>
          <div>
            <FieldLabel label="Accessibilité" required={false} />
            <p className="mt-1 text-xs leading-5 text-slate-500">Sélectionnez toutes les adaptations disponibles.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {accessibilityOptions.map((option) => (
                <button aria-pressed={selectedAccessibility.includes(option)} className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${selectedAccessibility.includes(option) ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white text-slate-600'}`} key={option} onClick={() => toggleAccessibility(option)} type="button">{selectedAccessibility.includes(option) && <Check aria-hidden="true" className="mr-1 inline" size={13} />}{option}</button>
              ))}
              <button aria-pressed={showCustomAccessibility} className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${showCustomAccessibility ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white text-slate-600'}`} onClick={() => setShowCustomAccessibility((current) => !current)} type="button">Autre</button>
            </div>
            {showCustomAccessibility && <input className="mt-3 min-h-12 w-full rounded-[16px] border border-slate-300 px-3 text-base outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" onChange={(event) => setCustomAccessibility(event.target.value)} placeholder="Précisez l’adaptation disponible" type="text" value={customAccessibility} />}
          </div>
        </Section>

        <Section title="Statut urgent">
          <label className="flex items-start gap-3 rounded-[18px] bg-amber-50 p-4 text-sm"><input checked={requestUrgent} className="mt-0.5 size-5 accent-amber-600" onChange={(event) => setRequestUrgent(event.target.checked)} type="checkbox" /><span><strong>Demander le statut urgent</strong><span className="mt-1 block text-xs leading-5 text-amber-900/70">Facultatif · la mission reste publiée pendant la validation.</span></span></label>
          {requestUrgent && <><Area label="Pourquoi cette mission est-elle urgente ?" name="urgencyJustification" /><Field label="Besoin urgent avant" name="urgencyNeededBy" type="datetime-local" /></>}
        </Section>

        {errorMessage && <p className="rounded-[16px] bg-rose-50 p-3 text-sm text-rose-700" role="alert">{errorMessage}</p>}
        <button className="min-h-13 w-full rounded-full bg-sky-500 text-sm font-bold text-white disabled:opacity-60" disabled={isSubmitting} type="submit">{isSubmitting ? 'Publication…' : 'Publier la mission'}</button>
      </form>

      {pendingDifficulty && <div className="fixed inset-0 z-[70] grid place-items-end bg-slate-950/45 p-3 sm:place-items-center" role="presentation"><div aria-labelledby="difficulty-title" aria-modal="true" className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-xl" role="dialog"><div className="flex items-start justify-between gap-4"><div><span className="grid size-11 place-items-center rounded-full bg-sky-100 text-sky-700"><Sparkles aria-hidden="true" size={21} /></span><h2 className="mt-4 text-xl font-bold" id="difficulty-title">Justifier la difficulté {pendingDifficulty === 'demanding' ? 'soutenue' : 'élevée'}</h2></div><button aria-label="Fermer" className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500" onClick={() => setPendingDifficulty(null)} type="button"><X aria-hidden="true" size={19} /></button></div><p className="mt-2 text-sm leading-6 text-slate-500">Cette information aide le bénévole à décider en connaissance de cause.</p><textarea autoFocus className="mt-4 min-h-28 w-full resize-none rounded-[18px] border border-slate-300 p-3 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" onChange={(event) => setDifficultyJustification(event.target.value)} placeholder="Ex. port de charges, longue marche, chaleur…" value={difficultyJustification} />{dialogError && <p className="mt-2 text-xs text-rose-600" role="alert">{dialogError}</p>}<button className="mt-4 min-h-12 w-full rounded-full bg-sky-500 text-sm font-bold text-white" onClick={confirmDifficulty} type="button">Confirmer ce niveau</button></div></div>}

      {activeRequirementGroup && activeRequirementOptions && (
        <div className="fixed inset-0 z-[70] grid place-items-end bg-slate-950/45 p-3 sm:place-items-center" role="presentation">
          <div aria-labelledby="requirement-title" aria-modal="true" className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-xl" role="dialog">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold text-sky-600">Suggestions</p><h2 className="mt-1 text-xl font-bold" id="requirement-title">{activeRequirementOptions.label}</h2></div>
              <button aria-label="Fermer" className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500" onClick={() => setActiveRequirementGroup(null)} type="button"><X aria-hidden="true" size={19} /></button>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">Sélectionnez tout ce qui s’applique à la mission.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {activeRequirementOptions.suggestions.map((suggestion) => (
                <button aria-pressed={selectedRequirements[activeRequirementGroup].includes(suggestion)} className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${selectedRequirements[activeRequirementGroup].includes(suggestion) ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-300 bg-white text-slate-600'}`} key={suggestion} onClick={() => toggleRequirement(activeRequirementGroup, suggestion)} type="button">{selectedRequirements[activeRequirementGroup].includes(suggestion) && <Check aria-hidden="true" className="mr-1 inline" size={13} />}{suggestion}</button>
              ))}
              <button aria-pressed={showCustomRequirement} className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${showCustomRequirement ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-300 bg-white text-slate-600'}`} onClick={() => setShowCustomRequirement((current) => !current)} type="button">Autre</button>
            </div>
            {showCustomRequirement && <div className="mt-4 flex gap-2"><input autoFocus className="min-h-12 min-w-0 flex-1 rounded-[16px] border border-slate-300 px-3 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" onChange={(event) => setCustomRequirement(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomRequirement() } }} placeholder="Ajouter une autre condition" type="text" value={customRequirement} /><button className="rounded-[16px] bg-slate-900 px-4 text-sm font-bold text-white" onClick={addCustomRequirement} type="button">Ajouter</button></div>}
            <button className="mt-5 min-h-12 w-full rounded-full bg-sky-500 text-sm font-bold text-white" onClick={() => setActiveRequirementGroup(null)} type="button">Terminer</button>
          </div>
        </div>
      )}
    </main>
  )
}

function Blocked() { return <main className="mx-auto grid min-h-dvh max-w-md place-items-center bg-white p-6 text-center"><div><ShieldAlert className="mx-auto text-sky-500" size={32} /><h1 className="mt-4 text-2xl font-bold">ONG approuvée requise</h1><p className="mt-2 text-sm text-slate-500">Votre organisation doit être validée avant de publier.</p><Link className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-sky-500 px-5 text-sm font-bold text-white" to="/ngo/apply"><ArrowLeft aria-hidden="true" size={18} />Retour à ma demande</Link></div></main> }
function Section({ children, title }: { children: React.ReactNode; title: string }) { return <section className="space-y-5 rounded-[24px] border border-slate-200 bg-white p-4"><h2 className="text-lg font-bold">{title}</h2>{children}</section> }
function FieldLabel({ label, required }: { label: string; required: boolean }) { return <span className="flex items-center justify-between gap-3 text-sm font-semibold"><span>{label}</span><span className={`text-[10px] font-bold uppercase tracking-wide ${required ? 'text-rose-500' : 'text-slate-400'}`}>{required ? 'Obligatoire' : 'Facultatif'}</span></span> }
function Field({ disabled = false, label, maxLength, min, minLength, name, onInput, placeholder, required = true, step, type = 'text', value }: { disabled?: boolean; label: string; maxLength?: number; min?: string; minLength?: number; name: string; onInput?: React.FormEventHandler<HTMLInputElement>; placeholder?: string; required?: boolean; step?: string; type?: string; value?: string }) { return <label className={`block ${disabled ? 'opacity-45' : ''}`}><FieldLabel label={label} required={required} /><input className="mt-1.5 min-h-12 w-full rounded-[16px] border border-slate-300 px-3 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100" disabled={disabled} maxLength={maxLength} min={min} minLength={minLength} name={name} onInput={onInput} placeholder={placeholder} required={required} step={step} type={type} value={value} /></label> }
function Area({ label, minLength, name, required = true }: { label: string; minLength?: number; name: string; required?: boolean }) { return <label className="block"><FieldLabel label={label} required={required} /><textarea className="mt-1.5 min-h-28 w-full resize-none rounded-[16px] border border-slate-300 p-3 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" minLength={minLength} name={name} required={required} /></label> }
function ChoiceButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) { return <button aria-pressed={active} className={`min-h-12 rounded-[16px] border px-3 text-sm font-bold transition ${active ? 'border-sky-500 bg-sky-500 text-white shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600'}`} onClick={onClick} type="button">{active && <Check aria-hidden="true" className="mr-1.5 inline" size={16} />}{label}</button> }
