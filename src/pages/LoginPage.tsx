import { SeahLogo } from '../components/brand/SeahLogo'
import { useAuth } from '../context/AuthContext'

function GoogleMark() {
  return (
    <span className="login-google-badge" aria-hidden="true">
      <svg className="login-google-mark" viewBox="0 0 48 48">
        <path
          fill="#FFC107"
          d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
        />
        <path
          fill="#FF3D00"
          d="M6.3 14.7 12.9 19.6C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.3 35.1 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.5 5.6-6.4 7.1l.1.1 6.3 5.3C37.3 41.3 44 36 44 24c0-1.2-.1-2.3-.4-3.5z"
        />
      </svg>
    </span>
  )
}

function LoginPattern() {
  return (
    <svg className="login-pattern" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="#e4e4e4" strokeWidth="10">
        <rect x="-90" y="-70" width="320" height="320" rx="88" />
        <rect x="70" y="200" width="250" height="250" rx="70" />
        <rect x="-20" y="360" width="300" height="300" rx="82" />
        <rect x="700" y="20" width="280" height="280" rx="78" />
        <rect x="760" y="280" width="210" height="210" rx="58" />
        <rect x="40" y="740" width="250" height="250" rx="70" />
        <rect x="660" y="720" width="300" height="300" rx="84" />
        <rect x="430" y="860" width="180" height="180" rx="50" />
        <rect x="820" y="540" width="220" height="220" rx="62" />
      </g>
    </svg>
  )
}

export function LoginPage() {
  const { signIn, error } = useAuth()

  return (
    <div className="login-screen">
      <LoginPattern />
      <div className="login-panel">
        <div className="login-lockup">
          <SeahLogo />
        </div>
        <h1>SeAH-Lab System</h1>
        <hr className="login-divider" />
        <p>
          회사 Google 계정(@seah.co.kr)으로 로그인해 주세요.
        </p>
        <button className="login-google-btn" type="button" onClick={() => void signIn()}>
          <GoogleMark />
          Google로 로그인
        </button>
        {error ? <p className="login-error">{error}</p> : null}
      </div>
    </div>
  )
}
