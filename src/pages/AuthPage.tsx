import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Dumbbell,
  Eye,
  EyeOff,
  GraduationCap,
  HandHeart,
  HeartPulse,
  Leaf,
  MapPin,
  Palette,
  PawPrint,
  ShieldCheck,
  Siren,
  Sparkles,
  Trophy,
  UserRoundSearch,
} from 'lucide-react'
import type { FormEvent, InputHTMLAttributes, ReactNode, Ref } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { emailAlreadyHasAccount, syncVolunteerSignupProfile } from '../lib/auth-signup'
import { getSafeReturnTo } from '../lib/navigation'
import { supabase } from '../lib/supabase'

type AuthMode = 'login' | 'signup'

type SignupDraft = {
  birthdate: string
  city: string
  email: string
  firstName: string
  interests: string[]
  lastName: string
  password: string
  showCity: boolean
  showInDirectory: boolean
  showInLeaderboard: boolean
  termsAccepted: boolean
}

const emptySignup: SignupDraft = {
  birthdate: '',
  city: '',
  email: '',
  firstName: '',
  interests: [],
  lastName: '',
  password: '',
  showCity: true,
  showInDirectory: true,
  showInLeaderboard: true,
  termsAccepted: false,
}

const interestOptions = [
  { label: 'Santé', icon: HeartPulse, style: 'bg-rose-50 text-rose-600' },
  { label: 'Environnement', icon: Leaf, style: 'bg-emerald-50 text-emerald-700' },
  { label: 'Aide sociale', icon: HandHeart, style: 'bg-amber-50 text-amber-700' },
  { label: 'Éducation', icon: GraduationCap, style: 'bg-violet-50 text-violet-700' },
  { label: 'Culture et patrimoine', icon: Palette, style: 'bg-fuchsia-50 text-fuchsia-700' },
  { label: 'Protection animale', icon: PawPrint, style: 'bg-orange-50 text-orange-700' },
  { label: 'Sport', icon: Dumbbell, style: 'bg-sky-50 text-sky-700' },
  { label: 'Urgence et aide humanitaire', icon: Siren, style: 'bg-red-50 text-red-700' },
] as const

export function AuthPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login'
  const returnTo = getSafeReturnTo(searchParams.get('returnTo'))
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [confirmationEmail, setConfirmationEmail] = useState('')
  const [signupStep, setSignupStep] = useState(0)
  const [signup, setSignup] = useState<SignupDraft>(emptySignup)

  useEffect(() => {
    if (user && !isSubmitting) navigate(returnTo, { replace: true })
  }, [isSubmitting, navigate, returnTo, user])

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setSignupStep(0)
    setErrorMessage('')
    setConfirmationEmail('')
    setSearchParams({ mode: nextMode, returnTo })
  }

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)
    const form = new FormData(event.currentTarget)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: String(form.get('email') ?? '').trim(),
        password: String(form.get('password') ?? ''),
      })
      if (error) throw error
      navigate(returnTo, { replace: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setErrorMessage(message === 'Invalid login credentials' ? 'Adresse e-mail ou mot de passe incorrect.' : message || 'Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const createAccount = async () => {
    setErrorMessage('')
    setIsSubmitting(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signup.email.trim(),
        password: signup.password,
        options: {
          data: {
            account_type: 'volunteer',
            birthdate: signup.birthdate,
            city: signup.city.trim(),
            first_name: signup.firstName.trim(),
            interests: signup.interests,
            last_name: signup.lastName.trim(),
            show_city: signup.showCity,
            show_in_directory: signup.showInDirectory,
            show_in_leaderboard: signup.showInLeaderboard,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
        },
      })
      if (error) throw error
      if (emailAlreadyHasAccount(data.user)) {
        setErrorMessage('Cette adresse e-mail est déjà associée à un compte DFI3A. Connectez-vous ou utilisez une autre adresse.')
        return
      }
      if (data.session) {
        await syncVolunteerSignupProfile(data.user).catch(() => undefined)
        navigate(returnTo, { replace: true })
      } else {
        setConfirmationEmail(signup.email.trim())
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (confirmationEmail) return <ConfirmationScreen email={confirmationEmail} onLogin={() => changeMode('login')} />

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md bg-white px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] text-slate-950 shadow-sm">
      <header className="flex items-center justify-between gap-4">
        <button aria-label="Retour" className="grid size-11 place-items-center rounded-full border border-slate-200" onClick={() => mode === 'signup' && signupStep > 0 ? setSignupStep((step) => step - 1) : navigate(-1)} type="button"><ArrowLeft aria-hidden="true" size={21} /></button>
        <img alt="DFI3A" className="h-10 w-[96px] object-contain" src="/dfi3a-logo.svg" />
        <span className="size-11" />
      </header>

      <div className="mt-6 grid grid-cols-2 rounded-full bg-slate-100 p-1">
        <ModeButton active={mode === 'login'} onClick={() => changeMode('login')}>Connexion</ModeButton>
        <ModeButton active={mode === 'signup'} onClick={() => changeMode('signup')}>Inscription</ModeButton>
      </div>

      {mode === 'login' ? (
        <LoginForm errorMessage={errorMessage} isSubmitting={isSubmitting} onForgotPassword={() => navigate(`/auth/forgot-password?returnTo=${encodeURIComponent(returnTo)}`)} onSubmit={login} onTogglePassword={() => setShowPassword((visible) => !visible)} showPassword={showPassword} />
      ) : (
        <SignupWizard
          draft={signup}
          errorMessage={errorMessage}
          isSubmitting={isSubmitting}
          onChange={setSignup}
          onCreate={() => void createAccount()}
          onNext={() => { setErrorMessage(''); setSignupStep((step) => Math.min(step + 1, 6)) }}
          onPrevious={() => setSignupStep((step) => Math.max(step - 1, 0))}
          onTogglePassword={() => setShowPassword((visible) => !visible)}
          showPassword={showPassword}
          step={signupStep}
        />
      )}

      <div className="mt-8 border-t border-slate-200 pt-5 text-center">
        <p className="text-sm font-semibold">Vous représentez une ONG ?</p>
        <button className="mt-2 text-sm font-bold text-sky-600" onClick={() => navigate('/ngo/apply')} type="button">Demander un compte ONG</button>
      </div>
    </main>
  )
}

function SignupWizard({ draft, errorMessage, isSubmitting, onChange, onCreate, onNext, onPrevious, onTogglePassword, showPassword, step }: {
  draft: SignupDraft
  errorMessage: string
  isSubmitting: boolean
  onChange: (draft: SignupDraft) => void
  onCreate: () => void
  onNext: () => void
  onPrevious: () => void
  onTogglePassword: () => void
  showPassword: boolean
  step: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [step])

  const canContinue = step === 0 ? draft.firstName.trim().length > 0
    : step === 1 ? draft.lastName.trim().length > 0
      : step === 2 ? Boolean(draft.birthdate)
        : step === 3 ? draft.city.trim().length > 0
          : step === 6 ? /^\S+@\S+\.\S+$/.test(draft.email.trim()) && draft.password.length >= 8 && draft.termsAccepted
            : true

  const submitStep = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canContinue) return
    if (step === 6) onCreate()
    else onNext()
  }

  return (
    <section className="mt-7">
      <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${((step + 1) / 7) * 100}%` }} /></div>
      <p className="mt-2 text-right text-[11px] font-semibold text-slate-400">{step + 1}/7</p>
      <form className="mt-5" onSubmit={submitStep}>
        {step === 0 && <Question icon={<Sparkles size={27} />} subtitle="Commençons simplement." title="Comment tu t’appelles ?"><BigInput autoComplete="given-name" onChange={(firstName) => onChange({ ...draft, firstName })} placeholder="Ton prénom" ref={inputRef} value={draft.firstName} /></Question>}
        {step === 1 && <Question icon={<UserRoundSearch size={27} />} subtitle={`Enchanté${draft.firstName ? `, ${draft.firstName}` : ''} !`} title="Et ton nom ?"><BigInput autoComplete="family-name" onChange={(lastName) => onChange({ ...draft, lastName })} placeholder="Ton nom" ref={inputRef} value={draft.lastName} /></Question>}
        {step === 2 && <Question icon={<ShieldCheck size={27} />} subtitle="Cette information restera privée." title="Quelle est ta date de naissance ?"><BigInput onChange={(birthdate) => onChange({ ...draft, birthdate })} ref={inputRef} type="date" value={draft.birthdate} /></Question>}
        {step === 3 && <Question icon={<MapPin size={27} />} subtitle="Pour te proposer des actions pertinentes près de chez toi." title="Dans quelle ville vis-tu ?"><BigInput autoComplete="address-level2" onChange={(city) => onChange({ ...draft, city })} placeholder="Casablanca, Rabat…" ref={inputRef} value={draft.city} /></Question>}
        {step === 4 && <Question icon={<HandHeart size={27} />} subtitle="Choisis autant de causes que tu veux." title="Qu’est-ce qui te tient à cœur ?"><div className="grid grid-cols-2 gap-2">{interestOptions.map(({ icon: Icon, label, style }) => { const selected = draft.interests.includes(label); return <button aria-pressed={selected} className={`relative min-h-24 rounded-[20px] border p-3 text-left transition ${selected ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-100' : 'border-slate-200 bg-white'}`} key={label} onClick={() => onChange({ ...draft, interests: selected ? draft.interests.filter((item) => item !== label) : [...draft.interests, label] })} type="button"><span className={`grid size-9 place-items-center rounded-full ${style}`}><Icon aria-hidden="true" size={19} /></span><span className="mt-2 block pr-5 text-xs font-bold leading-4">{label}</span>{selected && <span className="absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-full bg-sky-500 text-white"><Check aria-hidden="true" size={14} /></span>}</button> })}</div></Question>}
        {step === 5 && <Question icon={<Trophy size={27} />} subtitle="C’est toi qui décides de ta visibilité." title="Comment veux-tu participer ?"><div className="space-y-3"><PreferenceCard checked={draft.showInLeaderboard} description="Ton prénom et l’initiale de ton nom apparaîtront dans le classement." label="Participer au classement" onChange={(showInLeaderboard) => onChange({ ...draft, showInLeaderboard })} /><PreferenceCard checked={draft.showInDirectory} description="Les autres bénévoles pourront te trouver et t’envoyer une demande d’ami." label="Être visible par la communauté" onChange={(showInDirectory) => onChange({ ...draft, showInDirectory })} /><PreferenceCard checked={draft.showCity} description="Seule ta ville sera publique, jamais ton adresse précise." label="Afficher ma ville" onChange={(showCity) => onChange({ ...draft, showCity })} /></div></Question>}
        {step === 6 && <Question icon={<CheckCircle2 size={27} />} subtitle="Dernière étape — ton adresse ne pourra servir qu’à un seul compte DFI3A." title="Sécurise ton compte"><div className="space-y-4"><Field autoComplete="email" label="Adresse e-mail" onChange={(event) => onChange({ ...draft, email: event.target.value })} ref={inputRef} required type="email" value={draft.email} /><label className="block"><span className="mb-1.5 block text-sm font-semibold">Mot de passe</span><span className="relative block"><input autoComplete="new-password" className="min-h-13 w-full rounded-[18px] border border-slate-300 px-4 pr-12 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" minLength={8} onChange={(event) => onChange({ ...draft, password: event.target.value })} required type={showPassword ? 'text' : 'password'} value={draft.password} /><button aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-500" onClick={onTogglePassword} type="button">{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></span><span className="mt-1 block text-xs text-slate-500">8 caractères minimum</span></label><label className="flex items-start gap-3 rounded-[16px] bg-slate-50 p-3 text-xs leading-5 text-slate-600"><input checked={draft.termsAccepted} className="mt-1 size-4 accent-sky-500" onChange={(event) => onChange({ ...draft, termsAccepted: event.target.checked })} type="checkbox" /><span>J’accepte les conditions d’utilisation et la politique de confidentialité.</span></label></div></Question>}

        {errorMessage && <p className="mt-4 rounded-[16px] bg-rose-50 p-3 text-sm text-rose-700" role="alert">{errorMessage}</p>}
        <div className="mt-7 flex gap-3">
          {step > 0 && <button aria-label="Question précédente" className="grid size-13 shrink-0 place-items-center rounded-full border border-slate-300" onClick={onPrevious} type="button"><ArrowLeft aria-hidden="true" size={20} /></button>}
          <button className="flex min-h-13 flex-1 items-center justify-center gap-2 rounded-full bg-sky-500 px-5 text-sm font-bold text-white disabled:bg-slate-200 disabled:text-slate-400" disabled={!canContinue || isSubmitting} type="submit">{isSubmitting ? 'Création…' : step === 6 ? 'Créer mon compte' : 'Continuer'}{!isSubmitting && <ArrowRight aria-hidden="true" size={19} />}</button>
        </div>
      </form>
    </section>
  )
}

function LoginForm({ errorMessage, isSubmitting, onForgotPassword, onSubmit, onTogglePassword, showPassword }: { errorMessage: string; isSubmitting: boolean; onForgotPassword: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onTogglePassword: () => void; showPassword: boolean }) {
  return <section className="mt-8"><h1 className="text-[30px] font-bold tracking-tight">Bon retour !</h1><p className="mt-2 text-sm text-slate-500">Retrouvez vos missions, vos amis et vos D-bux.</p><form className="mt-6 space-y-4" onSubmit={onSubmit}><Field autoComplete="email" label="Adresse e-mail" name="email" required type="email" /><label className="block"><span className="mb-1.5 block text-sm font-semibold">Mot de passe</span><span className="relative block"><input autoComplete="current-password" className="min-h-12 w-full rounded-[16px] border border-slate-300 px-4 pr-12 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" name="password" required type={showPassword ? 'text' : 'password'} /><button aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-500" onClick={onTogglePassword} type="button">{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></span></label><button className="text-sm font-semibold text-sky-700" onClick={onForgotPassword} type="button">Mot de passe oublié ?</button>{errorMessage && <p className="rounded-[16px] bg-rose-50 p-3 text-sm text-rose-700" role="alert">{errorMessage}</p>}<button className="min-h-12 w-full rounded-full bg-sky-500 text-sm font-bold text-white disabled:opacity-60" disabled={isSubmitting} type="submit">{isSubmitting ? 'Connexion…' : 'Se connecter'}</button></form></section>
}

function Question({ children, icon, subtitle, title }: { children: ReactNode; icon: ReactNode; subtitle: string; title: string }) {
  return <div><span className="grid size-14 place-items-center rounded-[20px] bg-sky-100 text-sky-700">{icon}</span><p className="mt-5 text-sm font-semibold text-sky-600">{subtitle}</p><h1 className="mt-1 text-[30px] font-bold leading-[1.08] tracking-[-0.035em]">{title}</h1><div className="mt-6">{children}</div></div>
}

const BigInput = ({ onChange, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & { onChange: (value: string) => void; ref?: Ref<HTMLInputElement> }) => <input className="min-h-16 w-full rounded-[22px] border-2 border-slate-200 px-5 text-xl font-semibold outline-none transition placeholder:font-normal placeholder:text-slate-300 focus:border-sky-500 focus:ring-4 focus:ring-sky-100" onChange={(event) => onChange(event.target.value)} {...props} />

function PreferenceCard({ checked, description, label, onChange }: { checked: boolean; description: string; label: string; onChange: (checked: boolean) => void }) {
  return <button aria-pressed={checked} className={`flex w-full items-center gap-3 rounded-[20px] border p-4 text-left transition ${checked ? 'border-sky-500 bg-sky-50' : 'border-slate-200'}`} onClick={() => onChange(!checked)} type="button"><span className={`grid size-7 shrink-0 place-items-center rounded-full border-2 ${checked ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-300 text-transparent'}`}><Check size={15} /></span><span><strong className="block text-sm">{label}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span></button>
}

function ConfirmationScreen({ email, onLogin }: { email: string; onLogin: () => void }) {
  return <main className="mx-auto grid min-h-dvh w-full max-w-md place-items-center bg-white p-6 text-center"><div><span className="mx-auto grid size-16 place-items-center rounded-full bg-sky-100 text-sky-700"><CheckCircle2 size={31} /></span><h1 className="mt-5 text-2xl font-bold">Vérifiez votre e-mail</h1><p className="mt-2 text-sm leading-6 text-slate-600">Nous avons envoyé un lien de confirmation à <strong>{email}</strong>.</p><button className="mt-6 min-h-12 rounded-full bg-sky-500 px-6 text-sm font-bold text-white" onClick={onLogin} type="button">Retour à la connexion</button></div></main>
}

function ModeButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return <button aria-pressed={active} className={`min-h-10 rounded-full text-sm font-semibold transition ${active ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'}`} onClick={onClick} type="button">{children}</button>
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; ref?: Ref<HTMLInputElement> }
function Field({ label, ...inputProps }: FieldProps) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold">{label}</span><input className="min-h-12 w-full rounded-[16px] border border-slate-300 bg-white px-4 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" {...inputProps} /></label>
}
