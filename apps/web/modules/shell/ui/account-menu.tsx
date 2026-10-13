"use client"

import {
  Logout01Icon,
  MoreHorizontalIcon,
  Settings01Icon,
  TranslateIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "@tanstack/react-router"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"

import { appLocale, t } from "@/lib/i18n"
import { useSignOut } from "@/modules/auth/hooks/use-sign-out"
import {
  persistLanguageChoice,
  type LanguageChoice,
} from "@/modules/marketing/i18n/negotiation"
import { memberRoleLabel } from "@/modules/organization/role-label"

const languages = [
  { choice: "en", label: "shell.languageEnglish" },
  { choice: "pt-br", label: "shell.languagePortuguese" },
] as const satisfies ReadonlyArray<{
  choice: LanguageChoice
  label: "shell.languageEnglish" | "shell.languagePortuguese"
}>

type AccountMenuProps = {
  userName: string
  userEmail: string
  userRole: string
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export function AccountMenu({
  userName,
  userEmail,
  userRole,
}: AccountMenuProps) {
  const signOut = useSignOut()
  const currentChoice: LanguageChoice = appLocale() === "pt-BR" ? "pt-br" : "en"
  const currentLabel =
    currentChoice === "pt-br"
      ? t("shell.languagePortuguese")
      : t("shell.languageEnglish")

  function selectLanguage(choice: string) {
    if (choice !== "en" && choice !== "pt-br") return
    if (choice === currentChoice) return
    persistLanguageChoice(choice)
    window.location.reload()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "group flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors duration-150 outline-none",
            "hover:bg-sidebar-accent focus-visible:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring/30",
            "aria-expanded:bg-sidebar-accent"
          )}
        >
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary"
          >
            {initials(userName)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium">
              {userName}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {memberRoleLabel(userRole)}
            </span>
          </span>
          <HugeiconsIcon
            icon={MoreHorizontalIcon}
            strokeWidth={2}
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground/50 transition-colors duration-150 group-hover:text-muted-foreground group-focus-visible:text-muted-foreground group-aria-expanded:text-muted-foreground"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={8}
        collisionPadding={8}
        className="z-(--z-modal)"
      >
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium text-popover-foreground">
            {userName}
          </span>
          <span className="block truncate text-muted-foreground">
            {userEmail}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings/members">
            <HugeiconsIcon
              icon={Settings01Icon}
              strokeWidth={1.8}
              aria-hidden
            />
            {t("shell.settings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <HugeiconsIcon icon={TranslateIcon} strokeWidth={1.8} aria-hidden />
            <span className="flex-1">{t("shell.language")}</span>
            <span className="text-muted-foreground">{currentLabel}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="z-(--z-modal) min-w-40">
            <DropdownMenuRadioGroup
              aria-label={t("shell.language")}
              value={currentChoice}
              onValueChange={selectLanguage}
            >
              {languages.map((language) => (
                <DropdownMenuRadioItem
                  key={language.choice}
                  value={language.choice}
                >
                  {t(language.label)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <HugeiconsIcon icon={Logout01Icon} strokeWidth={1.8} aria-hidden />
          {t("shell.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
