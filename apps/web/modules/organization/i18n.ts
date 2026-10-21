const en = {
  metaTitle: "Members | Echo",
  nav: "Members",
  title: "Members",
  description:
    "People with a Membership in {name}. Invitations are the only way to join.",
  inviteTitle: "Invite a member",
  inviteAction: "Invite member",
  email: "Email",
  role: "Role",
  inviting: "Inviting...",
  invite: "Invite",
  inviteSuccess: "Invitation sent. Copy the link from Pending invitations.",
  pendingTitle: "Pending invitations",
  pendingWaiting: "Waiting to accept",
  copied: "Copied",
  copyLink: "Copy link",
  cancel: "Cancel",
  soloTitle: "You are the only member",
  soloBody: "Invite operators so the support inbox can be worked as a team.",
  soloCta: "Invite someone",
  roleHint: {
    owner: "Full control, including members and archiving the organization.",
    admin: "Manages configuration, members, and invitations.",
    operator: "Works the support inbox. Cannot manage the organization.",
  },
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
  inviteAction: "Convidar membro",
  email: "E-mail",
  role: "Papel",
  inviting: "Convidando...",
  invite: "Convidar",
  inviteSuccess: "Convite enviado. Copie o link em Convites pendentes.",
  pendingTitle: "Convites pendentes",
  pendingWaiting: "Aguardando aceite",
  copied: "Copiado",
  copyLink: "Copiar link",
  cancel: "Cancelar",
  soloTitle: "Você é o único membro",
  soloBody:
    "Convide operadores para o Inbox de suporte ser trabalhado em equipe.",
  soloCta: "Convidar alguém",
  roleHint: {
    owner: "Controle total, incluindo membros e arquivar a organização.",
    admin: "Gerencia configuração, membros e convites.",
    operator: "Trabalha no Inbox de suporte. Não gerencia a organização.",
  },
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

const organizationEn = {
  slugHint: "Lowercase letters, numbers, and hyphens.",
  checking: "Checking {slug}...",
  available: "{slug} is available",
  taken: "{slug} is taken. Try another one",
  checkError: "Could not check availability. It will be verified on submit",
  validation: {
    name: "Enter an organization name",
    slug: "Enter a slug",
    slugMax: "Keep it under 48 characters",
    slugPattern: "Lowercase letters, numbers, and hyphens only",
    slugTaken: "This slug is taken. Try another one",
    slugCheck: "Could not check availability. Try again",
    create: "Could not create the organization",
  },
}

const organizationPtBR = {
  slugHint: "Minúsculas, números e hífens.",
  checking: "Verificando {slug}...",
  available: "{slug} está disponível",
  taken: "{slug} já está em uso. Tente outro",
  checkError:
    "Não foi possível verificar a disponibilidade. A conferência acontece ao enviar",
  validation: {
    name: "Informe o nome da organização",
    slug: "Informe o slug",
    slugMax: "Use no máximo 48 caracteres",
    slugPattern: "Só letras minúsculas, números e hífens",
    slugTaken: "Esse slug já está em uso. Tente outro",
    slugCheck: "Não foi possível verificar a disponibilidade. Tente de novo",
    create: "Não foi possível criar a organização",
  },
} satisfies typeof organizationEn

export type OrganizationMessages = typeof organizationEn

export const organizationMessages = {
  en: organizationEn,
  "pt-BR": organizationPtBR,
}
