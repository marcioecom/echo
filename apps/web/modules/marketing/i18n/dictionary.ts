export const locales = ["en", "pt-BR"] as const

export type Locale = (typeof locales)[number]

export function localeHomePath(locale: Locale): "/" | "/pt-br" {
  return locale === "pt-BR" ? "/pt-br" : "/"
}

export function localeFromPath(pathname: string): Locale {
  return pathname === "/pt-br" || pathname.startsWith("/pt-br/")
    ? "pt-BR"
    : "en"
}

export function htmlLang(locale: Locale) {
  return locale === "pt-BR" ? "pt-BR" : "en"
}

const en = {
  meta: {
    title: "Echo | WhatsApp customer support",
    description:
      "Echo answers customer questions on WhatsApp from your business knowledge, and hands off to a human when it needs to.",
  },
  skip: "Skip to content",
  nav: {
    howItWorks: "How it works",
    features: "Features",
    pricing: "Pricing",
    faq: "FAQ",
    signIn: "Sign in",
    dashboard: "Dashboard",
    getStarted: "Start free",
    openInbox: "Open inbox",
    openMenu: "Open navigation",
    closeMenu: "Close navigation",
    primary: "Primary",
    mobile: "Mobile",
    language: "Language",
    english: "EN",
    portuguese: "PT",
  },
  hero: {
    before: "Answer your customers on ",
    em: "WhatsApp",
    after: ", even while you sleep",
    subtext:
      "For local businesses that already live on WhatsApp. Echo answers the written repeats from your knowledge, and hands off to a human when it needs to.",
    joinPilot: "Start free for 30 days",
    openInbox: "Open inbox",
    clickTrigger: "Limited pilot spots · No sales call",
    chips: [
      "Answers from your own knowledge base",
      "Hands off to a human when needed",
      "One web inbox for your team",
    ],
    phonesSr:
      "Three WhatsApp conversations. Echo answers from the shop knowledge base, then hands a delivery-address change to Ana from the team.",
    business: "Harbor Goods",
    hoursIn: "What time do you close on Saturday?",
    hoursOut:
      "Saturday we are open 10am–6pm. Pickup is available until 5:30pm.",
    shippingIn: "Do you ship to Porto Alegre?",
    shippingOut:
      "Yes. Orders to Porto Alegre usually arrive in 3–5 business days.",
    handoffIn: "I need to change my delivery address.",
    handoffOut: "Passing you to Ana from the team.",
  },
  problem: {
    titleBefore: "The same questions, ",
    titleEm: "all day",
    titleAfter: ". Then silence after hours.",
    description:
      "WhatsApp is where customers already write. The work is keeping up without turning every evening into a second shift.",
    cards: [
      {
        quote: "Can you send the price again?",
        title: "The same answers, typed all day",
        body: "Hours, prices, and policies already live in your head. On WhatsApp they get retyped into every new thread.",
      },
      {
        quote: "I wrote last night.",
        title: "After hours, the thread goes quiet",
        body: "A customer who messages at 9pm waits until morning. Many do not wait. They write to the next business that replies.",
      },
    ],
  },
  how: {
    titleBefore: "Three steps. ",
    titleEm: "No extra tools.",
    titleAfter: "",
    description:
      "You do not need a new helpdesk stack. Knowledge in, WhatsApp connected, conversations in one inbox.",
    steps: [
      {
        title: "You send your business knowledge",
        body: "Hours, prices, policies — the written answers you already give. Echo uses that knowledge. It does not invent the rest.",
      },
      {
        title: "We connect your WhatsApp",
        body: "A dedicated number on the official WhatsApp API. Customers write there. Your personal phone stays yours.",
      },
      {
        title: "Echo answers, and hands off",
        body: "Straightforward written questions get a reply. When it is unsure, or the customer sends audio, a person on your team continues.",
      },
    ],
  },
  features: {
    titleBefore: "What Echo ",
    titleEm: "actually",
    titleAfter: " does",
    description:
      "Four things, on purpose. Audio, photos, and stickers go to a human. There is no scheduling, no broadcasts, and no third-party integrations.",
    items: [
      {
        title: "Answers from your knowledge base",
        body: "Echo replies to written questions using the documents you upload. If it is not in your knowledge, it does not make up a policy.",
      },
      {
        title: "Asks a clarifying question when unsure",
        body: "When a request is incomplete, Echo asks one clear question instead of guessing the service, the date, or the address.",
      },
      {
        title: "Hands off to a human",
        body: "Care, exceptions, and anything Echo should not answer go to a teammate — with the thread so far still visible.",
      },
      {
        title: "One web inbox for the team",
        body: "WhatsApp conversations land in a shared inbox. The next person can read what happened and continue.",
      },
    ],
  },
  demo: {
    titleBefore: "A conversation, not a ",
    titleEm: "widget",
    titleAfter: "",
    description:
      "Customers stay on WhatsApp. Echo reads the thread, answers what it can, and brings in a teammate when the request leaves the knowledge base.",
    business: "Harbor Goods",
    messages: [
      { from: "customer" as const, text: "How much is a haircut?" },
      {
        from: "echo" as const,
        text: "For which service — women's cut, men's cut, or a beard trim?",
      },
      { from: "customer" as const, text: "Women's cut. Can I book Saturday?" },
      {
        from: "echo" as const,
        text: "Passing you to Ana from the team. She can check Saturday with you.",
      },
    ],
    beats: [
      {
        label: "Clarify",
        body: "The price depends on the service, so Echo asks before answering.",
      },
      {
        label: "Answer from knowledge",
        body: "Once the service is clear, a written price can come from your knowledge base.",
      },
      {
        label: "Hand off",
        body: "Booking is not something Echo does. Saturday goes to a person.",
      },
    ],
  },
  niches: {
    titleBefore: "Built for ",
    titleEm: "local businesses",
    titleAfter: "",
    description:
      "If the same WhatsApp questions come in every day, Echo can take the written ones. The rest stays with your team.",
    items: [
      {
        name: "Clinics",
        body: "Opening hours, what to bring, and whether a referral is needed.",
      },
      {
        name: "Salons",
        body: "Prices, services, and which requests need a person to book.",
      },
      {
        name: "Pet shops",
        body: "Stock, pickup hours, and care questions you already have in writing.",
      },
      {
        name: "Real estate agencies",
        body: "Listing facts you publish. Visits and offers go to an agent.",
      },
      {
        name: "Driving schools",
        body: "Class times, documents, and fees — then a person for enrollment.",
      },
    ],
  },
  pricing: {
    titleBefore: "Start with a ",
    titleEm: "pilot",
    titleAfter: "",
    description:
      "Echo is early. The pilot is free for 30 days, with a limited number of spots, so we can stay close to each business.",
    afterPilot: "After the pilot",
    amount: "R$297",
    period: "/mês",
    body: "First 30 days free. Then from R$297/mês. No extra product tiers, and no “talk to sales” maze.",
    included: [
      "Answers from your knowledge base",
      "Clarifying questions when Echo is unsure",
      "Human handoff, including audio, photos, and stickers",
      "One web inbox for your team",
    ],
    joinPilot: "Start free for 30 days",
    openInbox: "Open inbox",
    clickTrigger: "Limited spots · Cancel anytime in the pilot",
  },
  faq: {
    titleBefore: "Honest answers, ",
    titleEm: "including the limits",
    titleAfter: "",
    description:
      "Echo is early. If a capability is not listed here, assume it is not built.",
    items: [
      {
        question: "Is this a dedicated WhatsApp number?",
        answer:
          "Yes. Echo uses a dedicated number through the official WhatsApp API. It is not a shared inbox on someone’s personal phone.",
      },
      {
        question: "Does the AI get things wrong?",
        answer:
          "Yes. Language models make mistakes. That is why Echo hands off to a human instead of guessing — and why it asks a clarifying question when the request is unclear.",
      },
      {
        question: "What happens with audio, photos, or stickers?",
        answer:
          "They go to a human. Echo answers written text from your knowledge base. Media is a handoff, not something it tries to interpret.",
      },
      {
        question: "Can Echo book appointments or send campaigns?",
        answer:
          "No. There is no scheduling, no broadcasts, and no bulk messaging. Those conversations belong with a person on your team.",
      },
      {
        question: "Do I need to connect other tools?",
        answer:
          "No. Echo today is WhatsApp, your knowledge base, and a web inbox. Integrations are not part of the pilot.",
      },
    ],
  },
  finalCta: {
    titleBefore: "Answer the next WhatsApp ",
    titleEm: "without",
    titleAfter: " staying awake for it",
    body: "Start the 30-day pilot. Echo answers from your knowledge and hands off to a human when it needs to.",
    joinPilot: "Start free for 30 days",
    openInbox: "Open inbox",
    clickTrigger: "Limited pilot spots · No sales call",
  },
  footer: {
    blurb:
      "WhatsApp customer support that answers from your knowledge and brings in a person when it needs to.",
    signIn: "Sign in",
    label: "Footer",
    note: "Echo is in a private pilot. If you do not recognize Echo, do not enter your details.",
  },
}

const ptBR: typeof en = {
  meta: {
    title: "Echo | Atendimento no WhatsApp",
    description:
      "O Echo responde o cliente no WhatsApp com o que a sua empresa já sabe, e passa para uma pessoa quando precisa.",
  },
  skip: "Pular para o conteúdo",
  nav: {
    howItWorks: "Como funciona",
    features: "O que faz",
    pricing: "Preço",
    faq: "Dúvidas",
    signIn: "Entrar",
    dashboard: "Painel",
    getStarted: "Começar grátis",
    openInbox: "Abrir a inbox",
    openMenu: "Abrir o menu",
    closeMenu: "Fechar o menu",
    primary: "Principal",
    mobile: "Celular",
    language: "Idioma",
    english: "EN",
    portuguese: "PT",
  },
  hero: {
    before: "Responda seus clientes no ",
    em: "WhatsApp",
    after: ", mesmo dormindo",
    subtext:
      "Para negócio local que já vive no WhatsApp. O Echo responde as perguntas repetidas com o que a empresa já sabe, e passa para uma pessoa quando precisa.",
    joinPilot: "Começar 30 dias grátis",
    openInbox: "Abrir a inbox",
    clickTrigger: "Vagas limitadas · Sem call comercial",
    chips: [
      "Responde com a sua própria base de conhecimento",
      "Passa para uma pessoa quando precisa",
      "Uma inbox web para o time",
    ],
    phonesSr:
      "Três conversas no WhatsApp. O Echo responde com o que a loja já sabe e, no fim, passa uma troca de endereço para a Ana do time.",
    business: "Casa do Porto",
    hoursIn: "Que horas vocês fecham no sábado?",
    hoursOut: "Sábado a gente abre das 10h às 18h. Retirada até as 17h30.",
    shippingIn: "Vocês entregam em Porto Alegre?",
    shippingOut:
      "Sim. Pedido para Porto Alegre costuma chegar em 3 a 5 dias úteis.",
    handoffIn: "Preciso trocar o endereço da entrega.",
    handoffOut: "Vou te passar para a Ana do time.",
  },
  problem: {
    titleBefore: "As mesmas perguntas, ",
    titleEm: "o dia inteiro",
    titleAfter: ". Depois, silêncio de noite.",
    description:
      "O cliente já fala no WhatsApp. O trabalho é aguentar o volume sem transformar a noite em plantão.",
    cards: [
      {
        quote: "Pode mandar o preço de novo?",
        title: "As mesmas respostas, digitadas o dia todo",
        body: "Horário, preço e regra já estão na sua cabeça. No WhatsApp, isso vira digitação em todo chat novo.",
      },
      {
        quote: "Mandei mensagem ontem à noite.",
        title: "Fora do horário, o chat some",
        body: "Quem escreve às 21h espera até de manhã. Muita gente não espera. Escreve para o próximo que responder.",
      },
    ],
  },
  how: {
    titleBefore: "Três passos. ",
    titleEm: "Sem ferramenta extra.",
    titleAfter: "",
    description:
      "Você não precisa de um helpdesk novo. Entra o conhecimento, conecta o WhatsApp, as conversas ficam numa inbox.",
    steps: [
      {
        title: "Você manda o que a empresa já sabe",
        body: "Horário, preço, política — as respostas que você já escreve. O Echo usa isso. Não inventa o resto.",
      },
      {
        title: "A gente conecta o seu WhatsApp",
        body: "Um número só da empresa, na API oficial do WhatsApp. O cliente escreve ali. Seu celular pessoal continua seu.",
      },
      {
        title: "O Echo responde e, se precisar, passa adiante",
        body: "Pergunta simples por escrito recebe resposta. Se ficar na dúvida, ou se vier áudio, alguém do time continua.",
      },
    ],
  },
  features: {
    titleBefore: "O que o Echo ",
    titleEm: "de fato",
    titleAfter: " faz",
    description:
      "Quatro coisas, de propósito. Áudio, foto e figurinha vão para uma pessoa. Sem agenda, sem disparo em massa, sem integração com outro sistema.",
    items: [
      {
        title: "Responde com a sua base de conhecimento",
        body: "O Echo responde pergunta por escrito com os documentos que você sobe. Se não está na base, ele não inventa regra.",
      },
      {
        title: "Pergunta de novo quando não tem certeza",
        body: "Se a mensagem vem pela metade, o Echo faz uma pergunta clara. Não chuta o serviço, a data nem o endereço.",
      },
      {
        title: "Passa para uma pessoa",
        body: "Cuidado, exceção e o que o Echo não deve responder vão para alguém do time — com o histórico à vista.",
      },
      {
        title: "Uma inbox web para o time",
        body: "As conversas do WhatsApp caem numa inbox compartilhada. A próxima pessoa lê o que aconteceu e segue.",
      },
    ],
  },
  demo: {
    titleBefore: "Uma conversa, não um ",
    titleEm: "widget",
    titleAfter: "",
    description:
      "O cliente continua no WhatsApp. O Echo lê o fio, responde o que dá e chama alguém do time quando o pedido sai da base.",
    business: "Casa do Porto",
    messages: [
      { from: "customer" as const, text: "Quanto custa o corte?" },
      {
        from: "echo" as const,
        text: "Qual serviço — corte feminino, masculino ou barba?",
      },
      { from: "customer" as const, text: "Feminino. Dá para marcar sábado?" },
      {
        from: "echo" as const,
        text: "Vou te passar para a Ana do time. Ela confere o sábado com você.",
      },
    ],
    beats: [
      {
        label: "Esclarece",
        body: "O preço muda conforme o serviço, então o Echo pergunta antes de responder.",
      },
      {
        label: "Responde com a base",
        body: "Com o serviço claro, o preço escrito pode vir da sua base de conhecimento.",
      },
      {
        label: "Passa adiante",
        body: "Agendar horário o Echo não faz. Sábado fica com uma pessoa.",
      },
    ],
  },
  niches: {
    titleBefore: "Feito para ",
    titleEm: "negócio local",
    titleAfter: "",
    description:
      "Se as mesmas perguntas chegam no WhatsApp todo dia, o Echo pega as por escrito. O resto fica com o seu time.",
    items: [
      {
        name: "Clínicas",
        body: "Horário, o que levar e se precisa de encaminhamento.",
      },
      {
        name: "Salões",
        body: "Preço, serviço e o que precisa de gente para marcar.",
      },
      {
        name: "Pet shops",
        body: "Estoque, horário de retirada e as dúvidas de cuidado que você já tem por escrito.",
      },
      {
        name: "Imobiliárias",
        body: "O que já está no anúncio. Visita e proposta vão para o corretor.",
      },
      {
        name: "Autoescolas",
        body: "Horário de aula, documento e valor — matrícula fica com uma pessoa.",
      },
    ],
  },
  pricing: {
    titleBefore: "Comece pelo ",
    titleEm: "piloto",
    titleAfter: "",
    description:
      "O Echo ainda é cedo. O piloto é grátis por 30 dias, com vagas limitadas, para a gente acompanhar de perto cada negócio.",
    afterPilot: "Depois do piloto",
    amount: "R$297",
    period: "/mês",
    body: "30 dias grátis. Depois, a partir de R$297/mês. Sem plano extra e sem essa de “fala com o comercial”.",
    included: [
      "Respostas com a sua base de conhecimento",
      "Pergunta de esclarecimento quando o Echo não tem certeza",
      "Handoff para uma pessoa, inclusive áudio, foto e figurinha",
      "Uma inbox web para o time",
    ],
    joinPilot: "Começar 30 dias grátis",
    openInbox: "Abrir a inbox",
    clickTrigger: "Vagas limitadas · Cancele quando quiser no piloto",
  },
  faq: {
    titleBefore: "Resposta reta, ",
    titleEm: "incluindo o que não faz",
    titleAfter: "",
    description:
      "O Echo ainda é cedo. Se não está escrito aqui, assume que ainda não existe.",
    items: [
      {
        question: "É um número de WhatsApp só da empresa?",
        answer:
          "É. O Echo usa um número dedicado pela API oficial do WhatsApp. Não é a caixa do celular de alguém.",
      },
      {
        question: "A inteligência artificial erra?",
        answer:
          "Erra. Modelo de linguagem erra. Por isso o Echo passa para uma pessoa em vez de chutar — e pergunta de novo quando a mensagem não está clara.",
      },
      {
        question: "E áudio, foto ou figurinha?",
        answer:
          "Vai para uma pessoa. O Echo responde texto da sua base. Mídia não é coisa que ele tenta adivinhar.",
      },
      {
        question: "Dá para agendar horário ou disparar campanha?",
        answer:
          "Não. Sem agenda, sem disparo, sem mensagem em massa. Isso fica com alguém do time.",
      },
      {
        question: "Preciso ligar em outro sistema?",
        answer:
          "Não. Hoje o Echo é WhatsApp, a sua base e uma inbox web. Integração não entra no piloto.",
      },
    ],
  },
  finalCta: {
    titleBefore: "Responda o próximo WhatsApp ",
    titleEm: "sem",
    titleAfter: " virar a noite por causa dele",
    body: "Comece o piloto de 30 dias. O Echo responde com o que a empresa já sabe e chama uma pessoa quando precisa.",
    joinPilot: "Começar 30 dias grátis",
    openInbox: "Abrir a inbox",
    clickTrigger: "Vagas limitadas · Sem call comercial",
  },
  footer: {
    blurb:
      "Atendimento no WhatsApp que responde com o que a empresa já sabe e chama uma pessoa quando precisa.",
    signIn: "Entrar",
    label: "Rodapé",
    note: "O Echo está em piloto fechado. Se você não reconhece o Echo, não preenche dado nenhum.",
  },
}

export const dictionary = {
  en,
  "pt-BR": ptBR,
} as const

export type LandingCopy = typeof en
