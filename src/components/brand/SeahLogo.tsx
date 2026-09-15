import logoOnLight from '../../assets/seah-cm.png'
import logoOnDark from '../../assets/seah-cm-on-dark.png'

interface SeahLogoProps {
  className?: string
  onDark?: boolean
}

export function SeahLogo({ className = '', onDark = false }: SeahLogoProps) {
  return (
    <img
      className={`seah-logo ${className}`.trim()}
      src={onDark ? logoOnDark : logoOnLight}
      alt="SeAH 세아씨엠"
    />
  )
}
