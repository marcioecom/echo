"use client"

import { Button } from "@workspace/ui/components/button"

import { useAcceptInvitation } from "@/modules/organization/hooks/use-accept-invitation"

export function AcceptInvitationView({
  invitationId,
}: {
  invitationId: string
}) {
  const { invitation, isInvalid, acceptMutation } =
    useAcceptInvitation(invitationId)

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="text-lg font-medium">Accept invitation</h1>
          {invitation ? (
            <p className="text-sm text-muted-foreground">
              You were invited to join{" "}
              <strong>{invitation.organizationName}</strong> on Echo.
            </p>
          ) : isInvalid ? (
            <p className="text-sm text-destructive">
              This invitation is invalid or has expired.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Loading invitation details...
            </p>
          )}
        </div>
        <Button
          onClick={() => acceptMutation.mutate()}
          disabled={acceptMutation.isPending || !invitation}
          className="w-full"
        >
          {acceptMutation.isPending ? "Accepting..." : "Accept and continue"}
        </Button>
      </div>
    </div>
  )
}
