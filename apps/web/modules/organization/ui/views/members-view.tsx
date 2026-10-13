"use client"

import { organizationRoleNames } from "@workspace/auth"
import { Button } from "@workspace/ui/components/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useState } from "react"

import { t } from "@/lib/i18n"
import { TranslatedFormMessage } from "@/lib/i18n-form"
import { useInviteMemberForm } from "@/modules/organization/hooks/use-invite-member-form"
import { useMembers } from "@/modules/organization/hooks/use-members"
import { memberRoleLabel } from "@/modules/organization/role-label"
import { PageHeader } from "@/modules/shell/ui/page-header"

export function MembersView({
  currentRole,
  organizationName,
}: {
  currentRole: string
  organizationName: string
}) {
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
    <>
      <PageHeader
        title={t("members.title")}
        description={t("members.description", { name: organizationName })}
      />
      <div className="space-y-8">
        <section>
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
                  {memberRoleLabel(member.role)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {manageable ? (
          <section className="space-y-4">
            <h2 className="text-sm font-medium">{t("members.inviteTitle")}</h2>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) =>
                  inviteMutation.mutate(values)
                )}
                className="flex items-start gap-2"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>{t("members.email")}</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <TranslatedFormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("members.role")}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {organizationRoleNames.map((roleName) => (
                            <SelectItem key={roleName} value={roleName}>
                              {memberRoleLabel(roleName)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <TranslatedFormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={inviteMutation.isPending}
                  className="mt-6"
                >
                  {inviteMutation.isPending
                    ? t("members.inviting")
                    : t("members.invite")}
                </Button>
              </form>
            </Form>
          </section>
        ) : null}

        {manageable && pendingInvitations.length > 0 ? (
          <section className="space-y-4">
            <h2 className="text-sm font-medium">{t("members.pendingTitle")}</h2>
            <ul className="divide-y rounded-md border">
              {pendingInvitations.map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{invitation.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {memberRoleLabel(invitation.role)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => copyInviteLink(invitation.id)}
                    >
                      {copiedId === invitation.id
                        ? t("members.copied")
                        : t("members.copyLink")}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={cancelInvitationMutation.isPending}
                      onClick={() =>
                        cancelInvitationMutation.mutate(invitation.id)
                      }
                    >
                      {t("members.cancel")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  )
}
