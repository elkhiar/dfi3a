type SignupUser = {
  identities?: unknown[] | null
  id?: string
  user_metadata?: Record<string, unknown>
} | null

export function emailAlreadyHasAccount(user: SignupUser) {
  return Array.isArray(user?.identities) && user.identities.length === 0
}

export async function syncVolunteerSignupProfile(user: SignupUser) {
  if (!user?.id || user.user_metadata?.account_type !== 'volunteer') return
  const { supabase } = await import('./supabase')
  const metadata = user.user_metadata
  const { error } = await supabase
    .from('profiles')
    .update({
      city: typeof metadata.city === 'string' ? metadata.city : null,
      show_city: metadata.show_city !== false,
      show_in_directory: metadata.show_in_directory === true,
      show_in_leaderboard: metadata.show_in_leaderboard !== false,
    })
    .eq('user_id', user.id)
  if (error) throw error
}
