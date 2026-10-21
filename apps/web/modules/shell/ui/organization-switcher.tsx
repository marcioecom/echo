"use client"

import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  Loading03Icon,
  PlusSignIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"
import { useEffect, useRef, useState } from "react"

import { t } from "@/lib/i18n"
import { TranslatedFormMessage } from "@/lib/i18n-form"
import { useCreateOrganizationForm } from "@/modules/organization/hooks/use-create-organization-form"
import { SlugAvailabilityStatus } from "@/modules/organization/ui/components/slug-availability"
import { useOrganizationSwitcher } from "@/modules/shell/hooks/use-organization-switcher"

type OrganizationSwitcherProps = {
  activeOrganizationId: string
  activeOrganizationName: string
  side?: "bottom" | "right"
}

type SwitcherView = "list" | "create"

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export function OrganizationSwitcher({
  activeOrganizationId,
  activeOrganizationName,
  side = "right",
}: OrganizationSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<SwitcherView>("list")
  const createActionRef = useRef<HTMLButtonElement>(null)
  const focusCreateActionRef = useRef(false)

  useEffect(() => {
    if (view !== "list" || !focusCreateActionRef.current) return
    focusCreateActionRef.current = false
    createActionRef.current?.focus()
  }, [view])

  const {
    organizations,
    isError,
    isLoading,
    isSwitching,
    switchingOrganizationId,
    refetch,
    switchOrganization,
    organizationCreated,
  } = useOrganizationSwitcher(activeOrganizationId)

  const { form, onSubmit, slug, availability, markSlugTouched, resetForm } =
    useCreateOrganizationForm({
      onCreated: async (organization) => {
        setOpen(false)
        await organizationCreated(organization)
      },
    })

  const isCreating = form.formState.isSubmitting

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) setView("list")
  }

  async function handleOrganizationSelect(organizationId: string) {
    const switched = await switchOrganization(organizationId)
    if (switched) setOpen(false)
  }

  function handleCreate() {
    resetForm()
    setView("create")
  }

  function handleBackToList() {
    focusCreateActionRef.current = true
    setView("list")
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("shell.switchLabel", { name: activeOrganizationName })}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-1 py-1 text-left text-sm font-semibold tracking-tight transition-colors duration-150 outline-none hover:bg-sidebar-accent focus-visible:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring/30 aria-expanded:bg-sidebar-accent"
        >
          <span className="truncate">{activeOrganizationName}</span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={14}
            strokeWidth={1.8}
            aria-hidden
            className="shrink-0 text-muted-foreground"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="start"
        sideOffset={8}
        collisionPadding={8}
        aria-label={
          view === "list"
            ? t("shell.organizations")
            : t("shell.newOrganization")
        }
        className="z-(--z-modal) gap-0.5 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none"
      >
        {view === "list" ? (
          <>
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              {t("shell.organizations")}
            </p>
            {isLoading ? (
              <div
                className="space-y-1 p-1"
                role="status"
                aria-label={t("shell.loadingOrganizations")}
              >
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    className="h-10 animate-pulse rounded-md bg-muted"
                  />
                ))}
              </div>
            ) : isError ? (
              <div className="space-y-2 px-2 py-3">
                <p className="text-xs text-muted-foreground">
                  {t("shell.organizationsError")}
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="rounded-sm text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  {t("shell.tryAgain")}
                </button>
              </div>
            ) : organizations.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                {t("shell.organizationsEmpty")}
              </p>
            ) : (
              <ul
                aria-label={t("shell.organizations")}
                className="max-h-72 space-y-0.5 overflow-y-auto"
              >
                {organizations.map((organization) => {
                  const active = organization.id === activeOrganizationId
                  const switching = switchingOrganizationId === organization.id
                  return (
                    <li key={organization.id}>
                      <button
                        type="button"
                        aria-current={active ? "true" : undefined}
                        disabled={active || isSwitching}
                        onClick={() =>
                          handleOrganizationSelect(organization.id)
                        }
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-150 outline-none",
                          active
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/30",
                          "disabled:pointer-events-none"
                        )}
                      >
                        <span
                          aria-hidden
                          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary"
                        >
                          {initials(organization.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium">
                            {organization.name}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {organization.slug}
                          </span>
                        </span>
                        {switching ? (
                          <HugeiconsIcon
                            icon={Loading03Icon}
                            size={14}
                            strokeWidth={1.8}
                            aria-hidden
                            className="animate-spin text-muted-foreground motion-reduce:animate-none"
                          />
                        ) : active ? (
                          <HugeiconsIcon
                            icon={Tick02Icon}
                            size={14}
                            strokeWidth={2}
                            aria-hidden
                            className="text-primary"
                          />
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <div role="separator" className="-mx-1 my-1 h-px bg-border/50" />

            <button
              ref={createActionRef}
              type="button"
              onClick={handleCreate}
              className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors duration-150 outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground transition-colors duration-150 group-hover:border-accent-foreground/30 group-hover:text-accent-foreground"
              >
                <HugeiconsIcon
                  icon={PlusSignIcon}
                  size={13}
                  strokeWidth={1.8}
                />
              </span>
              {t("shell.createOrganization")}
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1 px-1 pt-0.5 pb-1">
              <button
                type="button"
                onClick={handleBackToList}
                aria-label={t("shell.backToOrganizations")}
                className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-150 outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <HugeiconsIcon
                  icon={ArrowLeft01Icon}
                  size={14}
                  strokeWidth={1.8}
                  aria-hidden
                />
              </button>
              <p className="text-xs font-medium">
                {t("shell.newOrganization")}
              </p>
            </div>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="grid gap-2.5 px-1 pb-1"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="gap-1">
                      <FormLabel>{t("shell.organizationName")}</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="organization"
                          autoFocus
                          placeholder={t("shell.organizationNamePlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <TranslatedFormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem className="gap-1">
                      <FormLabel>{t("shell.organizationSlug")}</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="off"
                          spellCheck={false}
                          placeholder={t("shell.organizationSlugPlaceholder")}
                          className="font-mono"
                          {...field}
                          onChange={(event) => {
                            markSlugTouched()
                            field.onChange(event)
                          }}
                        />
                      </FormControl>
                      {form.formState.errors.slug ? null : (
                        <SlugAvailabilityStatus
                          availability={availability}
                          slug={slug}
                        />
                      )}
                      <TranslatedFormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="mt-0.5 w-full"
                  disabled={isCreating || availability === "taken"}
                >
                  {isCreating ? (
                    <>
                      <HugeiconsIcon
                        icon={Loading03Icon}
                        size={13}
                        strokeWidth={1.8}
                        aria-hidden
                        className="animate-spin motion-reduce:animate-none"
                      />
                      {t("shell.creatingOrganization")}
                    </>
                  ) : (
                    t("shell.createOrganization")
                  )}
                </Button>
              </form>
            </Form>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
