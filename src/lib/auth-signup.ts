type SignupUser = {
  identities?: unknown[] | null
} | null

export function emailAlreadyHasAccount(user: SignupUser) {
  return Array.isArray(user?.identities) && user.identities.length === 0
}
