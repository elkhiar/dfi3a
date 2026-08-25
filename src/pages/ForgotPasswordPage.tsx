import { ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getSafeReturnTo } from '../lib/navigation'
import { supabase } from '../lib/supabase'

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const returnTo = getSafeReturnTo(searchParams.get('returnTo'))

  const sendResetEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/reset-password?returnTo=${encodeURIComponent(returnTo)}`,
    })

    setIsSubmitting(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setIsSent(true)
  }

  if (isSent) {
    return (
      <main className="mx-auto grid min-h-dvh w-full max-w-md place-items-center bg-white p-6 text-center">
        <div>
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-sky-100 text-sky-700">
            <CheckCircle2 aria-hidden="true" size={31} />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Vérifiez votre e-mail</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Si cette adresse correspond à un compte, un lien de réinitialisation vient d’être envoyé.
          </p>
          <button
            className="mt-6 text-sm font-semibold text-sky-700"
            onClick={() => navigate(`/auth?mode=login&returnTo=${encodeURIComponent(returnTo)}`)}
            type="button"
          >
            Retour à la connexion
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md bg-white px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] text-slate-950 shadow-sm">
      <button
        aria-label="Retour"
        className="grid size-11 place-items-center rounded-full border border-slate-200"
        onClick={() => navigate(-1)}
        type="button"
      >
        <ArrowLeft aria-hidden="true" size={21} />
      </button>

      <span className="mt-10 grid size-14 place-items-center rounded-[18px] bg-sky-500 text-white">
        <KeyRound aria-hidden="true" size={27} />
      </span>
      <h1 className="mt-5 text-[28px] font-bold leading-tight tracking-[-0.03em]">
        Mot de passe oublié ?
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Saisissez l’adresse e-mail utilisée pour votre compte bénévole.
      </p>

      <form className="mt-7" onSubmit={sendResetEmail}>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Adresse e-mail</span>
          <input
            autoComplete="email"
            className="min-h-12 w-full rounded-[16px] border border-slate-300 bg-white px-4 text-base outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>

        {errorMessage && (
          <p className="mt-4 rounded-[16px] bg-rose-50 p-3 text-sm text-rose-700" role="alert">
            {errorMessage}
          </p>
        )}

        <button
          className="mt-5 min-h-12 w-full rounded-full bg-sky-500 px-5 text-sm font-bold text-white disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Envoi en cours…' : 'Envoyer le lien'}
        </button>
      </form>
    </main>
  )
}
