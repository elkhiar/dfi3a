import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { useEffect, useState } from 'react'

export const APP_TOUR_STORAGE_KEY = 'dfi3a:app-tour:v2'

const steps = [
  {
    selector: '[data-tour="home-header"]',
    title: 'Bienvenue sur DFI3A',
    description: 'Ici, vous retrouvez vos D-bux, vos notifications et votre profil. DFI3A vous connecte aux associations qui agissent près de vous.',
  },
  {
    selector: '[data-tour="time-filters"]',
    title: 'Choisissez le bon moment',
    description: 'Affichez les missions à venir, celles d’aujourd’hui, de demain ou du week-end.',
  },
  {
    selector: '[data-tour="urgent-missions"]',
    title: 'Repérez les besoins urgents',
    description: 'Les missions validées comme urgentes apparaissent ici pour mobiliser rapidement des bénévoles.',
  },
  {
    selector: '[data-tour="category-filters"]',
    title: 'Trouvez la cause qui vous ressemble',
    description: 'Santé, environnement, éducation… touchez une catégorie pour filtrer les missions présentées sur l’accueil.',
  },
  {
    selector: '[data-tour="main-navigation"]',
    title: 'Toute l’application à portée de pouce',
    description: 'Explorez les missions, retrouvez vos événements, consultez le classement et gérez votre profil depuis cette barre.',
  },
] as const

type SpotlightRect = {
  height: number
  left: number
  top: number
  width: number
}

export function AppTour({ onComplete }: { onComplete: () => void }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null)
  const step = steps[stepIndex]
  const isLastStep = stepIndex === steps.length - 1

  useEffect(() => {
    const target = document.querySelector<HTMLElement>(step.selector)
    if (!target) {
      const missingTargetTimer = window.setTimeout(() => setSpotlight(null), 0)
      return () => window.clearTimeout(missingTargetTimer)
    }

    const updateSpotlight = () => {
      const rect = target.getBoundingClientRect()
      const padding = 6
      setSpotlight({
        height: rect.height + padding * 2,
        left: Math.max(8, rect.left - padding),
        top: Math.max(8, rect.top - padding),
        width: Math.min(window.innerWidth - 16, rect.width + padding * 2),
      })
    }

    target.scrollIntoView({ behavior: 'smooth', block: stepIndex === steps.length - 1 ? 'end' : 'center' })
    const timer = window.setTimeout(updateSpotlight, 350)
    const observer = new ResizeObserver(updateSpotlight)
    observer.observe(target)
    window.addEventListener('resize', updateSpotlight)
    window.addEventListener('scroll', updateSpotlight, true)
    updateSpotlight()

    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
      window.removeEventListener('resize', updateSpotlight)
      window.removeEventListener('scroll', updateSpotlight, true)
    }
  }, [step.selector, stepIndex])

  return (
    <div aria-label="Tutoriel de l’application" aria-modal="true" className="fixed inset-0 z-[70]" role="dialog">
      <div className="absolute inset-0" />
      {spotlight ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-[22px] border-2 border-white transition-all duration-300"
          style={{
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.72)',
            height: spotlight.height,
            left: spotlight.left,
            top: spotlight.top,
            width: spotlight.width,
          }}
        />
      ) : <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-slate-950/70" />}

      <section className={`absolute inset-x-4 z-10 mx-auto max-w-sm rounded-[26px] bg-white p-5 shadow-2xl ${isLastStep ? 'top-[max(1rem,env(safe-area-inset-top))]' : 'bottom-[max(7.5rem,calc(env(safe-area-inset-bottom)+7.5rem))]'}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-sky-100 px-3 py-1 text-[11px] font-bold text-sky-700">Étape {stepIndex + 1} sur {steps.length}</span>
          <button aria-label="Passer le tutoriel" className="grid size-9 place-items-center rounded-full bg-slate-100 text-slate-500" onClick={onComplete} type="button"><X aria-hidden="true" size={17} /></button>
        </div>
        <h2 className="mt-4 text-xl font-bold tracking-tight">{step.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>

        <div className="mt-5 flex items-center gap-3">
          {stepIndex > 0 && <button aria-label="Étape précédente" className="grid size-12 shrink-0 place-items-center rounded-full border border-slate-300 text-slate-700" onClick={() => setStepIndex((current) => current - 1)} type="button"><ArrowLeft aria-hidden="true" size={19} /></button>}
          <button className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-sky-500 px-4 text-sm font-bold text-white" onClick={() => isLastStep ? onComplete() : setStepIndex((current) => current + 1)} type="button">
            {isLastStep ? <><Check aria-hidden="true" size={18} />Terminer</> : <>Suivant<ArrowRight aria-hidden="true" size={18} /></>}
          </button>
        </div>
      </section>
    </div>
  )
}
