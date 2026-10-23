const en = {
  metaTitle: "Set up Echo",
  pageTitle: "Finish setting up",
  pageDescription:
    "Everything Echo needs before it can answer on WhatsApp and fill the Support Inbox.",
  progressLabel: "Setup progress",
  progress: "{done} of {total} done",
  optional: "Recommended",
  exitToInbox: "Go to the Support Inbox",
  adminHint: "Ask an administrator of your Organization to finish this step.",
  steps: {
    organization: {
      title: "Organization",
      done: "Created",
    },
    channel: {
      title: "WhatsApp number",
      todo: "No number connected yet. Echo can only answer once one is connected.",
      pending: "Connection started. Finish the pairing on your phone.",
      done: "Connected to {name}.",
    },
    knowledge: {
      title: "Company knowledge",
      todo: "Add what Echo should know before it answers on its own.",
      indexing: "Reading your documents.",
      done: "Ready to answer, with {count} sources.",
    },
  },
  actions: {
    connect: "Connect WhatsApp",
    finish: "Finish connection",
    add: "Add knowledge",
    retry: "Try again",
  },
  organization: {
    title: "Create your Organization",
    description:
      "Your Organization is your company inside Echo. It holds your Support Inbox, your Memberships, and your Channels.",
    name: "Company name",
    namePlaceholder: "Bluebird Bakery",
    submit: "Create Organization",
    submitting: "Creating...",
    next: "Next, you connect the WhatsApp number.",
    errors: {
      name: "Enter the company name",
      create: "Couldn't create the Organization",
    },
  },
  waiting: {
    title: "Connected. Waiting for the first message.",
    body: "Send a message from any phone. The conversation shows up here in seconds.",
    bodyNoAddress:
      "Send a message from any phone to the connected number. The conversation shows up here in seconds.",
    live: "This page updates on its own as soon as a message arrives.",
  },
  success: {
    title: "It's working.",
    body: "{name} wrote and Echo already answered. From now on, every conversation lands in the Support Inbox.",
    bodyNoReply:
      "{name} wrote. Echo is preparing the reply, which shows up here in a moment.",
    conversation: "See the conversation",
    inbox: "Go to the Support Inbox",
    recap: {
      organization: "Organization created",
      channel: "WhatsApp connected",
      conversation: "First conversation received",
    },
  },
  inbox: {
    title: "Your Support Inbox is still empty",
    body: "Echo answers on WhatsApp and brings every conversation here. Connect the WhatsApp number to get started.",
  },
  errors: {
    load: "Couldn't load the setup state.",
  },
}

const ptBR = {
  metaTitle: "Configurar o Echo",
  pageTitle: "Conclua a configuração",
  pageDescription:
    "Tudo o que a Echo precisa antes de responder no WhatsApp e encher o Inbox de suporte.",
  progressLabel: "Progresso da configuração",
  progress: "{done} de {total} concluídos",
  optional: "Recomendado",
  exitToInbox: "Ir para o Inbox de suporte",
  adminHint:
    "Peça a um administrador da sua organização para concluir este passo.",
  steps: {
    organization: {
      title: "Organização",
      done: "Criada",
    },
    channel: {
      title: "Número do WhatsApp",
      todo: "Nenhum número conectado ainda. A Echo só responde depois que um número estiver conectado.",
      pending: "Conexão iniciada. Termine o pareamento no seu celular.",
      done: "Conectado a {name}.",
    },
    knowledge: {
      title: "Conhecimento da empresa",
      todo: "Adicione o que a Echo precisa saber antes de responder sozinha.",
      indexing: "Lendo seus documentos.",
      done: "Pronta para responder, com {count} fontes.",
    },
  },
  actions: {
    connect: "Conectar WhatsApp",
    finish: "Terminar conexão",
    add: "Adicionar conhecimento",
    retry: "Tentar de novo",
  },
  organization: {
    title: "Crie sua organização",
    description:
      "A organização é a sua empresa dentro da Echo. É onde ficam o Inbox de suporte, os membros e os canais.",
    name: "Nome da empresa",
    namePlaceholder: "Padaria do Bairro",
    submit: "Criar organização",
    submitting: "Criando...",
    next: "Depois, você conecta o número do WhatsApp.",
    errors: {
      name: "Informe o nome da empresa",
      create: "Não foi possível criar a organização",
    },
  },
  waiting: {
    title: "Conectado. Aguardando a primeira mensagem.",
    body: "Mande uma mensagem de qualquer celular. A conversa aparece aqui em segundos.",
    bodyNoAddress:
      "Mande uma mensagem para o número conectado de qualquer celular. A conversa aparece aqui em segundos.",
    live: "Esta página se atualiza sozinha assim que uma mensagem chegar.",
  },
  success: {
    title: "Está funcionando.",
    body: "{name} escreveu e a Echo já respondeu. A partir de agora, toda conversa cai no Inbox de suporte.",
    bodyNoReply:
      "{name} escreveu. A Echo está preparando a resposta, que aparece aqui em instantes.",
    conversation: "Ver a conversa",
    inbox: "Ir para o Inbox de suporte",
    recap: {
      organization: "Organização criada",
      channel: "WhatsApp conectado",
      conversation: "Primeira conversa recebida",
    },
  },
  inbox: {
    title: "Seu Inbox de suporte ainda está vazio",
    body: "A Echo atende no WhatsApp e traz cada conversa para cá. Conecte o número do WhatsApp para começar.",
  },
  errors: {
    load: "Não foi possível carregar a configuração.",
  },
} satisfies typeof en

export type SetupMessages = typeof en

export const setupMessages = {
  en,
  "pt-BR": ptBR,
}
