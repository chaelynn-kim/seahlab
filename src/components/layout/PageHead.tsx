import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type PageHeadProps = {
  icon: LucideIcon
  title: string
  description: string
  className?: string
  children?: ReactNode
}

export function PageHead({ icon: Icon, title, description, className, children }: PageHeadProps) {
  return (
    <div className={className ? `page-head ${className}` : 'page-head'}>
      <div className="page-head-copy">
        <span className="page-head-icon" aria-hidden="true">
          <Icon size={20} strokeWidth={2} />
        </span>
        <div className="page-head-text">
          <h1 className="page-title">{title}</h1>
          <p className="page-desc">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}
