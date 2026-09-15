import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  GoogleAuthProvider,
  getAdditionalUserInfo,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { ALLOWED_EMAIL_DOMAIN, auth, googleProvider, isAdminEmail, isAllowedEmail } from '../lib/firebase'
import {
  GOOGLE_PROFILE_KEY,
  fetchGoogleAccount,
  mergeGoogleProfiles,
  nameFromGooglePayload,
  photoFromGooglePayload,
  profileFromFirebaseUser,
  toUserProfile,
  type CachedGoogleProfile,
} from '../lib/googleProfile'
import { readJson, removeKey, writeJson } from '../lib/storage'
import type { UserProfile } from '../types'

interface AuthContextValue {
  ready: boolean
  user: User | null
  profile: UserProfile | null
  isAdmin: boolean
  error: string
  signIn: () => Promise<void>
  logOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function readCachedProfile(uid: string): CachedGoogleProfile | null {
  const saved = readJson<CachedGoogleProfile | null>(GOOGLE_PROFILE_KEY, null)
  return saved?.uid === uid ? saved : null
}

function saveCachedProfile(profile: CachedGoogleProfile) {
  writeJson(GOOGLE_PROFILE_KEY, profile)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [googleProfile, setGoogleProfile] = useState<CachedGoogleProfile | null>(null)
  const [error, setError] = useState('')

  const applyProfile = useCallback((next: CachedGoogleProfile) => {
    setGoogleProfile(next)
    saveCachedProfile(next)
  }, [])

  const hydrateUser = useCallback(
    async (next: User) => {
      try {
        await next.reload()
      } catch {
        /* keep current user snapshot */
      }
      const derived = await profileFromFirebaseUser(next)
      const cached = readCachedProfile(next.uid)
      applyProfile(mergeGoogleProfiles(derived, cached ?? derived))
    },
    [applyProfile],
  )

  useEffect(() => {
    return onAuthStateChanged(auth, async (next) => {
      if (next && !isAllowedEmail(next.email)) {
        setError(`@${ALLOWED_EMAIL_DOMAIN} 계정만 사용할 수 있습니다.`)
        await signOut(auth)
        setUser(null)
        setGoogleProfile(null)
        removeKey(GOOGLE_PROFILE_KEY)
        setReady(true)
        return
      }

      setUser(next)
      if (!next) {
        setGoogleProfile(null)
        removeKey(GOOGLE_PROFILE_KEY)
        setReady(true)
        return
      }

      const cached = readCachedProfile(next.uid)
      if (cached) setGoogleProfile(cached)
      await hydrateUser(next)
      setReady(true)
    })
  }, [hydrateUser])

  const signIn = useCallback(async () => {
    setError('')
    try {
      const result = await signInWithPopup(auth, googleProvider)
      if (!isAllowedEmail(result.user.email)) {
        await signOut(auth)
        setError(`@${ALLOWED_EMAIL_DOMAIN} 계정만 사용할 수 있습니다.`)
        return
      }

      const extra = asRecord(getAdditionalUserInfo(result)?.profile)
      const credential = GoogleAuthProvider.credentialFromResult(result)
      const accessToken = credential?.accessToken
      const fetched = accessToken ? await fetchGoogleAccount(accessToken) : null
      const derived = await profileFromFirebaseUser(result.user)
      applyProfile(
        mergeGoogleProfiles(
          {
            name: fetched?.name || nameFromGooglePayload(extra),
            email: fetched?.email || derived.email,
            photoURL: fetched?.photoURL || photoFromGooglePayload(extra) || derived.photoURL,
          },
          derived,
        ),
      )
    } catch (err) {
      const code = typeof err === 'object' && err && 'code' in err ? String(err.code) : ''
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return
      if (code === 'auth/unauthorized-domain') {
        setError('허용된 도메인이 아닙니다. Firebase Authentication 설정을 확인해 주세요.')
        return
      }
      if (code === 'auth/operation-not-allowed') {
        setError('Google 로그인이 아직 꺼져 있습니다. Firebase Authentication에서 Google을 켜 주세요.')
        return
      }
      setError('로그인에 실패했습니다. Google 로그인 설정을 확인해 주세요.')
    }
  }, [applyProfile])

  const logOut = useCallback(async () => {
    removeKey(GOOGLE_PROFILE_KEY)
    setGoogleProfile(null)
    await signOut(auth)
  }, [])

  const profile = useMemo<UserProfile | null>(() => {
    if (!user) return null
    if (googleProfile && googleProfile.uid === user.uid) return toUserProfile(googleProfile)
    return toUserProfile({
      uid: user.uid,
      name: user.displayName ?? '',
      email: user.email ?? '',
      photoURL: user.photoURL || undefined,
    })
  }, [user, googleProfile])

  const isAdmin = isAdminEmail(user?.email)

  const value = useMemo(
    () => ({ ready, user, profile, isAdmin, error, signIn, logOut }),
    [ready, user, profile, isAdmin, error, signIn, logOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
