import type { User } from 'firebase/auth'
import type { UserProfile } from '../types'

export const COMPANY_LABEL = '세아씨엠'
export const GOOGLE_PROFILE_KEY = 'googleProfile'

export interface CachedGoogleProfile {
  uid: string
  name: string
  email: string
  photoURL?: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function koreanFullName(family: string, given: string): string {
  if (family && given && /[가-힣]/.test(`${family}${given}`)) return `${family}${given}`
  return ''
}

function pickPeopleName(people: Record<string, unknown> | null): string {
  if (!people || !Array.isArray(people.names)) return ''
  for (const item of people.names) {
    const row = asRecord(item)
    if (!row) continue
    const combined = koreanFullName(text(row.familyName), text(row.givenName))
    if (combined) return combined
    const display = text(row.displayName)
    if (display) return display
  }
  return ''
}

function pickPeopleEmail(people: Record<string, unknown> | null): string {
  if (!people || !Array.isArray(people.emailAddresses)) return ''
  for (const item of people.emailAddresses) {
    const row = asRecord(item)
    const value = text(row?.value)
    if (value) return value
  }
  return ''
}

function pickPeoplePhoto(people: Record<string, unknown> | null): string {
  if (!people || !Array.isArray(people.photos)) return ''
  for (const item of people.photos) {
    const row = asRecord(item)
    const url = text(row?.url)
    if (url) return url
  }
  return ''
}

async function readObject(res: Response): Promise<Record<string, unknown> | null> {
  if (!res.ok) return null
  try {
    return asRecord(await res.json())
  } catch {
    return null
  }
}

export async function fetchGoogleAccount(accessToken: string): Promise<Omit<CachedGoogleProfile, 'uid'> | null> {
  const headers = { Authorization: `Bearer ${accessToken}` }
  const [info, people] = await Promise.all([
    fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers })
      .then(readObject)
      .catch(() => null),
    fetch(
      'https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses,photos,organizations',
      { headers },
    )
      .then(readObject)
      .catch(() => null),
  ])

  const korean = koreanFullName(text(info?.family_name), text(info?.given_name))
  const name = pickPeopleName(people) || korean || text(info?.name)
  const email = pickPeopleEmail(people) || text(info?.email)
  const photoURL = pickPeoplePhoto(people) || text(info?.picture) || undefined
  if (!name && !email && !photoURL) return null
  return { name, email, photoURL }
}

export function nameFromGooglePayload(payload: Record<string, unknown> | null): string {
  if (!payload) return ''
  return koreanFullName(text(payload.family_name), text(payload.given_name)) || text(payload.name)
}

export function photoFromGooglePayload(payload: Record<string, unknown> | null): string {
  return text(payload?.picture)
}

function nameScore(name: string, email: string): number {
  const suffix = `/${COMPANY_LABEL}`
  const base = name.endsWith(suffix) ? name.slice(0, -suffix.length).trim() : name.trim()
  const local = email.split('@')[0] ?? ''
  if (!base || base === '사용자') return 0
  if (base === local) return 1
  if (/[가-힣]/.test(base)) return 3
  return 2
}

export function mergeGoogleProfiles(
  incoming: Omit<CachedGoogleProfile, 'uid'> | CachedGoogleProfile | null,
  current: CachedGoogleProfile,
): CachedGoogleProfile {
  const email = text(incoming?.email) || current.email
  const incomingName = text(incoming?.name)
  const currentName = text(current.name)
  const name = nameScore(incomingName, email) >= nameScore(currentName, email) ? incomingName : currentName
  const photoURL = text(incoming?.photoURL) || current.photoURL
  return {
    uid: current.uid,
    name: formatAccountName(name, email),
    email,
    photoURL: photoURL?.replace(/=s\d+-c\b/, '=s128-c') || undefined,
  }
}

export function formatAccountName(name: string, email: string): string {
  const local = email.split('@')[0] ?? ''
  const suffix = `/${COMPANY_LABEL}`
  const trimmed = name.trim()
  const withoutCompany = trimmed.endsWith(suffix) ? trimmed.slice(0, -suffix.length).trim() : trimmed
  const base = withoutCompany && withoutCompany !== local ? withoutCompany : withoutCompany || local || '사용자'
  return `${base}${suffix}`
}

export async function profileFromFirebaseUser(user: User): Promise<CachedGoogleProfile> {
  const google = user.providerData.find((item) => item.providerId === 'google.com')
  let name = text(google?.displayName) || text(user.displayName)
  let email = text(google?.email) || text(user.email)
  let photoURL = google?.photoURL || user.photoURL || undefined

  if (!name) {
    try {
      const token = await user.getIdTokenResult()
      name = text(token.claims.name)
      if (!photoURL) photoURL = text(token.claims.picture) || undefined
    } catch {
      /* keep fallbacks */
    }
  }

  return {
    uid: user.uid,
    name: formatAccountName(name, email),
    email,
    photoURL: photoURL?.replace(/=s\d+-c\b/, '=s128-c') || undefined,
  }
}

export function toUserProfile(cached: CachedGoogleProfile): UserProfile {
  return {
    name: formatAccountName(cached.name, cached.email),
    email: cached.email,
    department: COMPANY_LABEL,
    photoURL: cached.photoURL,
  }
}
