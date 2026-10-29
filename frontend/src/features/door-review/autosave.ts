export const AUTOSAVE_DELAY = 600

export function scheduleAutosave(save: () => void, canSave: () => boolean) {
  const timer = setTimeout(() => { if (canSave()) save() }, AUTOSAVE_DELAY)
  return () => clearTimeout(timer)
}
