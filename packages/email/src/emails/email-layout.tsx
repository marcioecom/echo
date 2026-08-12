import * as React from "react"
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "react-email"

const colors = {
  background: "#ffffff",
  border: "#e1e4e0",
  ink: "#171914",
  muted: "#676a64",
  primary: "#507e00",
  surface: "#ffffff",
}

const fontFamily =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

export interface EmailLayoutProps {
  actionLabel: string
  actionUrl: string
  children: React.ReactNode
  logoUrl: string
  preview: string
  title: string
}

export function EmailLayout({
  actionLabel,
  actionUrl,
  children,
  logoUrl,
  preview,
  title,
}: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: colors.background,
          color: colors.ink,
          fontFamily,
          margin: "0",
          padding: "0",
        }}
      >
        <Container style={{ margin: "0 auto", maxWidth: "600px", padding: "36px 20px" }}>
          <Section style={{ padding: "0 4px 20px" }}>
            <Img alt="Echo" height="32" src={logoUrl} style={{ display: "block", height: "32px", width: "auto" }} />
          </Section>
          <Section
            style={{
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: "10px",
              padding: "32px",
            }}
          >
            <Heading
              as="h1"
              style={{
                color: colors.ink,
                fontSize: "24px",
                fontWeight: 650,
                letterSpacing: "-0.35px",
                lineHeight: "32px",
                margin: "0 0 16px",
              }}
            >
              {title}
            </Heading>
            {children}
            <Section style={{ margin: "28px 0" }}>
              <Button
                href={actionUrl}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: "6px",
                  color: "#ffffff",
                  display: "inline-block",
                  fontSize: "14px",
                  fontWeight: 600,
                  lineHeight: "20px",
                  padding: "11px 16px",
                  textDecoration: "none",
                }}
              >
                {actionLabel}
              </Button>
            </Section>
            <Text
              style={{
                color: colors.muted,
                fontSize: "12px",
                lineHeight: "18px",
                margin: "0",
                wordBreak: "break-word",
              }}
            >
              If the button does not work, copy and paste this link into your browser: <Link href={actionUrl}>{actionUrl}</Link>
            </Text>
          </Section>
          <Text
            style={{
              color: colors.muted,
              fontSize: "12px",
              lineHeight: "18px",
              margin: "18px 4px 0",
            }}
          >
            Echo keeps your customer support conversations in one place.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export function EmailParagraph({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ color: colors.ink, fontSize: "15px", lineHeight: "24px", margin: "0 0 16px" }}>
      {children}
    </Text>
  )
}

export function EmailNotice({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ color: colors.muted, fontSize: "13px", lineHeight: "20px", margin: "0" }}>
      {children}
    </Text>
  )
}
