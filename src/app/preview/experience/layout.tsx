/**
 * Minimal layout — no dashboard sidebar/header.
 * Inherits root layout (html, body, fonts, theme).
 */
export default function PreviewExperienceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
