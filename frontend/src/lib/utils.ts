import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * The class-name helper every shadcn component imports.
 *
 * clsx flattens conditionals and arrays; tailwind-merge then resolves conflicts
 * so a later utility wins over an earlier one in the SAME group — `cn('p-2',
 * 'p-4')` is `p-4`, not both. Without the merge step, overriding a component's
 * default padding from a `className` prop is a coin flip decided by CSS source
 * order rather than by the call site.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
