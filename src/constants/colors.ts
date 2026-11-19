export const colors = {
  primary: '#14263D',
  primaryPressed: '#0E1B2C',
  accent: '#C4A35A',
  accentSubtle: '#F7F1E4',
  background: '#F5F6F8',
  surface: '#FFFFFF',
  text: '#202B3C',
  muted: '#667085',
  border: '#E1E5EB',
  success: '#218653',
  successSubtle: '#E8F5ED',
  error: '#C53D42',
  errorSubtle: '#FCEBEC',
  warning: '#A56316',
  disabled: '#A9B1BC',
  overlay: 'rgba(12, 22, 36, 0.52)',
} as const;

export type ColorName = keyof typeof colors;
