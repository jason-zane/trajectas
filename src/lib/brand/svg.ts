import { WORDMARK_PATH, WORDMARK_WIDTH } from './wordmark-path'

/** Font-independent artwork for HTML-to-PDF and social images outside React. */
export function trajectasSvg({ variant = 'wordmark', height = 32, light = false }: {
  variant?: 'wordmark' | 'horizontal'
  height?: number
  light?: boolean
} = {}): string {
  const ink = light ? '#ffffff' : '#1a1a1a'
  const primary = light ? '#ffffff' : '#2d6a5a'
  const x = variant === 'horizontal' ? 49 : 0
  const width = WORDMARK_WIDTH + x
  const mark = variant === 'horizontal'
    ? '<g transform="scale(.625)"><rect x="9" y="46" width="7" height="10" rx="3.5" fill="' + primary + '"/><rect x="22" y="36" width="7" height="20" rx="3.5" fill="' + primary + '"/><rect x="35" y="24" width="7" height="32" rx="3.5" fill="' + primary + '"/><rect x="48" y="10" width="7" height="46" rx="3.5" fill="#c9a962"/></g>'
    : ''
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' 40" width="' + width / 40 * height + '" height="' + height + '" role="img" aria-label="Trajectas"><title>trajectas</title>' + mark + '<path d="' + WORDMARK_PATH + '" transform="translate(' + x + ' 29) scale(.034 -.034)" fill="' + ink + '"/></svg>'
}
