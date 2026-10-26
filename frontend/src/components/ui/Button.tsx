import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'ghost' | 'danger' }

export function Button({ variant = 'default', className = '', children, ...props }: Props) {
  return <button type="button" className={`button button--${variant} ${className}`} {...props}>{children}</button>
}
