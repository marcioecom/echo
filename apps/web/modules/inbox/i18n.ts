const en = {
  metaTitle: "Support Inbox | Echo",
  nav: "Support Inbox",
  title: "Support Inbox",
  description:
    "Work the WhatsApp queue for {name}. Conversations that need a person surface first.",
  queueLabel: "Queue",
  queueCount: "{count}",
  filtersLabel: "Conversation status filters",
  filter: {
    all: "All",
    open: "Open",
    ai_active: "AI",
    human_required: "Needs you",
    resolved: "Resolved",
  },
  filterEmpty: {
    all: {
      title: "No conversations yet",
      body: "New WhatsApp support conversations appear here as messages arrive.",
    },
    open: {
      title: "No open conversations",
      body: "Open conversations waiting for a first response will show here.",
    },
    ai_active: {
      title: "AI is idle",
      body: "Conversations Echo is handling will show here while the AI is active.",
    },
    human_required: {
      title: "Nothing needs you right now",
      body: "When a contact needs a person, those conversations land here first.",
      action: "Show all",
    },
    resolved: {
      title: "No resolved conversations",
      body: "Resolved conversations stay here for reference.",
    },
  },
  status: {
    open: "Open",
    ai_active: "AI active",
    human_required: "Needs you",
    resolved: "Resolved",
  },
  sender: {
    contact: "Contact",
    ai: "AI",
    operator: "Operator",
    system: "System",
    echo: "Echo AI",
  },
  handoff: {
    summaryTitle: "Briefing",
    summaryEmpty: "Echo could not write a summary before passing this on.",
    event: "Passed to a person",
    reason: {
      human_requested: "Asked for a person",
      low_confidence: "Not enough in the knowledge to answer",
      unsupported_policy: "This topic needs a person",
      ai_failure: "The AI flow failed",
      unsupported_content: "Attachment Echo can't read",
      operator_takeover: "An operator took over",
    },
  },
  staleError: "New conversations could not be loaded.",
  retry: "Retry",
  tryAgain: "Try again",
  unavailableTitle: "Inbox unavailable",
  unavailableBody: "The conversation queue could not be loaded.",
  emptyTitle: "No conversations yet",
  emptyBody:
    "New WhatsApp support conversations will appear here as messages arrive.",
  noMessagesYet: "No messages yet",
  loadingMore: "Loading...",
  loadMore: "Load more",
  loadingList: "Loading conversations",
  notFoundTitle: "Conversation not found",
  notFoundBody: "It may have been removed or belongs to another Organization.",
  unavailableDetailTitle: "Conversation unavailable",
  unavailableDetailBody: "The message timeline could not be loaded.",
  back: "Back to inbox",
  newMessagesError: "New messages could not be loaded.",
  messagesLabel: "Conversation messages",
  noMessagesTitle: "No messages",
  noMessagesBody: "Messages in this Support Conversation will appear here.",
  unsupported: "Unsupported attachment",
  delivery: {
    pending: "Pending",
    sent: "Sent",
    delivered: "Delivered",
    read: "Read",
    failed: "Not delivered",
  },
  selectTitle: "Pick a conversation",
  selectBody:
    "Choose one from the queue to read the timeline and reply when needed.",
  loadingDetail: "Loading conversation",
  replyLabel: "Reply to customer",
  replyPlaceholder: "Write a reply…",
  replyHint: "Enter to send · Shift+Enter for a new line",
  replyDisabled: "This conversation is resolved. Replies are closed.",
  send: "Send reply",
  validation: {
    body: "Write a reply before sending.",
  },
  errors: {
    request: "The Support Inbox request could not be completed.",
  },
}

const ptBR = {
  metaTitle: "Inbox de suporte | Echo",
  nav: "Inbox de suporte",
  title: "Inbox de suporte",
  description:
    "Trabalhe a fila de WhatsApp de {name}. Conversas que precisam de uma pessoa aparecem primeiro.",
  queueLabel: "Fila",
  queueCount: "{count}",
  filtersLabel: "Filtros de status da conversa",
  filter: {
    all: "Todas",
    open: "Abertas",
    ai_active: "IA",
    human_required: "Precisa de você",
    resolved: "Resolvidas",
  },
  filterEmpty: {
    all: {
      title: "Nenhuma conversa ainda",
      body: "Conversas novas de suporte no WhatsApp aparecem aqui quando as mensagens chegam.",
    },
    open: {
      title: "Nenhuma conversa aberta",
      body: "Conversas abertas aguardando a primeira resposta aparecem aqui.",
    },
    ai_active: {
      title: "IA ociosa",
      body: "Conversas que a Echo está atendendo aparecem aqui enquanto a IA estiver ativa.",
    },
    human_required: {
      title: "Nada precisa de você agora",
      body: "Quando um contato precisar de uma pessoa, essas conversas entram aqui primeiro.",
      action: "Ver todas",
    },
    resolved: {
      title: "Nenhuma conversa resolvida",
      body: "Conversas resolvidas ficam aqui para consulta.",
    },
  },
  status: {
    open: "Aberta",
    ai_active: "IA ativa",
    human_required: "Precisa de você",
    resolved: "Resolvida",
  },
  sender: {
    contact: "Contato",
    ai: "IA",
    operator: "Operador",
    system: "Sistema",
    echo: "Echo IA",
  },
  handoff: {
    summaryTitle: "Briefing",
    summaryEmpty:
      "A Echo não conseguiu escrever um resumo antes de passar adiante.",
    event: "Passou para uma pessoa",
    reason: {
      human_requested: "Pediu uma pessoa",
      low_confidence: "A base não tinha o bastante para responder",
      unsupported_policy: "Esse assunto precisa de uma pessoa",
      ai_failure: "O fluxo de IA falhou",
      unsupported_content: "Anexo que a Echo não lê",
      operator_takeover: "Um operador assumiu",
    },
  },
  staleError: "Não foi possível carregar conversas novas.",
  retry: "Tentar de novo",
  tryAgain: "Tentar de novo",
  unavailableTitle: "Inbox indisponível",
  unavailableBody: "Não foi possível carregar a fila de conversas.",
  emptyTitle: "Nenhuma conversa ainda",
  emptyBody:
    "Conversas novas de suporte no WhatsApp aparecem aqui quando as mensagens chegam.",
  noMessagesYet: "Nenhuma mensagem ainda",
  loadingMore: "Carregando...",
  loadMore: "Carregar mais",
  loadingList: "Carregando conversas",
  notFoundTitle: "Conversa não encontrada",
  notFoundBody: "Ela pode ter sido removida ou pertence a outra organização.",
  unavailableDetailTitle: "Conversa indisponível",
  unavailableDetailBody: "Não foi possível carregar as mensagens.",
  back: "Voltar para a inbox",
  newMessagesError: "Não foi possível carregar mensagens novas.",
  messagesLabel: "Mensagens da conversa",
  noMessagesTitle: "Nenhuma mensagem",
  noMessagesBody: "As mensagens desta conversa de suporte aparecem aqui.",
  unsupported: "Anexo não suportado",
  delivery: {
    pending: "Pendente",
    sent: "Enviada",
    delivered: "Entregue",
    read: "Lida",
    failed: "Não entregue",
  },
  selectTitle: "Escolha uma conversa",
  selectBody:
    "Selecione uma na fila para ler as mensagens e responder quando precisar.",
  loadingDetail: "Carregando conversa",
  replyLabel: "Responder ao cliente",
  replyPlaceholder: "Escreva uma resposta…",
  replyHint: "Enter envia · Shift+Enter nova linha",
  replyDisabled: "Esta conversa está resolvida. Respostas estão fechadas.",
  send: "Enviar resposta",
  validation: {
    body: "Escreva uma resposta antes de enviar.",
  },
  errors: {
    request: "Não foi possível concluir a solicitação da inbox.",
  },
} satisfies typeof en

export type InboxMessages = typeof en

export const inboxMessages = {
  en,
  "pt-BR": ptBR,
}
