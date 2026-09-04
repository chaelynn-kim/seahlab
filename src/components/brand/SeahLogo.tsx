interface SeahLogoProps {
  className?: string
}

export function SeahLogo({ className = '' }: SeahLogoProps) {
  return (
    <span className={`seah-logo ${className}`.trim()} aria-label="SeAH Coated Metal">
      <span className="seah-logo-word">
        S
        <span className="seah-logo-e">
          <svg className="seah-logo-chevron" viewBox="0 0 12 7" aria-hidden="true">
            <path d="M1.1 1.15 L6 6.05 L10.9 1.15" />
          </svg>
          e
        </span>
        AH
      </span>
      <span className="seah-logo-rest">Coated Metal</span>
    </span>
  )
}
