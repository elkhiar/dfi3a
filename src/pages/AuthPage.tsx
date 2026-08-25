import { ArrowLeft, CheckCircle2, Eye, EyeOff, HandHeart } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { getSafeReturnTo } from '../lib/navigation'
import { supabase } from '../lib/supabase'

type AuthMode = 'login' | 'signup'

export function AuthPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login'
  const returnTo = getSafeReturnTo(searchParams.get('returnTo'))
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [confirmationEmail, setConfirmationEmail] = useState('')

  useEffect(() => {
    if (user) navigate(returnTo, { replace: true })
  }, [navigate, returnTo, user])

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setErrorMessage('')
    setConfirmationEmail('')
    setSearchParams({ mode: nextMode, returnTo })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate(returnTo, { replace: true })
        return
      }

      const firstName = String(form.get('firstName') ?? '').trim()
      const lastName = String(form.get('lastName') ?? '').trim()
      const birthdate = String(form.get('birthdate') ?? '')
      const city = String(form.get('city') ?? '').trim()

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            account_type: 'volunteer',
            first_name: firstName,
            last_name: lastName,
            birthdate,
            city,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
        },
      })

      if (error) throw error

      if (data.session) {
        navigate(returnTo, { replace: true })
      } else {
        setConfirmationEmail(email)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setErrorMessage(
        message === 'Invalid login credentials'
          ? 'Adresse e-mail ou mot de passe incorrect.'
          : message || 'Une erreur est survenue. Veuillez réessayer.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (confirmationEmail) {
    return (
      <main className="mx-auto grid min-h-dvh w-full max-w-md place-items-center bg-white p-6 text-center">
        <div>
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-sky-100 text-sky-700">
            <CheckCircle2 aria-hidden="true" size={31} />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Vérifiez votre e-mail</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Nous avons envoyé un lien de confirmation à <strong>{confirmationEmail}</strong>.
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Après confirmation, vous reviendrez automatiquement sur dfi3a.
          </p>
          <button
            className="mt-6 min-h-12 rounded-full bg-sky-500 px-6 text-sm font-bold text-white"
            onClick={() => changeMode('login')}
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

      <div className="mt-6 flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-[16px] bg-sky-500 text-white">
          <HandHeart aria-hidden="true" size={25} />
        </span>
        <div>
          <p className="text-xl font-bold">dfi3a</p>
          <p className="text-xs text-slate-500">Agir ensemble, près de chez vous</p>
        </div>
      </div>

      <h1 className="mt-8 text-[28px] font-bold leading-tight tracking-[-0.03em]">
        {mode === 'login' ? 'Bon retour !' : 'Devenir bénévole'}
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {mode === 'login'
          ? 'Connectez-vous pour retrouver vos missions et vos points.'
          : 'Créez votre profil pour rejoindre des missions solidaires.'}
      </p>

      <div className="mt-6 grid grid-cols-2 rounded-full bg-slate-100 p-1">
        <ModeButton active={mode === 'login'} onClick={() => changeMode('login')}>
          Connexion
        </ModeButton>
        <ModeButton active={mode === 'signup'} onClick={() => changeMode('signup')}>
          Inscription
        </ModeButton>
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {mode === 'signup' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field autoComplete="given-name" label="Prénom" name="firstName" required />
              <Field autoComplete="family-name" label="Nom" name="lastName" required />
            </div>
            <Field label="Date de naissance" name="birthdate" required type="date" />
            <Field autoComplete="address-level2" label="Ville" name="city" required />
          </>
        )}

        <Field autoComplete="email" label="Adresse e-mail" name="email" required type="email" />

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Mot de passe</span>
          <span className="relative block">
            <input
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="min-h-12 w-full rounded-[16px] border border-slate-300 bg-white px-4 pr-12 text-base outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              minLength={8}
              name="password"
              required
              type={showPassword ? 'text' : 'password'}
            />
            <button
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-500"
              onClick={() => setShowPassword((visible) => !visible)}
              type="button"
            >
              {showPassword ? <EyeOff aria-hidden="true" size={19} /> : <Eye aria-hidden="true" size={19} />}
            </button>
          </span>
          {mode === 'signup' && (
            <span className="mt-1 block text-xs text-slate-500">8 caractères minimum</span>
          )}
        </label>

        {mode === 'login' && (
          <button
            className="-mt-1 block text-sm font-semibold text-sky-700"
            onClick={() =>
              navigate(`/auth/forgot-password?returnTo=${encodeURIComponent(returnTo)}`)
            }
            type="button"
          >
            Mot de passe oublié ?
          </button>
        )}

        {mode === 'signup' && (
          <label className="flex items-start gap-3 text-xs leading-5 text-slate-600">
            <input className="mt-1 accent-sky-500" required type="checkbox" />
            <span>J’accepte les conditions d’utilisation et la politique de confidentialité.</span>
          </label>
        )}

        {errorMessage && (
          <p className="rounded-[16px] bg-rose-50 p-3 text-sm text-rose-700" role="alert">
            {errorMessage}
          </p>
        )}

        <button
          className="min-h-12 w-full rounded-full bg-sky-500 px-5 text-sm font-bold text-white disabled:bg-slate-300"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting
            ? 'Chargement…'
            : mode === 'login'
              ? 'Se connecter'
              : 'Créer mon compte bénévole'}
        </button>
      </form>

      <div className="mt-7 border-t border-slate-200 pt-5 text-center">
        <p className="text-sm font-semibold">Vous représentez une ONG ?</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Les comptes ONG suivent une demande et une validation séparées.
        </p>
        <button
          className="mt-2 text-sm font-bold text-sky-600"
          onClick={() => navigate('/ngo/apply')}
          type="button"
        >
          Demander un compte ONG
        </button>
      </div>
    </main>
  )
}

type ModeButtonProps = {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}

function ModeButton({ active, children, onClick }: ModeButtonProps) {
  return (
    <button
      aria-pressed={active}
      className={`min-h-10 rounded-full text-sm font-semibold transition ${
        active ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string
  name: string
}

function Field({ label, name, ...inputProps }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      <input
        className="min-h-12 w-full rounded-[16px] border border-slate-300 bg-white px-4 text-base outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        name={name}
        {...inputProps}
      />
    </label>
  )
}
