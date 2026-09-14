const TICKS = Array.from({ length: 12 }, (_, index) => index)

export function BootPage({
  message = '데이터를 불러오는 중입니다. 잠시만 기다려 주세요.',
}: {
  message?: string
}) {
  return (
    <div className="boot-screen">
      <div className="boot-panel">
        <div className="boot-spinner" aria-hidden="true">
          {TICKS.map((tick) => (
            <span
              key={tick}
              style={{
                transform: `rotate(${tick * 30}deg)`,
                animationDelay: `${tick * -83}ms`,
              }}
            />
          ))}
        </div>
        <p className="boot-message">{message}</p>
      </div>
    </div>
  )
}
