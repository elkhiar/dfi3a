type DBuxIconProps = {
  className?: string
}

type DBuxAmountProps = {
  amount: number | string
  className?: string
  iconClassName?: string
}

export function DBuxIcon({ className = 'h-4 w-auto' }: DBuxIconProps) {
  return <img aria-hidden="true" className={className} src="/d-bux.png" />
}

export function DBuxAmount({ amount, className = '', iconClassName = 'h-4 w-auto' }: DBuxAmountProps) {
  return (
    <span aria-label={`${amount} D-bux`} className={`inline-flex items-center gap-1 ${className}`}>
      <DBuxIcon className={iconClassName} />
      <span aria-hidden="true">{amount}</span>
    </span>
  )
}
