const paths = {
  door: 'M5 21V3h14v18M9 21V6l7-2v17M12 13h.01M3 21h18',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M8 13h8M8 17h5',
  cursor: 'm4 3 7 18 2-8 8-2Z',
  add: 'M12 5v14M5 12h14',
  merge: 'M4 4h7v7H4ZM13 13h7v7h-7ZM14 4h6v6M4 14v6h6',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  undo: 'M9 4 4 9l5 5M4 9h10a6 6 0 0 1 0 12',
  check: 'm5 12 4 4L19 6',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2ZM7 3v6h10V3M7 21v-8h10v8',
  refresh: 'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2',
  close: 'm6 6 12 12M6 18 18 6',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  detect: 'm13 2-9 12h7l-1 8L20 9h-7Z',
  layers: 'm12 3 10 5-10 5L2 8ZM2 12l10 5 10-5M2 16l10 5 10-5',
  fit: 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M8 8h8v8H8Z',
  minus: 'M5 12h14',
} as const

export function Icon({ name, size = 18 }: { name: keyof typeof paths; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
