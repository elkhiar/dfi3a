import { Ban, X } from 'lucide-react'
import { useState } from 'react'
import { cancelNgoMission } from '../services/ngos'

type CancelMissionSheetProps = {
  missionId: string
  missionTitle: string
  onCancelled: (cancelledRegistrationCount: number) => void
  onClose: () => void
}

function getCancellationError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('mission_already_started')) return 'Une mission déjà commencée ne peut plus être annulée.'
  if (message.includes('cancellation_reason_required')) return 'Expliquez la raison de l’annulation en au moins 10 caractères.'
  if (message.includes('mission_not_cancellable')) return 'Cette mission a déjà été annulée ou finalisée.'
  return 'La mission n’a pas pu être annulée.'
}

export function CancelMissionSheet({ missionId, missionTitle, onCancelled, onClose }: CancelMissionSheetProps) {
  const [reason, setReason] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async () => {
    if (reason.trim().length < 10) return
    setIsSubmitting(true)
    setErrorMessage('')
    try {
      const result = await cancelNgoMission(missionId, reason.trim())
      onCancelled(result?.cancelled_registration_count ?? 0)
    } catch (error) {
      setErrorMessage(getCancellationError(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 p-3" role="presentation">
      <section aria-labelledby="cancel-mission-title" aria-modal="true" className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-2xl" role="dialog">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-rose-600">Action définitive</p>
            <h2 className="mt-1 text-xl font-bold" id="cancel-mission-title">Annuler cette mission ?</h2>
          </div>
          <button aria-label="Fermer" className="grid size-10 place-items-center rounded-full bg-slate-100" disabled={isSubmitting} onClick={onClose} type="button"><X aria-hidden="true" size={18} /></button>
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-800">{missionTitle}</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">La mission disparaîtra des recherches. Toutes les inscriptions seront annulées sans retirer de points aux bénévoles.</p>
        <label className="mt-4 block">
          <span className="text-sm font-semibold">Motif de l’annulation</span>
          <textarea autoFocus className="mt-2 min-h-24 w-full resize-none rounded-[16px] border border-slate-300 p-3 text-base outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" maxLength={500} onChange={(event) => setReason(event.target.value)} placeholder="Expliquez la raison aux bénévoles…" value={reason} />
        </label>
        <p className="mt-1 text-xs text-slate-400">10 caractères minimum</p>
        {errorMessage && <p className="mt-3 rounded-[14px] bg-rose-50 p-3 text-sm text-rose-700" role="alert">{errorMessage}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button className="min-h-12 rounded-full bg-slate-100 text-sm font-bold text-slate-700" disabled={isSubmitting} onClick={onClose} type="button">Conserver</button>
          <button className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-rose-500 text-sm font-bold text-white disabled:opacity-50" disabled={isSubmitting || reason.trim().length < 10} onClick={() => void submit()} type="button"><Ban aria-hidden="true" size={17} />{isSubmitting ? 'Annulation…' : 'Annuler la mission'}</button>
        </div>
      </section>
    </div>
  )
}
