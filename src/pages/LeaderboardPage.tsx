import { Crown, MapPin, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DBuxAmount } from '../components/DBuxIcon'
import { getLeaderboard } from '../services/profiles'
import type { LeaderboardEntry } from '../services/profiles'

type Period = 'month' | 'all'

export function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>('month')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isCurrent = true

    void getLeaderboard(period)
      .then((leaderboard) => {
        if (isCurrent) setEntries(leaderboard)
      })
      .catch(() => {
        if (isCurrent) setErrorMessage('Impossible de charger le classement.')
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [period])

  const changePeriod = (nextPeriod: Period) => {
    setIsLoading(true)
    setErrorMessage('')
    setPeriod(nextPeriod)
  }

  return (
    <div className="pt-[max(0.5rem,env(safe-area-inset-top))]">
      <p className="text-xs font-semibold text-sky-600">Points vérifiés</p>
      <h1 className="mt-1 text-[28px] font-bold tracking-[-0.03em]">Classement</h1>
      <p className="mt-1 text-sm text-slate-500">Les points sont ajoutés après validation de la présence.</p>

      <div className="mt-6 grid grid-cols-2 rounded-full bg-slate-100 p-1">
        <PeriodButton active={period === 'month'} onClick={() => changePeriod('month')}>Ce mois</PeriodButton>
        <PeriodButton active={period === 'all'} onClick={() => changePeriod('all')}>Tout le temps</PeriodButton>
      </div>

      {isLoading ? (
        <div className="grid min-h-72 place-items-center"><span className="block size-9 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></div>
      ) : errorMessage ? (
        <p className="mt-6 rounded-[18px] bg-rose-50 p-4 text-sm text-rose-700" role="alert">{errorMessage}</p>
      ) : entries.length === 0 ? (
        <div className="mt-8 rounded-[24px] bg-slate-50 p-8 text-center"><Trophy className="mx-auto text-sky-500" size={30} /><h2 className="mt-3 font-bold">Le classement démarre bientôt</h2></div>
      ) : (
        <section className="mt-6 space-y-2" aria-label="Classement des bénévoles">
          {entries.map((entry) => <LeaderboardRow entry={entry} key={entry.userId} />)}
          {entries.length === 1 && <p className="pt-4 text-center text-xs leading-5 text-slate-400">Les autres bénévoles apparaîtront ici lorsqu’ils rejoindront dfi3a.</p>}
        </section>
      )}
    </div>
  )
}

function PeriodButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button aria-pressed={active} className={`min-h-11 rounded-full text-sm font-semibold ${active ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'}`} onClick={onClick} type="button">{children}</button>
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <article className={`flex min-h-20 items-center gap-3 rounded-[20px] border p-3 ${entry.isCurrentUser ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white'}`}>
      <span className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold ${entry.rank === 1 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{entry.rank === 1 ? <Crown aria-hidden="true" size={18} /> : entry.rank}</span>
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-slate-700 font-bold text-sky-300">{entry.displayName.slice(0, 1).toUpperCase()}</span>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{entry.displayName}{entry.isCurrentUser && <span className="ml-1 text-xs font-medium text-sky-700">Vous</span>}</p>{entry.city && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin aria-hidden="true" size={12} />{entry.city}</p>}</div>
      <p className="text-sm font-bold text-sky-600"><DBuxAmount amount={entry.points} /></p>
    </article>
  )
}
