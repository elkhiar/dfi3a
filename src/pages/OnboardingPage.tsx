import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Coins,
  MapPinned,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { DBuxIcon } from '../components/DBuxIcon'

export const ONBOARDING_STORAGE_KEY = 'dfi3a:onboarding:v1'

const steps = [
  {
    eyebrow: 'Bienvenue',
    title: 'La solidarité, près de chez vous',
    description: 'DFI3A met en relation les bénévoles et les associations pour transformer l’envie d’aider en actions concrètes.',
    icon: UsersRound,
    iconClassName: 'bg-sky-500 text-white',
    panelClassName: 'bg-sky-50',
    details: [
      { icon: Sparkles, text: 'Des missions utiles proposées par des ONG vérifiées' },
      { icon: ShieldCheck, text: 'Un cadre clair pour participer en confiance' },
    ],
  },
  {
    eyebrow: 'Trouver une mission',
    title: 'Choisissez comment vous voulez aider',
    description: 'Explorez les missions par date ou par catégorie, consultez la liste ou repérez les actions proches sur la carte.',
    icon: Search,
    iconClassName: 'bg-emerald-500 text-white',
    panelClassName: 'bg-emerald-50',
    details: [
      { icon: MapPinned, text: 'Les positions publiques restent approximatives' },
      { icon: CheckCircle2, text: 'Enregistrez une mission pour la retrouver plus tard' },
    ],
  },
  {
    eyebrow: 'Participer',
    title: 'Inscrivez-vous, puis préparez-vous ensemble',
    description: 'Après votre inscription, vous accédez au lieu précis et aux consignes privées de la mission.',
    icon: CheckCircle2,
    iconClassName: 'bg-violet-500 text-white',
    panelClassName: 'bg-violet-50',
    details: [
      { icon: MessageCircle, text: 'Échangez dans le groupe de discussion de la mission' },
      { icon: UsersRound, text: 'Invitez vos amis à participer avec vous' },
    ],
  },
  {
    eyebrow: 'Votre engagement',
    title: 'Chaque action compte',
    description: 'Votre présence validée vous fait gagner des D-bux. Ils valorisent votre engagement et alimentent le classement.',
    icon: Coins,
    iconClassName: 'bg-amber-400 text-slate-800',
    panelClassName: 'bg-amber-50',
    details: [
      { icon: DBuxIcon, text: 'Les D-bux dépendent de la durée, de la difficulté et de l’urgence' },
      { icon: ShieldCheck, text: 'Prévenez à temps : les absences et annulations tardives sont pénalisées' },
    ],
  },
] as const

function safeReturnTo(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && value !== '/onboarding'
    ? value
    : '/'
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const step = steps[stepIndex]
  const isLastStep = stepIndex === steps.length - 1
  const returnTo = safeReturnTo((location.state as { returnTo?: unknown } | null)?.returnTo)

  useEffect(() => {
    headingRef.current?.focus()
  }, [stepIndex])

  const finish = () => {
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, 'completed')
    } catch {
      // Navigation must remain available when browser storage is disabled.
    }
    navigate(returnTo, { replace: true })
  }

  const StepIcon = step.icon

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-hidden bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-slate-950 shadow-sm">
      <header className="flex items-center justify-between">
        <img alt="DFI3A" className="h-10 w-[96px] object-contain object-left" src="/dfi3a-logo.svg" />
        <button className="min-h-10 rounded-full px-3 text-sm font-semibold text-slate-500 hover:bg-slate-100" onClick={finish} type="button">Passer</button>
      </header>

      <section aria-live="polite" className="flex flex-1 flex-col pt-7">
        <div className={`grid min-h-56 place-items-center rounded-[32px] ${step.panelClassName}`}>
          <span className={`grid size-24 place-items-center rounded-[28px] shadow-sm ${step.iconClassName}`}>
            <StepIcon aria-hidden="true" className={stepIndex === 3 ? 'size-12' : undefined} size={46} strokeWidth={1.9} />
          </span>
        </div>

        <div className="mt-7">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-600">{step.eyebrow}</p>
          <h1 className="mt-2 text-[30px] font-bold leading-[1.05] tracking-[-0.035em] outline-none" ref={headingRef} tabIndex={-1}>{step.title}</h1>
          <p className="mt-3 text-[15px] leading-6 text-slate-600">{step.description}</p>
        </div>

        <div className="mt-6 space-y-3">
          {step.details.map(({ icon: DetailIcon, text }) => (
            <div className="flex items-center gap-3 rounded-[18px] border border-slate-200 p-3.5" key={text}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700">
                <DetailIcon aria-hidden="true" className="max-h-5 max-w-5" size={19} />
              </span>
              <p className="text-sm font-medium leading-5 text-slate-700">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-8">
        <div className="mb-5 flex items-center justify-between">
          <div aria-label={`Étape ${stepIndex + 1} sur ${steps.length}`} className="flex gap-1.5">
            {steps.map((item, index) => <span className={`h-2 rounded-full transition-all ${index === stepIndex ? 'w-7 bg-sky-500' : 'w-2 bg-slate-200'}`} key={item.title} />)}
          </div>
          <span className="text-xs font-semibold text-slate-400">{stepIndex + 1}/{steps.length}</span>
        </div>

        <div className="flex gap-3">
          {stepIndex > 0 && <button aria-label="Étape précédente" className="grid size-13 shrink-0 place-items-center rounded-full border border-slate-300 text-slate-700" onClick={() => setStepIndex((current) => current - 1)} type="button"><ArrowLeft aria-hidden="true" size={21} /></button>}
          <button className="flex min-h-13 flex-1 items-center justify-center gap-2 rounded-full bg-sky-500 px-5 text-sm font-bold text-white shadow-sm hover:bg-sky-600" onClick={() => isLastStep ? finish() : setStepIndex((current) => current + 1)} type="button">
            {isLastStep ? 'Découvrir les missions' : 'Continuer'}
            <ArrowRight aria-hidden="true" size={19} />
          </button>
        </div>
      </footer>
    </main>
  )
}
