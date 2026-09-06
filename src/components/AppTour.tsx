import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export const APP_TOUR_STORAGE_KEY = 'dfi3a:app-tour:v3'

const steps = [
  {
    path: '/',
    selector: '[data-tour="home-header"]',
    title: 'Bienvenue sur DFI3A',
    description: 'DFI3A vous connecte aux associations et aux bénévoles pour agir concrètement près de chez vous.',
  },
  {
    path: '/explore',
    selector: '[data-tour="explore-search"]',
    title: 'Cherchez ce qui vous intéresse',
    description: 'Saisissez une cause, une activité, une association ou une ville. Pour les missions, vous pouvez choisir entre la liste et la carte.',
  },
  {
    path: '/explore',
    selector: '[data-tour="explore-directories"]',
    title: 'Découvrez aussi la communauté',
    description: 'Passez de Missions à ONG ou Utilisateurs. Suivez vos associations préférées et envoyez une demande d’ami aux bénévoles que vous souhaitez retrouver.',
  },
  {
    path: '/',
    selector: '[data-tour="save-mission"]',
    title: 'Gardez vos coups de cœur',
    description: 'Touchez le cœur d’une mission pour l’enregistrer. Vous la retrouverez ensuite dans Mes événements, onglet Enregistrées.',
  },
  {
    path: '/events',
    selector: '[data-tour="events-tabs"]',
    title: 'Retrouvez toutes vos missions',
    description: 'À venir regroupe vos inscriptions, Enregistrées contient vos favoris et Historique conserve les missions déjà terminées.',
  },
  {
    path: '/',
    selector: '[data-tour="mission-card"]',
    title: 'Rejoignez une mission',
    description: 'Ouvrez une mission pour consulter ses informations et vous inscrire. Une fois inscrit, le lieu précis, les consignes privées et le chat du groupe deviennent accessibles.',
  },
  {
    path: '/',
    selector: '[data-tour="notifications"]',
    title: 'Ne manquez rien',
    description: 'La cloche vous prévient des invitations, demandes d’ami, nouvelles missions des ONG suivies et informations importantes sur vos événements.',
  },
  {
    path: '/',
    selector: '[data-tour="points-wallet"]',
    title: 'Votre engagement devient des D-bux',
    description: 'Vous gagnez des D-bux après validation de votre présence. Prochainement, vous pourrez aussi les convertir en cadeaux dans la vie réelle.',
  },
  {
    path: '/',
    selector: '[data-tour="main-navigation"]',
    title: 'Toute l’application à portée de pouce',
    description: 'Accueil, Explorer, Événements, Classement et Profil : cette barre vous accompagne partout dans DFI3A.',
  },
] as const

type SpotlightRect = { height: number; left: number; top: number; width: number }

export function AppTour({ onComplete }: { onComplete: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [stepIndex, setStepIndex] = useState(0)
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null)
  const step = steps[stepIndex]
  const isLastStep = stepIndex === steps.length - 1

  useEffect(() => {
    if (location.pathname !== step.path) {
      navigate(step.path)
      return
    }

    let target: HTMLElement | null = null
    let frame = 0
    let resizeObserver: ResizeObserver | null = null

    const updateSpotlight = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        if (!target) return
        const rect = target.getBoundingClientRect()
        const padding = 6
        setSpotlight({
          height: rect.height + padding * 2,
          left: Math.max(8, rect.left - padding),
          top: Math.max(8, rect.top - padding),
          width: Math.min(window.innerWidth - 16, rect.width + padding * 2),
        })
      })
    }

    const connectTarget = () => {
      if (target) return
      target = document.querySelector<HTMLElement>(step.selector)
      if (!target) return
      target.scrollIntoView({ behavior: 'smooth', block: isLastStep ? 'end' : 'center' })
      resizeObserver = new ResizeObserver(updateSpotlight)
      resizeObserver.observe(target)
      window.setTimeout(updateSpotlight, 350)
      updateSpotlight()
    }

    const mutationObserver = new MutationObserver(connectTarget)
    mutationObserver.observe(document.body, { childList: true, subtree: true })
    connectTarget()
    window.addEventListener('resize', updateSpotlight)
    window.addEventListener('scroll', updateSpotlight, true)

    return () => {
      window.cancelAnimationFrame(frame)
      mutationObserver.disconnect()
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateSpotlight)
      window.removeEventListener('scroll', updateSpotlight, true)
    }
  }, [isLastStep, location.pathname, navigate, step.path, step.selector])

  const finish = () => {
    onComplete()
    navigate('/', { replace: true })
  }

  return (
    <div aria-label="Tutoriel de l’application" aria-modal="true" className="fixed inset-0 z-[70]" role="dialog">
      <div className="absolute inset-0" />
      {spotlight ? <div aria-hidden="true" className="pointer-events-none fixed rounded-[22px] border-2 border-white transition-all duration-300" style={{ boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.72)', height: spotlight.height, left: spotlight.left, top: spotlight.top, width: spotlight.width }} /> : <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-slate-950/70" />}

      <section className={`absolute inset-x-4 z-10 mx-auto max-w-sm rounded-[26px] bg-white p-5 shadow-2xl ${isLastStep ? 'top-[max(1rem,env(safe-area-inset-top))]' : 'bottom-[max(7.5rem,calc(env(safe-area-inset-bottom)+7.5rem))]'}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-sky-100 px-3 py-1 text-[11px] font-bold text-sky-700">Étape {stepIndex + 1} sur {steps.length}</span>
          <button aria-label="Passer le tutoriel" className="grid size-9 place-items-center rounded-full bg-slate-100 text-slate-500" onClick={finish} type="button"><X aria-hidden="true" size={17} /></button>
        </div>
        <h2 className="mt-4 text-xl font-bold tracking-tight">{step.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
        <div className="mt-5 flex items-center gap-3">
          {stepIndex > 0 && <button aria-label="Étape précédente" className="grid size-12 shrink-0 place-items-center rounded-full border border-slate-300 text-slate-700" onClick={() => setStepIndex((current) => current - 1)} type="button"><ArrowLeft aria-hidden="true" size={19} /></button>}
          <button className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-sky-500 px-4 text-sm font-bold text-white" onClick={() => isLastStep ? finish() : setStepIndex((current) => current + 1)} type="button">
            {isLastStep ? <><Check aria-hidden="true" size={18} />Terminer</> : <>Suivant<ArrowRight aria-hidden="true" size={18} /></>}
          </button>
        </div>
      </section>
    </div>
  )
}
