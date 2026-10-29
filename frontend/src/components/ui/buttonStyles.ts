type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger'
type ButtonSize = 'default' | 'icon' | 'upload'

export type ButtonStyleOptions = {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

const variants: Record<ButtonVariant, string> = {
  default: 'border-[#d8e1dd] bg-white text-[#314951] enabled:hover:border-[#aebfb6] enabled:hover:bg-[#f0f5f2]',
  primary: 'border-accent bg-accent text-white shadow-[0_1px_2px_#123b2020] [&:not(:disabled):not([aria-disabled=true]):hover]:border-[#125546] [&:not(:disabled):not([aria-disabled=true]):hover]:bg-[#125546]',
  ghost: 'border-transparent bg-transparent text-[#314951] enabled:hover:border-[#aebfb6] enabled:hover:bg-[#f0f5f2]',
  danger: 'border-[#d8e1dd] bg-white text-[#a13e3e] enabled:hover:border-[#aebfb6] enabled:hover:bg-[#f0f5f2]',
}

const sizes: Record<ButtonSize, string> = {
  default: 'min-h-[34px] px-[11px] py-[7px]',
  icon: 'min-h-[34px] w-8 min-w-8 p-[7px]',
  upload: 'min-h-[37px] px-[18px] py-[7px]',
}

export function buttonStyles({
  variant = 'default', size = 'default', className = '',
}: ButtonStyleOptions = {}) {
  return `inline-flex cursor-pointer items-center justify-center gap-[7px] rounded-md border text-[12px] leading-[1.3] font-[550] whitespace-nowrap no-underline transition-[background,border-color] duration-[120ms] disabled:cursor-default disabled:opacity-[.42] disabled:shadow-none aria-disabled:cursor-default aria-disabled:opacity-[.42] aria-disabled:shadow-none aria-pressed:border-[#aac9ba] aria-pressed:bg-[#e8f0ed] aria-pressed:text-[#145b49] motion-reduce:transition-none ${variants[variant]} ${sizes[size]} ${className}`
}
