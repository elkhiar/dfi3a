type DBuxIconProps = {
  className?: string
}

export function DBuxIcon({ className = 'h-4 w-auto' }: DBuxIconProps) {
  return <img aria-hidden="true" className={className} src="/d-bux.png" />
}
