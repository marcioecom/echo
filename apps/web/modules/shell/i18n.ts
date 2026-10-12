const en = {
  settings: "Settings",
  primaryNav: "Primary",
  signOut: "Sign out",
  closeNav: "Close navigation",
  openNav: "Open navigation",
  loadingWorkspace: "Loading workspace",
  organizations: "Organizations",
  loadingOrganizations: "Loading organizations",
  organizationsError: "Couldn't load organizations.",
  tryAgain: "Try again",
  organizationsEmpty: "No organizations found.",
  switchLabel: "Switch organization. Current organization: {name}",
  errors: {
    switch: "Could not switch organization",
  },
}

const ptBR = {
  settings: "Configurações",
  primaryNav: "Principal",
  signOut: "Sair",
  closeNav: "Fechar navegação",
  openNav: "Abrir navegação",
  loadingWorkspace: "Carregando a organização",
  organizations: "Organizações",
  loadingOrganizations: "Carregando organizações",
  organizationsError: "Não foi possível carregar as organizações.",
  tryAgain: "Tentar de novo",
  organizationsEmpty: "Nenhuma organização encontrada.",
  switchLabel: "Trocar de organização. Organização atual: {name}",
  errors: {
    switch: "Não foi possível trocar de organização",
  },
} satisfies typeof en

export type ShellMessages = typeof en

export const shellMessages = {
  en,
  "pt-BR": ptBR,
}
