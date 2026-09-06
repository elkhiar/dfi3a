type DBuxIconProps = {
  className?: string
}

type DBuxAmountProps = {
  amount: number | string
  className?: string
  iconClassName?: string
}

export function DBuxIcon({ className = 'h-4 w-auto' }: DBuxIconProps) {
  return (
    <img
      aria-hidden="true"
      className={`block shrink-0 object-contain ${className}`}
      decoding="async"
      draggable="false"
      height="91"
      src="/d-bux.png"
      width="64"
    />
  )
}

export function DBuxAmount({ amount, className = '', iconClassName = 'h-4 w-auto' }: DBuxAmountProps) {
  return (
    <span aria-label={`${amount} D-bux`} className={`inline-flex items-center gap-1 leading-none ${className}`}>
      <DBuxIcon className={iconClassName} />
      <span aria-hidden="true" className="inline-flex items-center leading-none">{amount}</span>
    </span>
  )
}
