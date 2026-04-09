import {
  Body,
  Container,
  Head,
  Html,
  Hr,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export interface BrandFrameProps {
  brandName: string
  brandLogoUrl?: string | null
  primaryColor: string
  textColor: string
  footerTextColor: string
  previewText?: string | null
  bodyHtml: string
}

export function EmailBrandFrame({
  brandName,
  brandLogoUrl,
  primaryColor,
  textColor,
  footerTextColor,
  previewText,
  bodyHtml,
}: BrandFrameProps) {
  return (
    <Html>
      <Head />
      {previewText && <Preview>{previewText}</Preview>}
      <Body
        style={{
          backgroundColor: '#f9fafb',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <Container
          style={{
            maxWidth: '560px',
            margin: '0 auto',
            padding: '40px 20px',
          }}
        >
          <Section
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              padding: '40px 32px',
            }}
          >
            {brandLogoUrl ? (
              <Img
                src={brandLogoUrl}
                alt={brandName}
                height={32}
                style={{ marginBottom: '24px' }}
              />
            ) : (
              <Text
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: primaryColor,
                  margin: '0 0 24px 0',
                }}
              >
                {brandName}
              </Text>
            )}

            <Hr style={{ borderColor: '#e5e7eb', margin: '0 0 24px 0' }} />

            {/*
             * bodyHtml is produced exclusively by our internal Maily renderer
             * (server-side, controlled pipeline). It is never derived from
             * raw user input and does not require client-side sanitisation.
             * nosemgrep: react-dangerously-set-innerhtml
            */}
            <div
              style={{ color: textColor }}
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />

            <Hr style={{ borderColor: '#e5e7eb', margin: '24px 0' }} />

            <Text
              style={{
                fontSize: '12px',
                color: footerTextColor,
                textAlign: 'center' as const,
              }}
            >
              {brandName !== 'Trajectas' ? 'Powered by Trajectas' : 'Trajectas'}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
