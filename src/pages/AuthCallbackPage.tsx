import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [errorMessage, setErrorMessage] = useState('')
  const [email, setEmail] = useState('')
  const [isResending, setIsResending] = useState(false)
  const [resendComplete, setResendComplete] = useState(false)

  const returnTo = searchParams.get('returnTo') || '/'

  useEffect(() => {
    const finishAuthentication = async () => {
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      const callbackError = hashParams.get('error')
      const errorCode = hashParams.get('error_code')

      if (callbackError) {
        setErrorMessage(
          errorCode === 'otp_expired'
            ? 'Ce lien de confirmation est invalide, déjà utilisé ou expiré.'
            : hashParams.get('error_description') || 'La confirmation a échoué.',
        )
        return
      }

      const code = searchParams.get('code')

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setErrorMessage(error.message)
          return
        }
      }

      const { data } = await supabase.auth.getSession()

      if (data.session) {
        navigate(returnTo, { replace: true })
      } else {
        setErrorMessage('Le lien de confirmation est invalide ou a expiré.')
      }
    }

    void finishAuthentication()
  }, [navigate, returnTo, searchParams])

  const resendConfirmation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsResending(true)
    setErrorMessage('')

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
      },
    })

    setIsResending(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setResendComplete(true)
  }

  if (resendComplete) {
    return (
      <main className="mx-auto grid min-h-dvh w-full max-w-md place-items-center bg-white p-6 text-center">
        <div>
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-sky-100 text-sky-700">
            <CheckCircle2 aria-hidden="true" size={31} />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Nouvel e-mail envoyé</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Ouvrez le message le plus récent et utilisez uniquement ce nouveau lien.
          </p>
        </div>
      </main>
    )
  }

  if (errorMessage) {
    return (
      <main className="mx-auto grid min-h-dvh w-full max-w-md place-items-center bg-white p-6 text-center">
        <div className="w-full">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-rose-50 text-rose-600">
            <AlertCircle aria-hidden="true" size={31} />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Lien non valide</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{errorMessage}</p>

          <form className="mt-6 text-left" onSubmit={resendConfirmation}>
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
            <button
              className="mt-4 min-h-12 w-full rounded-full bg-sky-500 px-5 text-sm font-bold text-white disabled:opacity-60"
              disabled={isResending}
              type="submit"
            >
              {isResending ? 'Envoi en cours…' : 'Renvoyer le lien'}
            </button>
          </form>

          <button
            className="mt-4 text-sm font-semibold text-slate-600"
            onClick={() =>
              navigate(`/auth?mode=login&returnTo=${encodeURIComponent(returnTo)}`)
            }
            type="button"
          >
            Retour à la connexion
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-md place-items-center bg-white p-6 text-center">
      <div>
        <span className="mx-auto block size-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
        <h1 className="mt-5 text-xl font-bold">Confirmation en cours…</h1>
      </div>
    </main>
  )
}
