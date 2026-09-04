// Shared page chrome and brand atoms for the 5Brains custom report.

import type { CSSProperties, ReactNode } from 'react'

// A4 at 96 dpi
export const PAGE_W = 794
export const PAGE_H = 1123

const TRAJECTAS_LOCKUP = '/reports/5brains/assets/trajectas-lockup.svg'
const TRAJECTAS_LOCKUP_LIGHT = '/reports/5brains/assets/trajectas-lockup-light.svg'

export function A4Page({
  children,
  bg = '#ffffff',
  textColor = 'var(--mk-text)',
}: {
  children: ReactNode
  bg?: string
  textColor?: string
}) {
  return (
    <div
      className="fb-page"
      style={{
        width: PAGE_W,
        height: PAGE_H,
        background: bg,
        color: textColor,
        fontFamily: 'var(--font-sans)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </div>
  )
}

export function Wordmark({
  dark = false,
  size = 14,
  src,
}: {
  dark?: boolean
  size?: number
  src?: string
}) {
  const h = size * 1.7
  const resolved = src ?? (dark ? TRAJECTAS_LOCKUP_LIGHT : TRAJECTAS_LOCKUP)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={resolved} alt="Trajectas" style={{ height: h, width: 'auto', display: 'block' }} />
  )
}

export function ClientLogoSlot({
  dark = false,
  label = 'CLIENT LOGO',
  width = 140,
  src,
  placeholder = false,
}: {
  dark?: boolean
  label?: string
  width?: number
  src?: string
  /** Show a dashed placeholder when no logo is configured. Off by default — production prefers an empty slot. */
  placeholder?: boolean
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={label}
        style={{ height: 30, width: 'auto', display: 'block', objectFit: 'contain' }}
      />
    )
  }
  if (!placeholder) return null
  return (
    <div
      style={{
        width,
        height: 32,
        border: `1px dashed ${dark ? 'rgba(255,255,255,0.30)' : 'rgba(20,15,10,0.20)'}`,
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        letterSpacing: '0.14em',
        color: dark ? 'rgba(255,255,255,0.45)' : 'rgba(20,15,10,0.35)',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </div>
  )
}

export function Eyebrow({
  children,
  color = 'var(--mk-accent)',
  size = 10,
}: {
  children: ReactNode
  color?: string
  size?: number
}) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: size,
        fontWeight: 500,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color,
      }}
    >
      {children}
    </div>
  )
}

export function PageHeader({
  pageNum,
  totalPages = 9,
  sectionLabel,
  primaryLogoUrl,
}: {
  pageNum: number
  totalPages?: number
  sectionLabel: string
  primaryLogoUrl?: string
}) {
  return (
    <div
      style={{
        padding: '32px 56px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(20,15,10,0.08)',
      }}
    >
      <Wordmark size={13} src={primaryLogoUrl} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <Eyebrow color="var(--mk-primary)" size={9}>
          {sectionLabel}
        </Eyebrow>
        <Eyebrow color="var(--mk-accent)" size={9}>
          {String(pageNum).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
        </Eyebrow>
      </div>
    </div>
  )
}

export function PageFooter({
  pageNum,
  totalPages = 9,
  participantName,
}: {
  pageNum: number
  totalPages?: number
  participantName: string
}) {
  return (
    <div
      style={{
        marginTop: 'auto',
        padding: '18px 56px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: '1px solid rgba(20,15,10,0.08)',
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
      }}
    >
      <span style={{ color: 'var(--mk-primary)', fontWeight: 500 }}>
        Confidential · 5Brains capability assessment · {participantName}
      </span>
      <span style={{ color: 'var(--mk-accent)', fontWeight: 600 }}>
        {String(pageNum).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
      </span>
    </div>
  )
}

/** Trademark mark — sized relative to surrounding text. */
export function TM({ size = 0.5, weight = 600 }: { size?: number; weight?: number }) {
  return (
    <sup
      style={{
        fontSize: `${size}em`,
        fontWeight: weight,
        position: 'relative',
        top: '-0.6em',
        marginLeft: '0.06em',
        letterSpacing: '0',
      }}
    >
      ™
    </sup>
  )
}

/** "5Brains" framework wordmark with trademark symbol. */
export function FiveBrains({ tmSize = 0.5 }: { tmSize?: number }) {
  return (
    <>
      5Brains
      <TM size={tmSize} />
    </>
  )
}

export function FootMeta({
  label,
  value,
  dark = false,
}: {
  label: string
  value: ReactNode
  dark?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: dark ? 'rgba(255,255,255,0.45)' : 'rgba(20,15,10,0.45)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: dark ? 'rgba(255,255,255,0.85)' : 'rgba(20,15,10,0.80)',
        }}
      >
        {value}
      </span>
    </div>
  )
}

export type CSSObject = CSSProperties
