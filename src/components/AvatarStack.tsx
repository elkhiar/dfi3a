type AvatarStackProps = {
  count: number
}

const avatarColors = ['bg-amber-200', 'bg-sky-200', 'bg-emerald-200']

export function AvatarStack({ count }: AvatarStackProps) {
  return (
    <div className="flex items-center" aria-label={`${count} participants visibles`}>
      {avatarColors.map((color, index) => (
        <span
          aria-hidden="true"
          className={`grid size-5 place-items-center rounded-full border-2 border-white text-[7px] font-bold text-slate-700 ${color} ${index > 0 ? '-ml-1.5' : ''}`}
          key={color}
        >
          {String.fromCharCode(65 + index)}
        </span>
      ))}
      {count > 3 && (
        <span className="ml-1 text-[9px] font-semibold text-white">+{count - 3}</span>
      )}
    </div>
  )
}
