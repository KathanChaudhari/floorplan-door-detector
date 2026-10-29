import type { ButtonHTMLAttributes } from 'react'
import { buttonStyles } from './buttonStyles.ts'
import type { ButtonStyleOptions } from './buttonStyles.ts'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyleOptions

export function Button({ variant, size, className, children, ...props }: Props) {
  return <button type="button" className={buttonStyles({ variant, size, className })} {...props}>{children}</button>
}
