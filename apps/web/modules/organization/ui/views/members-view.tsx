"use client"

import { UserAdd01Icon, UserMultiple02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
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
import { cn } from "@workspace/ui/lib/utils"
import { useRef, useState } from "react"

import { t, type MessageKey } from "@/lib/i18n"
import { TranslatedFormMessage } from "@/lib/i18n-form"
import { useInviteMemberForm } from "@/modules/organization/hooks/use-invite-member-form"
import { useMembers } from "@/modules/organization/hooks/use-members"
import { memberRoleLabel } from "@/modules/organization/role-label"
import { PageHeader } from "@/modules/shell/ui/page-header"

const roleHintKeys = {
  owner: "members.roleHint.owner",
  admin: "members.roleHint.admin",
  operator: "members.roleHint.operator",
} as const satisfies Record<(typeof organizationRoleNames)[number], MessageKey>

export function MembersView({
  currentRole,
  organizationName,
}: {
  currentRole: string
  organizationName: string
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const emailInputRef = useRef<HTMLInputElement | null>(null)
  const inviteSectionRef = useRef<HTMLElement | null>(null)
  const { members, pendingInvitations, manageable, cancelInvitationMutation } =
    useMembers(currentRole)
  const { form, inviteMutation } = useInviteMemberForm()
  const soloTeam =
    manageable && members.length === 1 && pendingInvitations.length === 0
  const selectedRole = form.watch("role")

  function focusInvite() {
    inviteSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
    window.requestAnimationFrame(() => {
      emailInputRef.current?.focus()
    })
  }

  async function copyInviteLink(invitationId: string) {
    const link = `${window.location.origin}/accept-invitation/${invitationId}`
    await navigator.clipboard.writeText(link)
    setCopiedId(invitationId)
    setTimeout(() => setCopiedId(null), 2_000)
  }

  return (
    <>
      <PageHeader
        actions={
          manageable ? (
            <Button
              data-icon="inline-start"
              onClick={focusInvite}
              type="button"
            >
              <HugeiconsIcon icon={UserAdd01Icon} size={16} strokeWidth={1.8} />
              {t("members.inviteAction")}
            </Button>
          ) : null
        }
        description={t("members.description", { name: organizationName })}
        title={t("members.title")}
      />
      <div className="space-y-8">
        {soloTeam ? (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-border px-6 py-10 text-center">
            <div className="mb-3 flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <HugeiconsIcon
                icon={UserMultiple02Icon}
                size={18}
                strokeWidth={1.8}
              />
            </div>
            <p className="text-sm font-medium">{t("members.soloTitle")}</p>
            <p className="mt-1 max-w-md text-sm text-pretty text-muted-foreground">
              {t("members.soloBody")}
            </p>
            <Button className="mt-4" onClick={focusInvite} type="button">
              {t("members.soloCta")}
            </Button>
          </div>
        ) : null}

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
          <section
            className="space-y-4"
            id="invite-member"
            ref={inviteSectionRef}
          >
            <h2 className="text-sm font-medium">{t("members.inviteTitle")}</h2>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) =>
                  inviteMutation.mutate(values)
                )}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("members.email")}</FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input
                            type="email"
                            {...field}
                            ref={(node) => {
                              field.ref(node)
                              emailInputRef.current = node
                            }}
                          />
                        </FormControl>
                        <Button
                          type="submit"
                          disabled={inviteMutation.isPending}
                        >
                          {inviteMutation.isPending
                            ? t("members.inviting")
                            : t("members.invite")}
                        </Button>
                      </div>
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
                      <FormControl>
                        <div
                          aria-label={t("members.role")}
                          className="flex flex-wrap gap-1.5"
                          role="radiogroup"
                        >
                          {organizationRoleNames.map((roleName) => {
                            const selected = field.value === roleName
                            return (
                              <button
                                aria-checked={selected}
                                className={cn(
                                  "h-8 rounded-md border px-2.5 text-xs transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                                  selected
                                    ? "border-primary bg-primary/10 font-medium text-foreground"
                                    : "bg-background text-muted-foreground hover:bg-accent"
                                )}
                                key={roleName}
                                onClick={() => field.onChange(roleName)}
                                role="radio"
                                type="button"
                              >
                                {memberRoleLabel(roleName)}
                              </button>
                            )
                          })}
                        </div>
                      </FormControl>
                      <p className="text-xs text-pretty text-muted-foreground">
                        {t(roleHintKeys[selectedRole])}
                      </p>
                      <TranslatedFormMessage />
                    </FormItem>
                  )}
                />
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
                  className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{invitation.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {memberRoleLabel(invitation.role)}
                      {" · "}
                      {t("members.pendingWaiting")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => copyInviteLink(invitation.id)}
                      type="button"
                      variant="outline"
                    >
                      {copiedId === invitation.id
                        ? t("members.copied")
                        : t("members.copyLink")}
                    </Button>
                    <Button
                      disabled={cancelInvitationMutation.isPending}
                      onClick={() =>
                        cancelInvitationMutation.mutate(invitation.id)
                      }
                      type="button"
                      variant="ghost"
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
