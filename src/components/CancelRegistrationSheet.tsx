import { ShieldAlert, X } from 'lucide-react'
import { useState } from 'react'
import { DBuxAmount } from './DBuxIcon'
import { cancelRegistration } from '../services/registrations'
import type { Mission } from '../types/mission'

export function CancelRegistrationSheet({
  mission,
  onCancelled,
  onClose,
}: {
  mission: Mission
  onCancelled: () => void
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const isLate = new Date() > new Date(mission.registrationDeadline)

  const cancel = async () => {
    if (!mission.databaseId) return
    setIsSubmitting(true)
    setErrorMessage('')
    try {
      await cancelRegistration(mission.databaseId, reason)
      onCancelled()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'L’annulation a échoué.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 sm:items-center sm:p-4">
      <button aria-label="Fermer" className="absolute inset-0" onClick={onClose} type="button" />
      <section aria-modal="true" className="relative z-10 w-full max-w-md rounded-t-[28px] bg-white p-5 pb-7 shadow-2xl sm:rounded-[28px]" role="dialog">
        <button aria-label="Fermer" className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-slate-100" onClick={onClose} type="button"><X aria-hidden="true" size={18} /></button>
        <ShieldAlert className={isLate ? 'text-rose-600' : 'text-amber-600'} size={29} />
        <h2 className="mt-4 pr-10 text-2xl font-bold">Annuler votre participation ?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{isLate ? <>La date limite est dépassée. Cette annulation retirera <DBuxAmount amount="10" />.</> : 'Vous pouvez annuler sans perdre de D-bux avant la date limite.'}</p>
        <label className="mt-5 block"><span className="mb-1.5 block text-sm font-semibold">Motif facultatif</span><textarea className="min-h-24 w-full resize-none rounded-[16px] border border-slate-300 p-3 outline-none focus:border-sky-500" onChange={(event) => setReason(event.target.value)} value={reason} /></label>
        {errorMessage && <p className="mt-3 text-sm text-rose-700" role="alert">{errorMessage}</p>}
        <button className="mt-5 min-h-12 w-full rounded-full bg-rose-600 text-sm font-bold text-white disabled:opacity-60" disabled={isSubmitting} onClick={() => void cancel()} type="button">{isSubmitting ? 'Annulation…' : 'Confirmer l’annulation'}</button>
        <button className="mt-2 min-h-11 w-full text-sm font-semibold text-slate-500" onClick={onClose} type="button">Garder ma participation</button>
      </section>
    </div>
  )
}
