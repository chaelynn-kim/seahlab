import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { ClipboardCheck, FlaskConical, History, LogOut, Menu, Settings, User } from 'lucide-react'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { SeahLogo } from '../brand/SeahLogo'

const NAV = [
  { to: '/inspection', key: 'inspection', label: '설비 일상 점검', icon: ClipboardCheck },
  { to: '/chemicals', key: 'chemicals', label: '화학물질 관리', icon: FlaskConical },
  { to: '/history', key: 'history', label: '이력 로그', icon: History },
  { to: '/settings', key: 'settings', label: '설정', icon: Settings },
] as const

function ProfileAvatar({ photoURL }: { photoURL?: string }) {
  const [failed, setFailed] = useState(false)
  const showPhoto = Boolean(photoURL) && !failed

  return (
    <span className={`avatar${showPhoto ? ' has-photo' : ''}`} aria-hidden="true">
      {showPhoto ? (
        <img src={photoURL} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        <User size={18} strokeWidth={2.2} />
      )}
    </span>
  )
}

export function AppLayout() {
  const [open, setOpen] = useState(false)
  const { profile, isAdmin, logOut } = useAuth()
  const { cloudError } = useAppData()
  const navItems = NAV.filter((item) => item.key === 'inspection' || item.key === 'chemicals' || isAdmin)

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-brand">
          <button className="menu-btn" type="button" onClick={() => setOpen((value) => !value)} aria-label="메뉴">
            <Menu size={20} />
          </button>
          <SeahLogo onDark />
        </div>
        <div className="brand-divider" aria-hidden="true" />
        <strong className="brand-title">SeAH-Lab System</strong>
        <div className="header-right">
          {cloudError ? <span className="cloud-error">{cloudError}</span> : null}
          {profile ? (
            <div className="user-chip">
              <ProfileAvatar key={profile.photoURL ?? profile.email} photoURL={profile.photoURL} />
              <span>
                <strong className="name">{profile.name}</strong>
                <span className="meta">{profile.email}</span>
              </span>
            </div>
          ) : null}
          <button className="ghost-btn" type="button" aria-label="로그아웃" onClick={() => void logOut()}>
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <div className="body">
        <div className={`overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
        <aside className={`sidebar ${open ? 'open' : ''}`}>
          <p className="nav-kicker">MENU</p>
          <nav className="nav-list">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.key}
                  to={item.to}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={18} />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>
          <div className="sidebar-contact">
            <span className="avatar" aria-hidden="true">
              <User size={18} strokeWidth={2.2} />
            </span>
            <span className="sidebar-contact-copy">
              <strong className="name">시스템 문의</strong>
              <span className="meta">품질경영팀 · 김채린</span>
              <span className="meta">chaelynn.kim@seah.co.kr</span>
            </span>
          </div>
        </aside>
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
