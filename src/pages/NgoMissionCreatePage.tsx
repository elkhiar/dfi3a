import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  ImagePlus,
  Info,
  LogIn,
  MapPin,
  ShieldAlert,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { AddressAutocomplete } from '../components/AddressAutocomplete'
import type { AddressSelection } from '../components/AddressAutocomplete'
import { DBuxAmount } from '../components/DBuxIcon'
import { getCategoryIllustrationPath } from '../lib/category-illustrations'
import { parseMoroccoDateTimeInput } from '../lib/date-time'
import { createNgoMission, deleteMissionImage, getMissionFormOptions, getMyNgoApplication, uploadMissionImage } from '../services/ngos'

type Option = { slug: string; name_fr: string }
type Difficulty = 'standard' | 'demanding' | 'high'
type RegistrationDeadlinePreset = '30m' | '1h' | '24h' | 'custom'
type ActivityDurationPreset = '30m' | '45m' | '1h' | '2h' | '3h' | 'custom'
type RequirementGroup = 'skills' | 'equipment'
type Step = 1 | 2 | 3 | 4 | 5

type FormValues = {
  title: string
  description: string
  startsAt: string
  endsAt: string
  registrationDeadline: string
  capacity: string
  meetingInstructions: string
  organizerContact: string
  urgencyJustification: string
  urgencyNeededBy: string
}

type StoredDraft = {
  formValues: FormValues
  selectedCategory: string
  selectedTags: string[]
  requestUrgent: boolean
  unlimitedCapacity: boolean
  registrationDeadlinePreset: RegistrationDeadlinePreset
  activityDurationPreset?: ActivityDurationPreset
  address: AddressSelection | null
  difficulty: Difficulty
  difficultyJustification: string
  selectedRequirements: Record<RequirementGroup, string[]>
  selectedAccessibility: string[]
  customAccessibility: string
}

const DRAFT_STORAGE_KEY = 'dfi3a:ngo-mission-draft:v1'
const emptyFormValues: FormValues = { title: '', description: '', startsAt: '', endsAt: '', registrationDeadline: '', capacity: '', meetingInstructions: '', organizerContact: '', urgencyJustification: '', urgencyNeededBy: '' }
const emptyRequirements: Record<RequirementGroup, string[]> = { skills: [], equipment: [] }

function loadDraft(): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY)
    return raw ? JSON.parse(raw) as StoredDraft : null
  } catch { return null }
}

const steps: Array<{ id: Step; eyebrow: string; title: string }> = [
  { id: 1, eyebrow: 'L’essentiel', title: 'Présentez la mission' },
  { id: 2, eyebrow: 'Organisation', title: 'Où et quand ?' },
  { id: 3, eyebrow: 'Participation', title: 'Préparez l’accueil' },
  { id: 4, eyebrow: 'Valorisation', title: 'Difficulté et urgence' },
  { id: 5, eyebrow: 'Dernière étape', title: 'Vérifiez avant de publier' },
]

const difficulties: Array<{ description: string; label: string; value: Difficulty }> = [
  { value: 'standard', label: 'Standard', description: 'Accessible à la majorité' },
  { value: 'demanding', label: 'Soutenue', description: 'Effort ou technicité notable' },
  { value: 'high', label: 'Élevée', description: 'Conditions exigeantes' },
]

const registrationDeadlineOptions: Array<{ label: string; value: RegistrationDeadlinePreset }> = [
  { value: '30m', label: '30 min avant' }, { value: '1h', label: '1 h avant' },
  { value: '24h', label: '24 h avant' }, { value: 'custom', label: 'Autre' },
]

const activityDurationOptions: Array<{ label: string; minutes: number | null; value: ActivityDurationPreset }> = [
  { value: '30m', label: '30 min', minutes: 30 },
  { value: '45m', label: '45 min', minutes: 45 },
  { value: '1h', label: '1 h', minutes: 60 },
  { value: '2h', label: '2 h', minutes: 120 },
  { value: '3h', label: '3 h', minutes: 180 },
  { value: 'custom', label: 'Autre', minutes: null },
]

const requirementGroups: Array<{ description: string; label: string; suggestions: string[]; value: RequirementGroup }> = [
  { value: 'skills', label: 'Compétences spécifiques', description: 'Savoir-faire utiles', suggestions: ['Premiers secours', 'Animation', 'Enseignement ou tutorat', 'Bricolage', 'Jardinage', 'Communication', 'Conduite'] },
  { value: 'equipment', label: 'Matériel à ramener', description: 'Équipement demandé', suggestions: ['Gants de protection', 'Chaussures fermées', 'Tenue adaptée', 'Bouteille d’eau', 'Casquette', 'Protection solaire', 'Téléphone chargé'] },
]

const accessibilityOptions = ['Accessible aux PMR', 'Accessible aux personnes malvoyantes', 'Accessible aux personnes malentendantes', 'Activité adaptable', 'Accompagnant accepté']

function calculateDurationMinutes(startsAt: string, endsAt: string) {
  const start = parseMoroccoDateTimeInput(startsAt)
  const end = parseMoroccoDateTimeInput(endsAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null
  return Math.round((end.getTime() - start.getTime()) / 60_000)
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (!hours) return `${remainingMinutes} min`
  return remainingMinutes ? `${hours} h ${remainingMinutes} min` : `${hours} h`
}

function formatPreviewDate(value: string) {
  const date = parseMoroccoDateTimeInput(value)
  if (Number.isNaN(date.getTime())) return 'Date à compléter'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Casablanca' }).format(date)
}

function formatMoroccoDateTimeInput(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}

function calculateSuggestedEnd(startsAtValue: string, preset: ActivityDurationPreset) {
  const start = parseMoroccoDateTimeInput(startsAtValue)
  const minutes = activityDurationOptions.find((option) => option.value === preset)?.minutes
  if (Number.isNaN(start.getTime()) || minutes == null) return ''
  return formatMoroccoDateTimeInput(new Date(start.getTime() + minutes * 60_000))
}

function slugify(value: string) {
  return `${value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${crypto.randomUUID().slice(0, 6)}`
}

function approximateLocation(latitude: number, longitude: number) {
  const distanceMeters = 60 + Math.random() * 40
  const angle = Math.random() * Math.PI * 2
  return {
    latitude: latitude + (distanceMeters * Math.cos(angle)) / 111_320,
    longitude: longitude + (distanceMeters * Math.sin(angle)) / (111_320 * Math.cos((latitude * Math.PI) / 180)),
  }
}

function calculateRegistrationDeadline(startsAtValue: string, preset: RegistrationDeadlinePreset, customValue: string) {
  const startsAt = parseMoroccoDateTimeInput(startsAtValue)
  return preset === 'custom'
    ? parseMoroccoDateTimeInput(customValue)
    : new Date(startsAt.getTime() - ({ '30m': 30, '1h': 60, '24h': 1_440 }[preset] * 60_000))
}

export function NgoMissionCreatePage() {
  const navigate = useNavigate()
  const { user, isLoading: isAuthLoading } = useAuth()
  const [initialDraft] = useState(loadDraft)
  const [step, setStep] = useState<Step>(1)
  const [formValues, setFormValues] = useState<FormValues>(initialDraft?.formValues ?? emptyFormValues)
  const [categories, setCategories] = useState<Option[]>([])
  const [tags, setTags] = useState<Option[]>([])
  const [selectedCategory, setSelectedCategory] = useState(initialDraft?.selectedCategory ?? '')
  const [selectedTags, setSelectedTags] = useState<string[]>(initialDraft?.selectedTags ?? [])
  const [isApproved, setIsApproved] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [requestUrgent, setRequestUrgent] = useState(initialDraft?.requestUrgent ?? false)
  const [unlimitedCapacity, setUnlimitedCapacity] = useState(initialDraft?.unlimitedCapacity ?? false)
  const [registrationDeadlinePreset, setRegistrationDeadlinePreset] = useState<RegistrationDeadlinePreset>(initialDraft?.registrationDeadlinePreset ?? '1h')
  const [activityDurationPreset, setActivityDurationPreset] = useState<ActivityDurationPreset>(initialDraft?.activityDurationPreset ?? (initialDraft?.formValues.endsAt ? 'custom' : '1h'))
  const [minimumStartValue] = useState(() => formatMoroccoDateTimeInput(new Date(Math.ceil((Date.now() + 2 * 60 * 60_000) / 60_000) * 60_000)))
  const [image, setImage] = useState<File | null>(null)
  const [address, setAddress] = useState<AddressSelection | null>(initialDraft?.address ?? null)
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDraft?.difficulty ?? 'standard')
  const [pendingDifficulty, setPendingDifficulty] = useState<Exclude<Difficulty, 'standard'> | null>(null)
  const [difficultyJustification, setDifficultyJustification] = useState(initialDraft?.difficultyJustification ?? '')
  const [dialogError, setDialogError] = useState('')
  const [activeRequirementGroup, setActiveRequirementGroup] = useState<RequirementGroup | null>(null)
  const [selectedRequirements, setSelectedRequirements] = useState<Record<RequirementGroup, string[]>>(initialDraft?.selectedRequirements ?? emptyRequirements)
  const [customRequirement, setCustomRequirement] = useState('')
  const [showCustomRequirement, setShowCustomRequirement] = useState(false)
  const [selectedAccessibility, setSelectedAccessibility] = useState<string[]>(initialDraft?.selectedAccessibility ?? [])
  const [showCustomAccessibility, setShowCustomAccessibility] = useState(Boolean(initialDraft?.customAccessibility))
  const [customAccessibility, setCustomAccessibility] = useState(initialDraft?.customAccessibility ?? '')
  const [errorMessage, setErrorMessage] = useState('')
  const [loadError, setLoadError] = useState(false)

  const calculatedDurationMinutes = calculateDurationMinutes(formValues.startsAt, formValues.endsAt)
  const pointsMultiplier = difficulty === 'high' ? 1.5 : difficulty === 'demanding' ? 1.2 : 1
  const estimatedPoints = calculatedDurationMinutes ? Math.round(Math.ceil(calculatedDurationMinutes / 60) * 40 * pointsMultiplier) : 0
  const activeRequirementOptions = requirementGroups.find((group) => group.value === activeRequirementGroup)
  const selectedCategoryName = categories.find((category) => category.slug === selectedCategory)?.name_fr ?? 'Catégorie'
  const imagePreviewUrl = useMemo(() => image ? URL.createObjectURL(image) : null, [image])
  const coverPreview = imagePreviewUrl ?? getCategoryIllustrationPath(selectedCategory)
  const currentStep = steps[step - 1]

  useEffect(() => {
    if (!user) return
    let isCurrent = true
    void Promise.all([getMyNgoApplication(), getMissionFormOptions()])
      .then(([application, options]) => {
        if (!isCurrent) return
        setIsApproved(application?.status === 'approved')
        setCategories(options.categories)
        setTags(options.tags)
        setSelectedCategory((current) => options.categories.some((category) => category.slug === current) ? current : options.categories[0]?.slug ?? '')
      })
      .catch(() => { if (isCurrent) setLoadError(true) })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [user])

  useEffect(() => {
    return () => { if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl) }
  }, [imagePreviewUrl])

  useEffect(() => {
    if (isLoading) return
    const draft: StoredDraft = { formValues, selectedCategory, selectedTags, requestUrgent, unlimitedCapacity, registrationDeadlinePreset, activityDurationPreset, address, difficulty, difficultyJustification, selectedRequirements, selectedAccessibility, customAccessibility }
    try { window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft)) } catch { /* Draft persistence is optional. */ }
  }, [activityDurationPreset, address, customAccessibility, difficulty, difficultyJustification, formValues, isLoading, registrationDeadlinePreset, requestUrgent, selectedAccessibility, selectedCategory, selectedRequirements, selectedTags, unlimitedCapacity])

  const updateField = (name: keyof FormValues, value: string) => setFormValues((current) => ({ ...current, [name]: value }))
  const showStepError = (message: string) => { setErrorMessage(message); window.scrollTo({ top: 0, behavior: 'smooth' }); return false }

  const validateStep = (targetStep: Step) => {
    if (targetStep === 1) {
      if (formValues.title.trim().length < 3) return showStepError('Ajoutez un titre d’au moins 3 caractères.')
      if (formValues.description.trim().length < 10) return showStepError('Décrivez la mission en au moins 10 caractères.')
      if (!selectedCategory) return showStepError('Choisissez une catégorie principale.')
      if (image && (image.size > 8 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(image.type))) return showStepError('L’image doit être un fichier JPG, PNG ou WebP de 8 Mo maximum.')
    }
    if (targetStep === 2) {
      const startsAt = parseMoroccoDateTimeInput(formValues.startsAt)
      if (!address) return showStepError('Sélectionnez une adresse dans les suggestions.')
      if (Number.isNaN(startsAt.getTime()) || calculatedDurationMinutes == null) return showStepError('Ajoutez un début et une fin valides.')
      if (startsAt.getTime() < new Date().getTime() + 2 * 60 * 60_000) return showStepError('La mission doit être publiée au moins 2 heures avant son début.')
    }
    if (targetStep === 3) {
      if (!unlimitedCapacity && (!Number.isInteger(Number(formValues.capacity)) || Number(formValues.capacity) < 1)) return showStepError('Indiquez un nombre de places supérieur à zéro ou choisissez les places illimitées.')
      if (!formValues.organizerContact.trim()) return showStepError('Ajoutez un contact organisateur.')
      const deadline = calculateRegistrationDeadline(formValues.startsAt, registrationDeadlinePreset, formValues.registrationDeadline)
      const startsAt = parseMoroccoDateTimeInput(formValues.startsAt)
      if (Number.isNaN(deadline.getTime()) || deadline >= startsAt) return showStepError('La date limite doit être antérieure au début de la mission.')
      if (deadline <= new Date()) return showStepError('Ce choix place la fin des inscriptions dans le passé. Choisissez un délai plus court.')
    }
    if (targetStep === 4) {
      if (difficulty !== 'standard' && !difficultyJustification.trim()) return showStepError('Justifiez le niveau de difficulté choisi.')
      if (requestUrgent) {
        const urgentAt = parseMoroccoDateTimeInput(formValues.urgencyNeededBy)
        if (!formValues.urgencyJustification.trim()) return showStepError('Expliquez pourquoi la mission est urgente.')
        if (Number.isNaN(urgentAt.getTime()) || urgentAt <= new Date()) return showStepError('Ajoutez une date future pour le besoin urgent.')
      }
    }
    setErrorMessage('')
    return true
  }

  const continueToNextStep = () => {
    if (!validateStep(step) || step === 5) return
    setStep((step + 1) as Step)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const updateStartDate = (value: string) => {
    setFormValues((current) => ({
      ...current,
      startsAt: value,
      endsAt: activityDurationPreset === 'custom' ? current.endsAt : calculateSuggestedEnd(value, activityDurationPreset),
    }))
  }

  const chooseActivityDuration = (preset: ActivityDurationPreset) => {
    setActivityDurationPreset(preset)
    if (preset !== 'custom') setFormValues((current) => ({ ...current, endsAt: calculateSuggestedEnd(current.startsAt, preset) }))
  }

  const goBack = () => {
    if (step === 1) { navigate('/ngo/dashboard'); return }
    setErrorMessage('')
    setStep((step - 1) as Step)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const chooseDifficulty = (nextDifficulty: Difficulty) => {
    if (nextDifficulty === 'standard') { setDifficulty('standard'); setDifficultyJustification(''); return }
    setPendingDifficulty(nextDifficulty as Exclude<Difficulty, 'standard'>)
    setDialogError('')
  }

  const confirmDifficulty = () => {
    if (!difficultyJustification.trim()) { setDialogError('Expliquez brièvement pourquoi cette mission est plus exigeante.'); return }
    if (pendingDifficulty) setDifficulty(pendingDifficulty)
    setPendingDifficulty(null)
    setDialogError('')
  }

  const toggleTag = (slug: string) => setSelectedTags((current) => current.includes(slug) ? current.filter((tag) => tag !== slug) : [...current, slug])
  const toggleRequirement = (group: RequirementGroup, requirement: string) => setSelectedRequirements((current) => ({ ...current, [group]: current[group].includes(requirement) ? current[group].filter((item) => item !== requirement) : [...current[group], requirement] }))
  const toggleAccessibility = (option: string) => setSelectedAccessibility((current) => current.includes(option) ? current.filter((item) => item !== option) : [...current, option])

  const addCustomRequirement = () => {
    const requirement = customRequirement.trim()
    if (!activeRequirementGroup || !requirement) return
    setSelectedRequirements((current) => ({ ...current, [activeRequirementGroup]: current[activeRequirementGroup].includes(requirement) ? current[activeRequirementGroup] : [...current[activeRequirementGroup], requirement] }))
    setCustomRequirement('')
    setShowCustomRequirement(false)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !validateStep(4) || !address || calculatedDurationMinutes == null) return
    setIsSubmitting(true)
    setErrorMessage('')
    let uploadedImageUrl = ''
    try {
      const startsAt = parseMoroccoDateTimeInput(formValues.startsAt)
      const endsAt = parseMoroccoDateTimeInput(formValues.endsAt)
      const registrationDeadline = calculateRegistrationDeadline(formValues.startsAt, registrationDeadlinePreset, formValues.registrationDeadline)
      const approximate = approximateLocation(address.latitude, address.longitude)
      const coverImagePath = image ? await uploadMissionImage(user.id, image) : getCategoryIllustrationPath(selectedCategory)
      if (image) uploadedImageUrl = coverImagePath
      const requirements = [...selectedRequirements.skills.map((item) => `Compétence : ${item}`), ...selectedRequirements.equipment.map((item) => `Matériel : ${item}`)]
      const accessibility = [...selectedAccessibility, customAccessibility.trim()].filter(Boolean).join(' · ')
      const title = formValues.title.trim()
      const description = formValues.description.trim()

      const result = await createNgoMission({
        slug: slugify(title), categorySlug: selectedCategory, title, summary: description.replace(/\s+/g, ' ').slice(0, 180), description,
        coverImagePath, city: address.city, generalArea: address.generalArea,
        approximateLatitude: approximate.latitude, approximateLongitude: approximate.longitude,
        exactAddress: address.formatted, exactLatitude: address.latitude, exactLongitude: address.longitude,
        meetingInstructions: formValues.meetingInstructions.trim(), organizerContact: formValues.organizerContact.trim(),
        startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), activeDurationMinutes: calculatedDurationMinutes,
        registrationDeadline: registrationDeadline.toISOString(), capacity: unlimitedCapacity ? null : Number(formValues.capacity),
        difficulty, difficultyJustification, requirements, accessibility, tagSlugs: selectedTags,
        requestUrgent, urgencyJustification: formValues.urgencyJustification.trim(),
        urgencyNeededBy: requestUrgent ? parseMoroccoDateTimeInput(formValues.urgencyNeededBy).toISOString() : null,
      })
      try { window.localStorage.removeItem(DRAFT_STORAGE_KEY) } catch { /* Optional cleanup. */ }
      navigate(`/missions/${result.mission_slug}`, { replace: true })
    } catch (error) {
      if (uploadedImageUrl) void deleteMissionImage(uploadedImageUrl).catch(() => undefined)
      const message = typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : ''
      setErrorMessage(message || 'La mission n’a pas pu être créée.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally { setIsSubmitting(false) }
  }

  if (!isAuthLoading && !user) return <SignInRequired />
  if (isAuthLoading || isLoading) return <main className="grid min-h-dvh place-items-center bg-white"><span className="size-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></main>
  if (loadError) return <main className="grid min-h-dvh place-items-center bg-white p-6 text-center"><div><h1 className="text-xl font-bold">Formulaire indisponible</h1><p className="mt-2 text-sm text-slate-500">Les catégories n’ont pas pu être chargées.</p><button className="mt-5 min-h-11 rounded-full bg-sky-500 px-5 text-sm font-bold text-white" onClick={() => window.location.reload()} type="button">Réessayer</button></div></main>
  if (!isApproved) return <ApprovedNgoRequired />

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl bg-slate-50 pb-32 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3"><button aria-label="Retour" className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-700" onClick={goBack} type="button"><ArrowLeft aria-hidden="true" size={20} /></button><span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600"><CheckCircle2 aria-hidden="true" size={14} />{image ? 'Sauvegardé hors photo' : 'Brouillon enregistré'}</span><span className="w-10 text-right text-xs font-bold text-sky-600">{step}/5</span></div>
        <div className="mt-4 flex gap-1.5" aria-label={`Étape ${step} sur 5`}>{steps.map((item) => <span className={`h-1.5 flex-1 rounded-full transition ${item.id <= step ? 'bg-sky-500' : 'bg-slate-200'}`} key={item.id} />)}</div>
      </header>

      <form className="px-5 pt-7" onSubmit={submit}>
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-sky-600">{currentStep.eyebrow}</p>
        <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.035em]">{currentStep.title}</h1>

        {errorMessage && <p className="mt-5 rounded-[18px] bg-rose-50 p-4 text-sm font-medium text-rose-700" role="alert">{errorMessage}</p>}

        {step === 1 && <div className="mt-7 space-y-6">
          <Field label="Donnez un titre clair" maxLength={120} minLength={3} onChange={(value) => updateField('title', value)} placeholder="Ex. Nettoyage de la plage d’Aïn Diab" value={formValues.title} />
          <Area label="Décrivez ce que feront les bénévoles" minLength={10} onChange={(value) => updateField('description', value)} placeholder="Expliquez simplement l’objectif et le déroulement…" value={formValues.description} />
          <div><FieldLabel label="Choisissez une catégorie" required /><div className="mt-3 grid grid-cols-2 gap-3">{categories.map((category) => <button aria-pressed={selectedCategory === category.slug} className={`relative isolate h-28 overflow-hidden rounded-[20px] border-2 text-left ${selectedCategory === category.slug ? 'border-sky-500 shadow-md' : 'border-transparent'}`} key={category.slug} onClick={() => setSelectedCategory(category.slug)} type="button"><img alt="" className="absolute inset-0 size-full object-cover" src={getCategoryIllustrationPath(category.slug)} /><span className="absolute inset-0 bg-slate-950/45" /><span className="absolute inset-x-3 bottom-3 z-10 text-sm font-bold text-white">{category.name_fr}</span>{selectedCategory === category.slug && <span className="absolute right-2 top-2 z-10 grid size-7 place-items-center rounded-full bg-sky-500 text-white"><Check aria-hidden="true" size={16} /></span>}</button>)}</div></div>
          <details className="rounded-[20px] border border-slate-200 bg-white p-4"><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold">Ajouter des tags <span className="flex items-center gap-2 text-xs font-medium text-slate-400">Facultatif <ChevronDown aria-hidden="true" size={17} /></span></summary><p className="mt-2 text-xs text-slate-500">Ils aideront les bénévoles à trouver la mission.</p><div className="mt-4 flex flex-wrap gap-2">{tags.map((tag) => <Chip active={selectedTags.includes(tag.slug)} key={tag.slug} label={tag.name_fr} onClick={() => toggleTag(tag.slug)} />)}</div></details>
          <label className="block overflow-hidden rounded-[22px] border border-dashed border-sky-300 bg-white"><img alt="Aperçu de la couverture" className="h-40 w-full object-cover" src={coverPreview} /><span className="flex items-center justify-between gap-3 p-4"><span><span className="block text-sm font-bold">Image de couverture</span><span className="mt-1 block text-[11px] text-slate-500">Facultative · une illustration est déjà prête</span></span><span className="grid size-11 place-items-center rounded-full bg-sky-50 text-sky-600"><ImagePlus aria-hidden="true" size={20} /></span></span><input accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => setImage(event.target.files?.[0] ?? null)} type="file" /></label>
        </div>}

        {step === 2 && <div className="mt-7 space-y-6">
          <Section icon={MapPin} title="Lieu de rendez-vous"><AddressAutocomplete onSelect={setAddress} selection={address} /><div className="flex items-start gap-2 rounded-[16px] bg-sky-50 p-3 text-xs leading-5 text-sky-800"><Info aria-hidden="true" className="mt-0.5 shrink-0" size={15} />L’adresse exacte sera uniquement révélée aux bénévoles inscrits. Les autres verront une zone approximative.</div></Section>
          <Section icon={CalendarDays} title="Date et horaires"><p className="text-xs leading-5 text-slate-500">Heure de Casablanca · prévoyez au moins 2 heures entre la publication et le début.</p><Field label="Début de la mission" min={minimumStartValue} onChange={updateStartDate} type="datetime-local" value={formValues.startsAt} /><div><FieldLabel label="Durée prévue" required /><div className="mt-3 grid grid-cols-3 gap-2">{activityDurationOptions.map((option) => <ChoiceButton active={activityDurationPreset === option.value} key={option.value} label={option.label} onClick={() => chooseActivityDuration(option.value)} />)}</div></div>{activityDurationPreset === 'custom' && <Field label="Fin de la mission" min={formValues.startsAt || minimumStartValue} onChange={(value) => updateField('endsAt', value)} type="datetime-local" value={formValues.endsAt} />}{activityDurationPreset !== 'custom' && <div className={`flex items-center justify-between gap-3 rounded-[18px] p-4 ${calculatedDurationMinutes == null ? 'bg-slate-50 text-slate-500' : 'bg-emerald-50 text-emerald-800'}`}><span className="flex items-center gap-2 text-sm font-semibold"><Clock3 aria-hidden="true" size={17} />Fin calculée</span><strong className="text-right text-sm">{formValues.endsAt ? formatPreviewDate(formValues.endsAt) : 'Choisissez le début'}</strong></div>}</Section>
        </div>}

        {step === 3 && <div className="mt-7 space-y-6">
          <Section icon={UsersRound} title="Places et inscriptions"><Field disabled={unlimitedCapacity} label="Nombre de places" min="1" onChange={(value) => updateField('capacity', value)} required={!unlimitedCapacity} type="number" value={formValues.capacity} /><label className="flex items-center gap-3 rounded-[18px] bg-slate-50 p-4 text-sm font-semibold"><input checked={unlimitedCapacity} className="size-5 accent-sky-500" onChange={(event) => setUnlimitedCapacity(event.target.checked)} type="checkbox" />Places illimitées</label><div><FieldLabel label="Fin des inscriptions" required /><div className="mt-3 grid grid-cols-2 gap-2">{registrationDeadlineOptions.map((option) => <ChoiceButton active={registrationDeadlinePreset === option.value} key={option.value} label={option.label} onClick={() => setRegistrationDeadlinePreset(option.value)} />)}</div>{registrationDeadlinePreset === 'custom' && <div className="mt-3"><Field label="Date et heure" onChange={(value) => updateField('registrationDeadline', value)} type="datetime-local" value={formValues.registrationDeadline} /></div>}</div></Section>
          <Section icon={Sparkles} title="Aidez les bénévoles à se préparer"><div className="grid grid-cols-2 gap-2">{requirementGroups.map((group) => <button className="min-h-28 rounded-[20px] border border-slate-200 bg-slate-50 p-3 text-left" key={group.value} onClick={() => { setActiveRequirementGroup(group.value); setCustomRequirement(''); setShowCustomRequirement(false) }} type="button"><span className="block text-sm font-bold">{group.label}</span><span className="mt-1 block text-[11px] text-slate-500">{group.description}</span><span className="mt-3 block text-[11px] font-bold text-sky-600">{selectedRequirements[group.value].length ? `${selectedRequirements[group.value].length} sélectionné${selectedRequirements[group.value].length > 1 ? 's' : ''}` : 'Choisir'}</span></button>)}</div>{[...selectedRequirements.skills, ...selectedRequirements.equipment].length > 0 && <div className="flex flex-wrap gap-2">{[...selectedRequirements.skills, ...selectedRequirements.equipment].map((item) => <span className="rounded-full bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800" key={item}>{item}</span>)}</div>}<div><FieldLabel label="Accessibilité" required={false} /><div className="mt-3 flex flex-wrap gap-2">{accessibilityOptions.map((option) => <Chip active={selectedAccessibility.includes(option)} key={option} label={option} onClick={() => toggleAccessibility(option)} tone="emerald" />)}<Chip active={showCustomAccessibility} label="Autre" onClick={() => setShowCustomAccessibility((current) => !current)} tone="emerald" /></div>{showCustomAccessibility && <input className="mt-3 min-h-12 w-full rounded-[16px] border border-slate-300 px-3 outline-none focus:border-emerald-500" onChange={(event) => setCustomAccessibility(event.target.value)} placeholder="Précisez l’adaptation" value={customAccessibility} />}</div></Section>
          <details className="rounded-[22px] border border-slate-200 bg-white p-4" open><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold">Contact et consignes <ChevronDown aria-hidden="true" size={17} /></summary><div className="mt-5 space-y-4"><Field label="Contact organisateur" onChange={(value) => updateField('organizerContact', value)} placeholder="Téléphone ou e-mail" value={formValues.organizerContact} /><Area label="Instructions de rendez-vous" onChange={(value) => updateField('meetingInstructions', value)} placeholder="Point de rencontre, personne à contacter…" required={false} value={formValues.meetingInstructions} /></div></details>
        </div>}

        {step === 4 && <div className="mt-7 space-y-6">
          <Section icon={Sparkles} title="Niveau de difficulté"><div className="grid grid-cols-3 gap-2">{difficulties.map((option) => <button aria-pressed={difficulty === option.value} className={`min-h-28 rounded-[20px] border p-3 text-center transition ${difficulty === option.value ? 'border-sky-500 bg-sky-500 text-white shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-700'}`} key={option.value} onClick={() => chooseDifficulty(option.value)} type="button"><span className="block text-sm font-bold">{option.label}</span><span className={`mt-1 block text-[10px] leading-4 ${difficulty === option.value ? 'text-white/75' : 'text-slate-400'}`}>{option.description}</span></button>)}</div>{difficulty !== 'standard' && <div className="flex items-start gap-2 rounded-[16px] bg-sky-50 p-3 text-xs leading-5 text-sky-800"><Info aria-hidden="true" className="mt-0.5 shrink-0" size={16} /><span><strong>Justification :</strong> {difficultyJustification}</span></div>}<div className="flex items-center justify-between rounded-[20px] bg-slate-900 p-4 text-white"><span><span className="block text-xs text-white/60">Estimation actuelle</span><strong className="mt-1 block text-xl"><DBuxAmount amount={estimatedPoints} /></strong>{requestUrgent && <span className="mt-1 block text-[10px] text-amber-300">+ 40 si l’urgence est approuvée</span>}</span><span className="text-right text-[10px] leading-4 text-white/55">Durée × difficulté<br />calculées automatiquement</span></div></Section>
          <Section icon={ShieldAlert} title="Cette mission est-elle urgente ?"><label className={`flex cursor-pointer items-start gap-3 rounded-[18px] border p-4 text-sm transition ${requestUrgent ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}><input checked={requestUrgent} className="mt-0.5 size-5 accent-amber-600" onChange={(event) => setRequestUrgent(event.target.checked)} type="checkbox" /><span><strong>Demander le statut urgent</strong><span className="mt-1 block text-xs leading-5 text-slate-500">La mission sera publiée normalement pendant l’examen par l’administrateur.</span></span></label>{requestUrgent && <div className="space-y-4"><Area label="Pourquoi est-elle urgente ?" onChange={(value) => updateField('urgencyJustification', value)} placeholder="Expliquez le besoin…" value={formValues.urgencyJustification} /><Field label="Besoin à couvrir avant" onChange={(value) => updateField('urgencyNeededBy', value)} type="datetime-local" value={formValues.urgencyNeededBy} /></div>}</Section>
        </div>}

        {step === 5 && <div className="mt-7 space-y-5">
          <div className="overflow-hidden rounded-[26px] bg-white shadow-sm"><div className="relative h-48"><img alt="Aperçu de la mission" className="size-full object-cover" src={coverPreview} /><span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-800">{selectedCategoryName}</span><span className="absolute right-3 top-3 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-800"><DBuxAmount amount={estimatedPoints} /></span></div><div className="p-5"><h2 className="text-xl font-bold leading-tight">{formValues.title}</h2><p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{formValues.description}</p><div className="mt-5 space-y-2.5 text-xs text-slate-600"><p className="flex items-center gap-2"><CalendarDays aria-hidden="true" className="text-sky-500" size={16} />{formatPreviewDate(formValues.startsAt)} · {calculatedDurationMinutes ? formatDuration(calculatedDurationMinutes) : ''}</p><p className="flex items-center gap-2"><MapPin aria-hidden="true" className="text-sky-500" size={16} />{address?.generalArea}, {address?.city}</p><p className="flex items-center gap-2"><UsersRound aria-hidden="true" className="text-sky-500" size={16} />{unlimitedCapacity ? 'Places illimitées' : `${formValues.capacity} places`}</p></div></div></div>
          <div className="flex items-start gap-3 rounded-[20px] bg-sky-50 p-4 text-sm leading-6 text-sky-900"><Eye aria-hidden="true" className="mt-0.5 shrink-0" size={19} /><span><strong>Ce que verront les bénévoles.</strong><br />L’adresse exacte et les consignes privées resteront masquées jusqu’à l’inscription.</span></div>
          <div className="grid grid-cols-2 gap-3">{steps.slice(0, 4).map((item) => <button className="rounded-[18px] border border-slate-200 bg-white p-3 text-left" key={item.id} onClick={() => { setStep(item.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }} type="button"><span className="text-[10px] font-bold uppercase text-sky-600">Étape {item.id}</span><span className="mt-1 block text-xs font-bold">{item.title}</span></button>)}</div>
        </div>}

        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-2xl border-t border-slate-100 bg-white/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl"><div className="flex gap-3"><button className="min-h-13 rounded-full border border-slate-200 px-5 text-sm font-bold text-slate-600" onClick={goBack} type="button">Retour</button>{step < 5 ? <button className="flex min-h-13 flex-1 items-center justify-center gap-2 rounded-full bg-sky-500 text-sm font-bold text-white shadow-lg shadow-sky-100" onClick={continueToNextStep} type="button">Continuer <ArrowRight aria-hidden="true" size={18} /></button> : <button className="min-h-13 flex-1 rounded-full bg-sky-500 text-sm font-bold text-white shadow-lg shadow-sky-100 disabled:opacity-60" disabled={isSubmitting} type="submit">{isSubmitting ? 'Publication…' : 'Publier la mission'}</button>}</div>{step === 5 && <button className="mt-2 min-h-9 w-full text-xs font-semibold text-slate-400" onClick={() => navigate('/ngo/dashboard')} type="button">Quitter et garder le brouillon</button>}</div>
      </form>

      {pendingDifficulty && <div className="fixed inset-0 z-[70] grid place-items-end bg-slate-950/45 p-3 sm:place-items-center"><div aria-labelledby="difficulty-title" aria-modal="true" className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-xl" role="dialog"><div className="flex items-start justify-between gap-4"><div><span className="grid size-11 place-items-center rounded-full bg-sky-100 text-sky-700"><Sparkles aria-hidden="true" size={21} /></span><h2 className="mt-4 text-xl font-bold" id="difficulty-title">Justifier la difficulté {pendingDifficulty === 'demanding' ? 'soutenue' : 'élevée'}</h2></div><button aria-label="Fermer" className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500" onClick={() => setPendingDifficulty(null)} type="button"><X aria-hidden="true" size={19} /></button></div><p className="mt-2 text-sm leading-6 text-slate-500">Cette information aide le bénévole à décider en connaissance de cause.</p><textarea autoFocus className="mt-4 min-h-28 w-full resize-none rounded-[18px] border border-slate-300 p-3 outline-none focus:border-sky-500" onChange={(event) => setDifficultyJustification(event.target.value)} placeholder="Ex. port de charges, longue marche, chaleur…" value={difficultyJustification} />{dialogError && <p className="mt-2 text-xs text-rose-600">{dialogError}</p>}<button className="mt-4 min-h-12 w-full rounded-full bg-sky-500 text-sm font-bold text-white" onClick={confirmDifficulty} type="button">Confirmer ce niveau</button></div></div>}

      {activeRequirementGroup && activeRequirementOptions && <div className="fixed inset-0 z-[70] grid place-items-end bg-slate-950/45 p-3 sm:place-items-center"><div aria-labelledby="requirement-title" aria-modal="true" className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-xl" role="dialog"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold text-sky-600">Suggestions</p><h2 className="mt-1 text-xl font-bold" id="requirement-title">{activeRequirementOptions.label}</h2></div><button aria-label="Fermer" className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500" onClick={() => setActiveRequirementGroup(null)} type="button"><X aria-hidden="true" size={19} /></button></div><p className="mt-2 text-sm leading-6 text-slate-500">Sélectionnez tout ce qui s’applique.</p><div className="mt-4 flex flex-wrap gap-2">{activeRequirementOptions.suggestions.map((suggestion) => <Chip active={selectedRequirements[activeRequirementGroup].includes(suggestion)} key={suggestion} label={suggestion} onClick={() => toggleRequirement(activeRequirementGroup, suggestion)} />)}<Chip active={showCustomRequirement} label="Autre" onClick={() => setShowCustomRequirement((current) => !current)} /></div>{showCustomRequirement && <div className="mt-4 flex gap-2"><input autoFocus className="min-h-12 min-w-0 flex-1 rounded-[16px] border border-slate-300 px-3 outline-none focus:border-sky-500" onChange={(event) => setCustomRequirement(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomRequirement() } }} placeholder="Autre condition" value={customRequirement} /><button className="rounded-[16px] bg-slate-900 px-4 text-sm font-bold text-white" onClick={addCustomRequirement} type="button">Ajouter</button></div>}<button className="mt-5 min-h-12 w-full rounded-full bg-sky-500 text-sm font-bold text-white" onClick={() => setActiveRequirementGroup(null)} type="button">Terminer</button></div></div>}
    </main>
  )
}

function Section({ children, icon: Icon, title }: { children: React.ReactNode; icon: typeof MapPin; title: string }) { return <section className="space-y-5 rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-sky-50 text-sky-600"><Icon aria-hidden="true" size={18} /></span><h2 className="text-lg font-bold">{title}</h2></div>{children}</section> }
function FieldLabel({ label, required = true }: { label: string; required?: boolean }) { return <span className="flex items-center justify-between gap-3 text-sm font-semibold"><span>{label}</span><span className={`text-[9px] font-bold uppercase tracking-wide ${required ? 'text-rose-500' : 'text-slate-400'}`}>{required ? 'Requis' : 'Facultatif'}</span></span> }
function Field({ disabled = false, label, maxLength, min, minLength, onChange, placeholder, required = true, type = 'text', value }: { disabled?: boolean; label: string; maxLength?: number; min?: string; minLength?: number; onChange: (value: string) => void; placeholder?: string; required?: boolean; type?: string; value: string }) { return <label className={`block ${disabled ? 'opacity-45' : ''}`}><FieldLabel label={label} required={required} /><input className="mt-2 min-h-13 w-full rounded-[17px] border border-slate-200 bg-slate-50 px-4 text-base outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100" disabled={disabled} maxLength={maxLength} min={min} minLength={minLength} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} type={type} value={value} /></label> }
function Area({ label, minLength, onChange, placeholder, required = true, value }: { label: string; minLength?: number; onChange: (value: string) => void; placeholder?: string; required?: boolean; value: string }) { return <label className="block"><FieldLabel label={label} required={required} /><textarea className="mt-2 min-h-32 w-full resize-none rounded-[17px] border border-slate-200 bg-slate-50 p-4 text-base outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100" minLength={minLength} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} value={value} /></label> }
function Chip({ active, label, onClick, tone = 'sky' }: { active: boolean; label: string; onClick: () => void; tone?: 'sky' | 'emerald' }) { const activeClass = tone === 'emerald' ? 'border-emerald-500 bg-emerald-500' : 'border-sky-500 bg-sky-500'; return <button aria-pressed={active} className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${active ? `${activeClass} text-white` : 'border-slate-200 bg-white text-slate-600'}`} onClick={onClick} type="button">{active && <Check aria-hidden="true" className="mr-1 inline" size={13} />}{label}</button> }
function ChoiceButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) { return <button aria-pressed={active} className={`min-h-12 rounded-[16px] border px-3 text-sm font-bold transition ${active ? 'border-sky-500 bg-sky-500 text-white shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600'}`} onClick={onClick} type="button">{active && <Check aria-hidden="true" className="mr-1.5 inline" size={16} />}{label}</button> }
function SignInRequired() { return <main className="mx-auto grid min-h-dvh max-w-md place-items-center bg-white p-6 text-center"><div className="w-full"><LogIn className="mx-auto text-sky-500" size={32} /><h1 className="mt-4 text-2xl font-bold">Connectez-vous à votre compte ONG</h1><p className="mt-2 text-sm leading-6 text-slate-500">La création d’une mission est réservée aux organisations approuvées.</p><Link className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-sky-500 px-5 text-sm font-bold text-white" to="/auth?mode=login&returnTo=%2Fngo%2Fmissions%2Fnew"><LogIn aria-hidden="true" size={18} />Se connecter</Link><Link className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-600" to="/ngo/apply"><Building2 aria-hidden="true" size={17} />Créer un compte ONG</Link></div></main> }
function ApprovedNgoRequired() { return <main className="mx-auto grid min-h-dvh max-w-md place-items-center bg-white p-6 text-center"><div><ShieldAlert className="mx-auto text-sky-500" size={32} /><h1 className="mt-4 text-2xl font-bold">ONG approuvée requise</h1><p className="mt-2 text-sm text-slate-500">Votre organisation doit être validée avant de publier.</p><Link className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-sky-500 px-5 text-sm font-bold text-white" to="/ngo/apply"><ArrowLeft aria-hidden="true" size={18} />Voir ma demande</Link></div></main> }
