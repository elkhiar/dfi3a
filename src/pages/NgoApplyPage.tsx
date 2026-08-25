import { ArrowLeft, Building2, CheckCircle2, Clock3, FileCheck2, ShieldAlert } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { supabase } from '../lib/supabase'
import {
  getMyAccountType,
  getMyNgoApplication,
  deleteNgoDocument,
  submitNgoApplication,
  uploadNgoDocument,
} from '../services/ngos'
import type { NgoApplicationSnapshot } from '../services/ngos'

type AccountType = 'volunteer' | 'ngo' | 'admin' | null

export function NgoApplyPage() {
  const navigate = useNavigate()
  const { user, isLoading: isAuthLoading } = useAuth()
  const [accountType, setAccountType] = useState<AccountType>(null)
  const [application, setApplication] = useState<NgoApplicationSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (isAuthLoading) return
    if (!user) return

    let isCurrent = true
    void getMyAccountType()
      .then(async (type) => {
        if (!isCurrent) return
        setAccountType(type)
        if (type === 'ngo') setApplication(await getMyNgoApplication())
      })
      .catch(() => { if (isCurrent) setLoadError(true) })
      .finally(() => { if (isCurrent) setIsLoading(false) })

    return () => {
      isCurrent = false
    }
  }, [isAuthLoading, user])

  if (isAuthLoading) {
    return <main className="grid min-h-dvh place-items-center bg-white"><span className="block size-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></main>
  }

  if (!user) return <NgoAccountSignup />

  if (isLoading) {
    return <main className="grid min-h-dvh place-items-center bg-white"><span className="block size-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" /></main>
  }

  if (loadError) return <CenteredCard icon={ShieldAlert} title="Chargement impossible"><p className="mt-2 text-sm leading-6 text-slate-600">Vérifiez votre connexion puis réessayez.</p><button className="mt-6 min-h-12 w-full rounded-full bg-sky-500 text-sm font-bold text-white" onClick={() => window.location.reload()} type="button">Réessayer</button></CenteredCard>

  if (accountType !== 'ngo') {
    return (
      <CenteredCard icon={ShieldAlert} title="Un compte séparé est nécessaire">
        <p className="mt-2 text-sm leading-6 text-slate-600">Vous êtes connecté avec un compte bénévole. Pour représenter une ONG, utilisez une autre adresse e-mail et créez un compte ONG distinct.</p>
        <button className="mt-6 min-h-12 w-full rounded-full bg-sky-500 text-sm font-bold text-white" onClick={() => void supabase.auth.signOut()} type="button">Se déconnecter et continuer</button>
        <button className="mt-3 text-sm font-semibold text-slate-500" onClick={() => navigate(-1)} type="button">Retour</button>
      </CenteredCard>
    )
  }

  if (application) return <ApplicationStatus application={application} />

  return <NgoApplicationForm onSubmitted={setApplication} userId={user.id} />
}

function NgoAccountSignup() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [confirmationEmail, setConfirmationEmail] = useState('')
  const [resendMessage, setResendMessage] = useState('')

  const createAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage('')
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '').trim()

    const { data, error } = await supabase.auth.signUp({
      email,
      password: String(form.get('password') || ''),
      options: {
        data: {
          account_type: 'ngo',
          first_name: String(form.get('firstName') || '').trim(),
          last_name: String(form.get('lastName') || '').trim(),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent('/ngo/apply')}`,
      },
    })

    setIsSubmitting(false)
    if (error) {
      setErrorMessage(error.message)
      return
    }
    if (data.session) window.location.reload()
    else setConfirmationEmail(email)
  }

  const resendConfirmation = async () => {
    setIsResending(true)
    setErrorMessage('')
    setResendMessage('')

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: confirmationEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent('/ngo/apply')}`,
      },
    })

    setIsResending(false)
    if (error) {
      setErrorMessage(error.message)
      return
    }
    setResendMessage('Un nouveau lien de confirmation vient de vous être envoyé.')
  }

  if (confirmationEmail) {
    return (
      <CenteredCard icon={CheckCircle2} title="Vérifiez votre e-mail">
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Confirmez le nouveau compte ONG envoyé à <strong>{confirmationEmail}</strong>, puis vous reviendrez remplir la demande.
        </p>
        {resendMessage && <p className="mt-4 rounded-[16px] bg-emerald-50 p-3 text-sm text-emerald-700" role="status">{resendMessage}</p>}
        {errorMessage && <p className="mt-4 rounded-[16px] bg-rose-50 p-3 text-sm text-rose-700" role="alert">{errorMessage}</p>}
        <button className="mt-6 min-h-12 w-full rounded-full border border-sky-300 text-sm font-bold text-sky-700 disabled:opacity-60" disabled={isResending} onClick={() => void resendConfirmation()} type="button">
          {isResending ? 'Envoi…' : 'Renvoyer l’e-mail de confirmation'}
        </button>
      </CenteredCard>
    )
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md bg-white px-5 pb-8 pt-5 text-slate-950">
      <button aria-label="Retour" className="grid size-11 place-items-center rounded-full border border-slate-200" onClick={() => navigate(-1)} type="button"><ArrowLeft aria-hidden="true" size={21} /></button>
      <span className="mt-8 grid size-14 place-items-center rounded-[18px] bg-sky-500 text-white"><Building2 aria-hidden="true" size={27} /></span>
      <h1 className="mt-5 text-[28px] font-bold tracking-[-0.03em]">Créer un compte ONG</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Ce compte sera réservé à votre organisation et devra être validé par dfi3a.</p>
      <form className="mt-7 space-y-4" onSubmit={createAccount}>
        <div className="grid grid-cols-2 gap-3"><Field label="Prénom du contact" name="firstName" /><Field label="Nom du contact" name="lastName" /></div>
        <Field label="E-mail professionnel" name="email" type="email" />
        <Field label="Mot de passe" minLength={8} name="password" type="password" />
        {errorMessage && <p className="rounded-[16px] bg-rose-50 p-3 text-sm text-rose-700" role="alert">{errorMessage}</p>}
        <button className="min-h-12 w-full rounded-full bg-sky-500 text-sm font-bold text-white disabled:opacity-60" disabled={isSubmitting} type="submit">{isSubmitting ? 'Création…' : 'Créer le compte ONG'}</button>
      </form>
    </main>
  )
}

function NgoApplicationForm({ onSubmitted, userId }: { onSubmitted: (application: NgoApplicationSnapshot) => void; userId: string }) {
  const [document, setDocument] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!document) {
      setErrorMessage('Ajoutez le document d’enregistrement de l’association.')
      return
    }
    if (document.size > 5 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png'].includes(document.type)) {
      setErrorMessage('Le document doit être un PDF, JPG ou PNG de 5 Mo maximum.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')
    const form = new FormData(event.currentTarget)
    let uploadedDocumentPath = ''

    try {
      const documentPath = await uploadNgoDocument(userId, document)
      uploadedDocumentPath = documentPath
      const values = (name: string) => String(form.get(name) || '').trim()
      const result = await submitNgoApplication({
        name: values('name'), description: values('description'), mainCity: values('mainCity'),
        legalName: values('legalName'), legalAddress: values('legalAddress'),
        contactFullName: values('contactFullName'), officialEmail: values('officialEmail'),
        phone: values('phone'), registrationNumber: values('registrationNumber'),
        registrationDocumentPath: documentPath,
      })
      onSubmitted({ id: result.ngo_id, name: values('name'), description: values('description'), mainCity: values('mainCity'), status: 'pending', submittedAt: new Date().toISOString(), rejectionReason: null })
    } catch (error) {
      if (uploadedDocumentPath) void deleteNgoDocument(uploadedDocumentPath).catch(() => undefined)
      const message =
        typeof error === 'object' && error !== null && 'message' in error
          ? String(error.message)
          : ''
      setErrorMessage(message || 'La demande n’a pas pu être envoyée.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md bg-white px-5 pb-10 pt-8 text-slate-950">
      <p className="text-xs font-semibold text-sky-600">Validation dfi3a</p><h1 className="mt-1 text-[28px] font-bold tracking-[-0.03em]">Demande ONG</h1><p className="mt-2 text-sm leading-6 text-slate-600">Ces informations seront visibles uniquement par l’équipe de validation.</p>
      <form className="mt-7 space-y-4" onSubmit={submit}>
        <SectionTitle>Organisation</SectionTitle>
        <Field label="Nom public" name="name" /><Field label="Ville principale" name="mainCity" />
        <TextArea label="Description" name="description" />
        <SectionTitle>Informations légales</SectionTitle>
        <Field label="Nom légal" name="legalName" /><Field label="Adresse légale" name="legalAddress" />
        <Field label="Numéro d’enregistrement" name="registrationNumber" />
        <SectionTitle>Contact</SectionTitle>
        <Field label="Nom complet" name="contactFullName" /><Field label="E-mail officiel" name="officialEmail" type="email" /><Field label="Téléphone" name="phone" type="tel" />
        <label className="block rounded-[18px] border border-dashed border-sky-300 bg-sky-50 p-4"><span className="flex items-center gap-2 text-sm font-bold text-sky-800"><FileCheck2 aria-hidden="true" size={18} />Document d’enregistrement</span><input accept="application/pdf,image/jpeg,image/png" className="mt-3 block w-full text-xs" onChange={(event) => setDocument(event.target.files?.[0] ?? null)} required type="file" /><span className="mt-2 block text-xs text-slate-500">PDF, JPG ou PNG · 5 Mo maximum</span></label>
        {errorMessage && <p className="rounded-[16px] bg-rose-50 p-3 text-sm text-rose-700" role="alert">{errorMessage}</p>}
        <button className="min-h-12 w-full rounded-full bg-sky-500 text-sm font-bold text-white disabled:opacity-60" disabled={isSubmitting} type="submit">{isSubmitting ? 'Envoi…' : 'Envoyer la demande'}</button>
      </form>
    </main>
  )
}

function ApplicationStatus({ application }: { application: NgoApplicationSnapshot }) {
  const navigate = useNavigate()
  const approved = application.status === 'approved'
  const rejected = application.status === 'rejected'
  const signOut = async () => { await supabase.auth.signOut(); navigate('/auth?mode=login', { replace: true }) }
  return <CenteredCard icon={approved ? CheckCircle2 : rejected ? ShieldAlert : Clock3} title={approved ? 'ONG approuvée' : rejected ? 'Demande à corriger' : 'Demande en cours'}><p className="mt-2 text-sm leading-6 text-slate-600">{approved ? 'Votre organisation peut maintenant publier et gérer ses missions.' : rejected ? application.rejectionReason || 'Consultez les informations demandées avant de renvoyer votre dossier.' : 'L’équipe dfi3a examine les informations de votre organisation. Vous serez informé après la décision.'}</p><div className="mt-5 rounded-[18px] bg-slate-50 p-4 text-left"><p className="font-bold">{application.name}</p><p className="mt-1 text-xs text-slate-500">{application.mainCity}</p></div>{approved && <button className="mt-5 min-h-12 w-full rounded-full bg-sky-500 text-sm font-bold text-white" onClick={() => navigate('/ngo/dashboard')} type="button">Ouvrir le tableau de bord</button>}<button className="mt-3 min-h-11 w-full rounded-full border border-slate-200 text-sm font-semibold text-slate-600" onClick={() => void signOut()} type="button">Se déconnecter</button></CenteredCard>
}

function CenteredCard({ children, icon: Icon, title }: { children: React.ReactNode; icon: typeof Building2; title: string }) { return <main className="mx-auto grid min-h-dvh w-full max-w-md place-items-center bg-white p-6 text-center"><div className="w-full"><span className="mx-auto grid size-16 place-items-center rounded-full bg-sky-100 text-sky-700"><Icon aria-hidden="true" size={30} /></span><h1 className="mt-5 text-2xl font-bold">{title}</h1>{children}</div></main> }
function Field({ label, minLength, name, type = 'text' }: { label: string; minLength?: number; name: string; type?: string }) { return <label className="block"><span className="mb-1.5 block text-sm font-semibold">{label}</span><input className="min-h-12 w-full rounded-[16px] border border-slate-300 px-3 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" minLength={minLength} name={name} required type={type} /></label> }
function TextArea({ label, name }: { label: string; name: string }) { return <label className="block"><span className="mb-1.5 block text-sm font-semibold">{label}</span><textarea className="min-h-24 w-full resize-none rounded-[16px] border border-slate-300 p-3 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" maxLength={500} name={name} /></label> }
function SectionTitle({ children }: { children: React.ReactNode }) { return <h2 className="pt-2 text-lg font-bold">{children}</h2> }
