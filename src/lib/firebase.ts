import { initializeApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyA0HkSIXjas2ZcZwKd1yxdiLpy-e9Rlt_E',
  authDomain: 'lab-docs-common.firebaseapp.com',
  projectId: 'lab-docs-common',
  storageBucket: 'lab-docs-common.firebasestorage.app',
  messagingSenderId: '122758935253',
  appId: '1:122758935253:web:226234ea0f9cd8c8eb285c',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()

googleProvider.setCustomParameters({ hd: 'seah.co.kr', prompt: 'select_account' })

export const ALLOWED_EMAIL_DOMAIN = 'seah.co.kr'
export const ADMIN_EMAIL = 'chaelynn.kim@seah.co.kr'

export function isAllowedEmail(email: string | null | undefined): boolean {
  return Boolean(email?.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`))
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return email?.toLowerCase() === ADMIN_EMAIL
}
