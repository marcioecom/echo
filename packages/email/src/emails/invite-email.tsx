import * as React from "react"
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "react-email"

export interface InviteEmailProps {
  inviterName: string
  organizationName: string
  inviteUrl: string
}

export function InviteEmail({
  inviterName = "Jane Doe",
  organizationName = "Acme",
  inviteUrl = "https://example.com/accept-invitation/01",
}: InviteEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        {inviterName} invited you to {organizationName} on Echo
      </Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "sans-serif" }}>
        <Container
          style={{
            margin: "0 auto",
            maxWidth: "560px",
            padding: "32px 24px",
          }}
        >
          <Heading as="h1" style={{ fontSize: "22px", fontWeight: 600 }}>
            Join {organizationName} on Echo
          </Heading>
          <Text style={{ fontSize: "14px", lineHeight: "22px" }}>
            {inviterName} invited you to join <strong>{organizationName}</strong>.
            Click the button below to accept the invitation and start working
            with the team.
          </Text>
          <Section style={{ margin: "32px 0", textAlign: "center" }}>
            <Button
              href={inviteUrl}
              style={{
                backgroundColor: "#111111",
                borderRadius: "6px",
                color: "#ffffff",
                fontSize: "14px",
                padding: "12px 24px",
                textDecoration: "none",
              }}
            >
              Accept invitation
            </Button>
          </Section>
          <Text
            style={{
              color: "#666666",
              fontSize: "12px",
              lineHeight: "18px",
              wordBreak: "break-all",
            }}
          >
            If the button does not work, open this link:{" "}
            <Link href={inviteUrl}>{inviteUrl}</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default InviteEmail
