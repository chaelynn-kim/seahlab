import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { ClipboardCheck, FlaskConical, History, Menu, Settings } from 'lucide-react'
import { SeahLogo } from '../brand/SeahLogo'

const NAV = [
  { to: '/inspection', key: 'inspection', label: '일상 점검', icon: ClipboardCheck },
  { to: '/chemicals', key: 'chemicals', label: '화학물질 대장', icon: FlaskConical },
  { to: '/history', key: 'history', label: '이력 로그', icon: History },
  { to: '/settings', key: 'settings', label: '설정', icon: Settings },
] as const

export function AppLayout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-left">
          <button className="menu-btn" type="button" onClick={() => setOpen((value) => !value)} aria-label="메뉴">
            <Menu size={20} />
          </button>
          <div className="brand">
            <SeahLogo />
            <div className="brand-divider" aria-hidden="true" />
            <strong className="brand-title">시험실 설비·기기 관리 시스템</strong>
          </div>
        </div>
      </header>
      <div className="body">
        <div className={`overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
        <aside className={`sidebar ${open ? 'open' : ''}`}>
          <nav className="nav-list">
            {NAV.map((item) => {
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
        </aside>
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
