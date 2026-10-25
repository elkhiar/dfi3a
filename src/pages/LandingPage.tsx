import {
  ArrowRight,
  BellRing,
  CalendarCheck2,
  Check,
  HeartHandshake,
  MapPinned,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Trophy,
  UsersRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { DBuxIcon } from '../components/DBuxIcon'

const benefits = [
  { icon: MapPinned, title: 'Des missions près de vous', text: 'Trouvez des actions utiles par ville, date ou centre d’intérêt.' },
  { icon: UsersRound, title: 'Engagez-vous ensemble', text: 'Invitez vos amis, rencontrez d’autres bénévoles et créez du lien.' },
  { icon: MessageCircle, title: 'Restez coordonnés', text: 'Échangez dans le groupe privé de la mission dès votre inscription.' },
  { icon: Trophy, title: 'Valorisez votre impact', text: 'Cumulez des D-bux après chaque présence vérifiée.' },
]

const steps = [
  { number: '01', title: 'Choisissez votre cause', text: 'Santé, environnement, éducation, culture ou solidarité : indiquez ce qui vous anime.' },
  { number: '02', title: 'Rejoignez une mission', text: 'Consultez les informations utiles et inscrivez-vous en quelques secondes.' },
  { number: '03', title: 'Agissez et progressez', text: 'Participez, faites valider votre présence et suivez votre impact.' },
]

export function LandingPage() {
  return (
    <div className="min-h-dvh overflow-hidden bg-white text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link aria-label="Accueil dfi3a" to="/"><img alt="dfi3a" className="h-10 w-[104px] object-contain object-left" src="/dfi3a-logo.svg" /></Link>
          <nav aria-label="Navigation de présentation" className="hidden items-center gap-8 md:flex">
            <a className="text-sm font-semibold text-slate-600 hover:text-slate-950" href="#decouvrir">Découvrir</a>
            <a className="text-sm font-semibold text-slate-600 hover:text-slate-950" href="#fonctionnement">Comment ça marche</a>
            <a className="text-sm font-semibold text-slate-600 hover:text-slate-950" href="#associations">Pour les ONG</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link className="hidden min-h-11 items-center px-4 text-sm font-bold text-slate-700 sm:flex" to="/auth?mode=login&returnTo=%2F">Se connecter</Link>
            <Link className="inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 sm:px-5" to="/auth?mode=signup&returnTo=%2F">Nous rejoindre<ArrowRight aria-hidden="true" size={16} /></Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative border-b border-slate-200 bg-[#f4f8fb]">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 sm:py-18 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-24">
            <div className="relative z-10 max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-2 text-xs font-bold text-sky-700 shadow-sm"><Sparkles aria-hidden="true" size={15} />Le volontariat nouvelle génération</span>
              <h1 className="mt-6 text-[44px] font-bold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-[76px]">Votre temps peut <span className="text-sky-500">tout changer.</span></h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">Dfi3a rapproche les bénévoles et les associations au Maroc. Trouvez une mission qui vous ressemble, participez et rendez chaque action visible.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-sky-500 px-7 text-sm font-bold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-600" to="/auth?mode=signup&returnTo=%2F">Devenir bénévole<ArrowRight aria-hidden="true" size={18} /></Link>
                <Link className="inline-flex min-h-14 items-center justify-center rounded-full border border-slate-300 bg-white px-7 text-sm font-bold text-slate-800 transition hover:border-slate-400" to="/explore">Explorer les missions</Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-2"><Check className="text-emerald-500" size={16} />Inscription gratuite</span>
                <span className="flex items-center gap-2"><Check className="text-emerald-500" size={16} />ONG vérifiées</span>
                <span className="flex items-center gap-2"><Check className="text-emerald-500" size={16} />Impact valorisé</span>
              </div>
            </div>

            <HeroPreview />
          </div>
        </section>

        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-slate-200 px-5 py-7 lg:grid-cols-4 lg:px-8">
            <Stat value="100%" label="Pensé pour le Maroc" />
            <Stat value="4 étapes" label="Pour rejoindre une mission" />
            <Stat value="±100 m" label="Localisation publique protégée" />
            <Stat value="1 communauté" label="Bénévoles et associations" />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-18 lg:px-8 lg:py-28" id="decouvrir">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">Tout au même endroit</p>
            <h2 className="mt-3 text-4xl font-bold tracking-[-0.045em] sm:text-5xl">S’engager doit être simple.</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">De la découverte à la validation de votre présence, Dfi3a retire les frictions pour laisser toute la place à l’action.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map(({ icon: Icon, text, title }) => <article className="rounded-[26px] border border-slate-200 bg-white p-5 transition hover:-translate-y-1 hover:border-sky-200 hover:shadow-xl hover:shadow-slate-200/60" key={title}><span className="grid size-12 place-items-center rounded-2xl bg-sky-50 text-sky-600"><Icon aria-hidden="true" size={23} /></span><h3 className="mt-5 text-lg font-bold tracking-tight">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></article>)}
          </div>
        </section>

        <section className="bg-slate-950 text-white" id="fonctionnement">
          <div className="mx-auto max-w-7xl px-5 py-18 lg:px-8 lg:py-28">
            <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-18">
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">Comment ça marche</p><h2 className="mt-3 text-4xl font-bold tracking-[-0.045em] sm:text-5xl">De l’envie à l’impact.</h2><p className="mt-4 text-base leading-7 text-slate-400">Votre prochaine action solidaire commence en quelques minutes.</p></div>
              <div className="divide-y divide-white/10 border-y border-white/10">
                {steps.map((step) => <article className="grid gap-3 py-6 sm:grid-cols-[64px_1fr] sm:items-start" key={step.number}><span className="text-sm font-bold text-sky-300">{step.number}</span><div><h3 className="text-xl font-bold">{step.title}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{step.text}</p></div></article>)}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-18 lg:px-8 lg:py-28" id="associations">
          <div className="overflow-hidden rounded-[32px] bg-sky-500 text-white lg:grid lg:grid-cols-[1.1fr_0.9fr]">
            <div className="p-7 sm:p-10 lg:p-14">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-xs font-bold"><ShieldCheck aria-hidden="true" size={16} />Espace ONG vérifié</span>
              <h2 className="mt-5 text-4xl font-bold tracking-[-0.045em] sm:text-5xl">Mobilisez les bonnes personnes, au bon moment.</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-sky-50">Publiez vos missions, demandez le statut urgent, échangez avec les inscrits et validez les présences depuis un tableau de bord dédié.</p>
              <Link className="mt-7 inline-flex min-h-13 items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-sky-700" to="/ngo/apply">Inscrire mon association<ArrowRight aria-hidden="true" size={17} /></Link>
            </div>
            <div className="grid grid-cols-2 gap-3 bg-sky-400 p-6 sm:p-8 lg:content-center">
              <NgoFeature icon={CalendarCheck2} label="Missions organisées" />
              <NgoFeature icon={BellRing} label="Urgences visibles" />
              <NgoFeature icon={UsersRound} label="Présences en direct" />
              <NgoFeature icon={HeartHandshake} label="Communauté engagée" />
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-[#f4f8fb]">
          <div className="mx-auto flex max-w-4xl flex-col items-center px-5 py-18 text-center lg:py-24">
            <span className="grid size-14 place-items-center rounded-[20px] bg-white text-sky-500 shadow-sm"><HeartHandshake aria-hidden="true" size={28} /></span>
            <h2 className="mt-6 text-4xl font-bold tracking-[-0.045em] sm:text-5xl">Prêt à faire la différence ?</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">Créez votre profil et découvrez les associations qui ont besoin de vous.</p>
            <Link className="mt-7 inline-flex min-h-14 items-center gap-2 rounded-full bg-slate-950 px-7 text-sm font-bold text-white" to="/auth?mode=signup&returnTo=%2F">Créer mon compte<ArrowRight aria-hidden="true" size={18} /></Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8"><img alt="dfi3a" className="h-9 w-24 object-contain object-left" src="/dfi3a-logo.svg" /><p className="text-xs text-slate-400">© 2026 Dfi3a · Le volontariat, simplement.</p><div className="flex gap-5 text-xs font-semibold text-slate-500"><Link to="/explore">Missions</Link><Link to="/auth?mode=login">Connexion</Link></div></div>
      </footer>
    </div>
  )
}

function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[540px] lg:mr-0">
      <div className="absolute -left-5 top-14 hidden w-44 rounded-[22px] border border-slate-200 bg-white p-4 shadow-xl sm:block"><span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-600"><Trophy size={19} /></span><p className="mt-3 text-xs text-slate-400">Votre impact</p><p className="mt-1 flex items-center gap-2 text-xl font-bold"><DBuxIcon className="h-6 w-auto" /> 2 420</p></div>
      <div className="relative mx-auto w-[86%] overflow-hidden rounded-[34px] border-[8px] border-slate-950 bg-white shadow-2xl sm:w-[72%] lg:w-[74%]">
        <div className="flex items-center justify-between px-4 py-4"><img alt="" className="h-7 w-20 object-contain object-left" src="/dfi3a-logo.svg" /><span className="grid size-8 place-items-center rounded-full bg-sky-100 text-sky-700"><BellRing size={15} /></span></div>
        <div className="px-3 pb-4"><p className="text-[9px] font-bold uppercase tracking-wider text-rose-500">Mission urgente</p><div className="relative mt-2 aspect-[1.2] overflow-hidden rounded-[22px]"><img alt="Bénévoles pendant une collecte de sang" className="size-full object-cover" src="/assets/missions/blood-donation.png" /><div className="absolute inset-x-0 bottom-0 bg-slate-950/75 p-3 text-white"><span className="rounded-full bg-rose-500 px-2 py-1 text-[8px] font-bold">SANTÉ</span><h3 className="mt-2 text-lg font-bold leading-none">Collecte solidaire à Anfa</h3><p className="mt-2 text-[9px] text-sky-200">Samedi · 09:00</p></div></div><div className="mt-3 grid grid-cols-2 gap-2"><MiniMission image="/assets/missions/beach-cleanup.png" title="Clean Walk Ain Diab" /><MiniMission image="/assets/missions/tree-planting.png" title="Reboisement collectif" /></div></div>
      </div>
      <div className="absolute -bottom-5 -right-2 hidden w-48 rounded-[22px] border border-slate-200 bg-white p-4 shadow-xl sm:block"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Check size={20} strokeWidth={3} /></span><div><p className="text-xs font-bold">Inscription confirmée</p><p className="mt-1 text-[10px] text-slate-400">Vous faites partie de l’équipe</p></div></div></div>
    </div>
  )
}

function MiniMission({ image, title }: { image: string; title: string }) {
  return <div className="overflow-hidden rounded-[16px] border border-slate-100"><img alt="" className="aspect-[1.3] w-full object-cover" src={image} /><p className="truncate px-2 py-2 text-[9px] font-bold">{title}</p></div>
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="px-3 py-3 text-center lg:px-6"><p className="text-xl font-bold tracking-tight sm:text-2xl">{value}</p><p className="mt-1 text-[10px] font-semibold text-slate-400 sm:text-xs">{label}</p></div>
}

function NgoFeature({ icon: Icon, label }: { icon: typeof CalendarCheck2; label: string }) {
  return <div className="rounded-[22px] bg-white p-4 text-slate-900 shadow-sm"><Icon aria-hidden="true" className="text-sky-500" size={22} /><p className="mt-4 text-sm font-bold leading-5">{label}</p></div>
}
