import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { ALLOWED_EMAIL_DOMAIN, auth, googleProvider, isAdminEmail, isAllowedEmail } from '../lib/firebase'
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    return onAuthStateChanged(auth, async (next) => {
      if (next && !isAllowedEmail(next.email)) {
        setError(`@${ALLOWED_EMAIL_DOMAIN} 계정만 사용할 수 있습니다.`)
        await signOut(auth)
        setUser(null)
        setReady(true)
        return
      }
      setUser(next)
      setReady(true)
    })
  }, [])

  const signIn = useCallback(async () => {
    setError('')
    try {
      const result = await signInWithPopup(auth, googleProvider)
      if (!isAllowedEmail(result.user.email)) {
        await signOut(auth)
        setError(`@${ALLOWED_EMAIL_DOMAIN} 계정만 사용할 수 있습니다.`)
      }
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
  }, [])

  const logOut = useCallback(async () => {
    await signOut(auth)
  }, [])

  const profile = useMemo<UserProfile | null>(() => {
    if (!user) return null
    return {
      name: user.displayName?.trim() || user.email?.split('@')[0] || '사용자',
      email: user.email ?? '',
      department: '시험검사반',
    }
  }, [user])

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
