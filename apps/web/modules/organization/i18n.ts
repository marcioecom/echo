const en = {
  metaTitle: "Members | Echo",
  nav: "Members",
  title: "Members",
  description:
    "People with a Membership in {name}. Invitations are the only way to join.",
  inviteTitle: "Invite a member",
  email: "Email",
  role: "Role",
  inviting: "Inviting...",
  invite: "Invite",
  pendingTitle: "Pending invitations",
  copied: "Copied",
  copyLink: "Copy link",
  cancel: "Cancel",
  roles: {
    owner: "Owner",
    admin: "Admin",
    operator: "Operator",
  },
  validation: {
    email: "Enter a valid email address",
  },
  accept: {
    metaTitle: "Accept invitation | Echo",
    title: "Accept invitation",
    invitedBefore: "You were invited to join",
    invitedAfter: "on Echo.",
    invalid: "This invitation is invalid or has expired.",
    loading: "Loading invitation details...",
    accepting: "Accepting...",
    submit: "Accept and continue",
  },
  errors: {
    invalidInvitation: "Invalid invitation",
    accept: "Could not accept the invitation",
    switch: "Could not switch to the organization",
  },
}

const ptBR = {
  metaTitle: "Membros | Echo",
  nav: "Membros",
  title: "Membros",
  description:
    "Pessoas com acesso a {name}. Convites são a única forma de entrar.",
  inviteTitle: "Convidar um membro",
  email: "E-mail",
  role: "Papel",
  inviting: "Convidando...",
  invite: "Convidar",
  pendingTitle: "Convites pendentes",
  copied: "Copiado",
  copyLink: "Copiar link",
  cancel: "Cancelar",
  roles: {
    owner: "Proprietário",
    admin: "Admin",
    operator: "Operador",
  },
  validation: {
    email: "Informe um e-mail válido",
  },
  accept: {
    metaTitle: "Aceitar convite | Echo",
    title: "Aceitar convite",
    invitedBefore: "Você recebeu um convite para entrar em",
    invitedAfter: "na Echo.",
    invalid: "Este convite é inválido ou expirou.",
    loading: "Carregando os dados do convite...",
    accepting: "Aceitando...",
    submit: "Aceitar e continuar",
  },
  errors: {
    invalidInvitation: "Convite inválido",
    accept: "Não foi possível aceitar o convite",
    switch: "Não foi possível trocar para a organização",
  },
} satisfies typeof en

export type MembersMessages = typeof en

export const membersMessages = {
  en,
  "pt-BR": ptBR,
}
