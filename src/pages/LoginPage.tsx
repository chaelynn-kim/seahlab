import { Lightbulb } from 'lucide-react'
import { SeahLogo } from '../components/brand/SeahLogo'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { signIn, error } = useAuth()

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <SeahLogo />
          <strong>SeAH-Lab</strong>
        </div>
        <h1>시험검사반 기록 시스템</h1>
        <p>일상 점검과 화학물질 대장은 구글 계정으로 로그인한 뒤 저장됩니다.</p>
        <button className="primary-btn login-btn" type="button" onClick={() => void signIn()}>
          SeAH 구글 계정으로 로그인
        </button>
        {error ? <p className="login-error">{error}</p> : null}
        <p className="login-hint">
          <Lightbulb size={14} />
          @seah.co.kr 계정만 사용할 수 있습니다.
        </p>
      </div>
    </div>
  )
}
