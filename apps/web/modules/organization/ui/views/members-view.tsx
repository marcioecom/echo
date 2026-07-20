"use client"

import { organizationRoleNames } from "@workspace/auth"
import { Button } from "@workspace/ui/components/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { useState } from "react"

import { useInviteMemberForm } from "@/modules/organization/hooks/use-invite-member-form"
import { useMembers } from "@/modules/organization/hooks/use-members"

export function MembersView({ currentRole }: { currentRole: string }) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const { members, pendingInvitations, manageable, cancelInvitationMutation } =
    useMembers(currentRole)
  const { form, inviteMutation } = useInviteMemberForm()

  async function copyInviteLink(invitationId: string) {
    const link = `${window.location.origin}/accept-invitation/${invitationId}`
    await navigator.clipboard.writeText(link)
    setCopiedId(invitationId)
    setTimeout(() => setCopiedId(null), 2_000)
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-medium">Members</h2>
        <ul className="divide-y rounded-md border">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{member.user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {member.user.email}
                </p>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {member.role}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {manageable ? (
        <section className="space-y-4">
          <h2 className="text-sm font-medium">Invite a member</h2>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) =>
                inviteMutation.mutate(values),
              )}
              className="flex items-start gap-2"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <select
                        className="h-7 rounded-md border border-input bg-transparent px-2 text-sm"
                        {...field}
                      >
                        {organizationRoleNames.map((roleName) => (
                          <option key={roleName} value={roleName}>
                            {roleName}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={inviteMutation.isPending}
                className="mt-6"
              >
                {inviteMutation.isPending ? "Inviting..." : "Invite"}
              </Button>
            </form>
          </Form>
        </section>
      ) : null}

      {manageable && pendingInvitations.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-sm font-medium">Pending invitations</h2>
          <ul className="divide-y rounded-md border">
            {pendingInvitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{invitation.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {invitation.role}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => copyInviteLink(invitation.id)}
                  >
                    {copiedId === invitation.id ? "Copied" : "Copy link"}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={cancelInvitationMutation.isPending}
                    onClick={() =>
                      cancelInvitationMutation.mutate(invitation.id)
                    }
                  >
                    Cancel
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
