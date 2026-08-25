type PagePlaceholderProps = {
  description: string
  title: string
}

export function PagePlaceholder({ description, title }: PagePlaceholderProps) {
  return (
    <section>
      <p className="mb-1 text-sm font-medium text-sky-700">dfi3a</p>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600">
        {description}
      </p>
    </section>
  )
}
