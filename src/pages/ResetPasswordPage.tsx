import { CheckCircle2, KeyRound } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { supabase } from '../lib/supabase'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isLoading, user } = useAuth()
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const returnTo = searchParams.get('returnTo') || '/'

  const updatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')

    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') || '')
    const confirmation = String(form.get('confirmation') || '')

    if (password !== confirmation) {
      setErrorMessage('Les deux mots de passe ne correspondent pas.')
      return
    }

    setIsSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    setIsSubmitting(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setIsComplete(true)
  }

  if (isLoading) {
    return (
      <main className="grid min-h-dvh place-items-center bg-white">
        <span className="block size-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
      </main>
    )
  }

  if (!user) {
    return (
      <main className="mx-auto grid min-h-dvh w-full max-w-md place-items-center bg-white p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Lien non valide</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Ce lien de réinitialisation est invalide ou a expiré.
          </p>
          <button
            className="mt-6 text-sm font-semibold text-sky-700"
            onClick={() => navigate(`/auth/forgot-password?returnTo=${encodeURIComponent(returnTo)}`)}
            type="button"
          >
            Demander un nouveau lien
          </button>
        </div>
      </main>
    )
  }

  if (isComplete) {
    return (
      <main className="mx-auto grid min-h-dvh w-full max-w-md place-items-center bg-white p-6 text-center">
        <div>
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-sky-100 text-sky-700">
            <CheckCircle2 aria-hidden="true" size={31} />
          </span>
          <h1 className="mt-5 text-2xl font-bold">Mot de passe modifié</h1>
          <button
            className="mt-6 min-h-12 rounded-full bg-sky-500 px-7 text-sm font-bold text-white"
            onClick={() => navigate(returnTo, { replace: true })}
            type="button"
          >
            Continuer vers la mission
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md bg-white px-5 pb-8 pt-16 text-slate-950 shadow-sm">
      <span className="grid size-14 place-items-center rounded-[18px] bg-sky-500 text-white">
        <KeyRound aria-hidden="true" size={27} />
      </span>
      <h1 className="mt-5 text-[28px] font-bold tracking-[-0.03em]">Nouveau mot de passe</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Choisissez un nouveau mot de passe d’au moins 8 caractères.
      </p>

      <form className="mt-7 space-y-4" onSubmit={updatePassword}>
        <PasswordField label="Nouveau mot de passe" name="password" />
        <PasswordField label="Confirmer le mot de passe" name="confirmation" />

        {errorMessage && (
          <p className="rounded-[16px] bg-rose-50 p-3 text-sm text-rose-700" role="alert">
            {errorMessage}
          </p>
        )}

        <button
          className="min-h-12 w-full rounded-full bg-sky-500 px-5 text-sm font-bold text-white disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Modification…' : 'Modifier le mot de passe'}
        </button>
      </form>
    </main>
  )
}

function PasswordField({ label, name }: { label: string; name: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      <input
        autoComplete="new-password"
        className="min-h-12 w-full rounded-[16px] border border-slate-300 bg-white px-4 text-base outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        minLength={8}
        name={name}
        required
        type="password"
      />
    </label>
  )
}
