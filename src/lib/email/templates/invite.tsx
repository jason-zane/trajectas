import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
  Button,
  Hr,
} from '@react-email/components'

interface InviteEmailProps {
  participantFirstName?: string
  campaignTitle: string
  campaignDescription?: string
  assessmentUrl: string
  brandName?: string
  brandLogoUrl?: string
  primaryColor?: string
  textColor?: string
  footerTextColor?: string
}

export function InviteEmail({
  participantFirstName,
  campaignTitle,
  campaignDescription,
  assessmentUrl,
  brandName = 'Trajectas',
  brandLogoUrl,
  primaryColor = '#2d6a5a',
  textColor = '#1a1a1a',
  footerTextColor = '#6b7280',
}: InviteEmailProps) {
  const greeting = participantFirstName
    ? `Hi ${participantFirstName},`
    : 'Hello,'

  return (
    <Html>
      <Head />
      <Preview>
        You&apos;ve been invited to complete an assessment — {campaignTitle}
      </Preview>
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
            {brandLogoUrl && (
              <Img
                src={brandLogoUrl}
                alt={brandName}
                height={32}
                style={{ marginBottom: '24px' }}
              />
            )}

            <Heading
              style={{
                fontSize: '22px',
                fontWeight: 600,
                color: textColor,
                marginBottom: '16px',
              }}
            >
              {greeting}
            </Heading>

            <Text
              style={{
                fontSize: '15px',
                lineHeight: '24px',
                color: textColor,
              }}
            >
              You&apos;ve been invited to complete an assessment as part of{' '}
              <strong>{campaignTitle}</strong>.
            </Text>

            {campaignDescription && (
              <Text
                style={{
                  fontSize: '14px',
                  lineHeight: '22px',
                  color: footerTextColor,
                }}
              >
                {campaignDescription}
              </Text>
            )}

            <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
              <Button
                href={assessmentUrl}
                style={{
                  backgroundColor: primaryColor,
                  color: '#ffffff',
                  padding: '12px 32px',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Begin Assessment
              </Button>
            </Section>

            <Hr style={{ borderColor: '#e5e7eb', margin: '24px 0' }} />

            <Text
              style={{
                fontSize: '12px',
                color: footerTextColor,
                textAlign: 'center' as const,
              }}
            >
              {brandName !== 'Trajectas'
                ? `Powered by Trajectas`
                : 'Trajectas'}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
