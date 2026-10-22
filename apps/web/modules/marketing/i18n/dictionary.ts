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
    before: "Your business WhatsApp answers with what ",
    em: "it already knows",
    after: "",
    subtext:
      "For local businesses that already live on WhatsApp. Echo answers the repeated questions from what your business has written down, after hours too, and brings in a teammate when it doesn't know.",
    joinPilot: "Start free for 30 days",
    openInbox: "Open inbox",
    clickTrigger: "Limited pilot spots · No sales call",
    scene: {
      sr: "The customer asks what time the shop closes on Saturday. Echo reads the opening-hours document, answers from it, then passes an address change to Ana from the team.",
      knowledge: {
        title: "Harbor Goods · Knowledge",
        meta: "3 documents",
        source: "Source",
        footer: "Answers stay inside these documents.",
        noMatch: "No document covers address changes.",
      },
      documents: [
        {
          title: "Opening hours",
          body: "Sat 10am–6pm · Pickup until 5:30pm",
        },
        {
          title: "Delivery",
          body: "Porto Alegre: 3–5 business days",
        },
        {
          title: "Payment",
          body: "Pix, card, or cash on pickup",
        },
      ],
      conversation: {
        business: "Harbor Goods",
        channel: "WhatsApp",
        questionOne: "What time do you close on Saturday?",
        answerOne:
          "Saturday we are open 10am–6pm. Pickup is available until 5:30pm.",
        questionTwo: "I need to change my delivery address.",
        answerTwo: "Passing you to Ana from the team.",
      },
      handoff: {
        name: "Ana",
        note: "joined from the Support Inbox",
      },
      status: {
        listening: "Listening on WhatsApp",
        reading: "Reading your knowledge",
        answering: "Answering from your knowledge",
        answered: "Answered automatically",
        noMatch: "Nothing matches. Not guessing.",
        handingOff: "Handing off to Ana",
        done: "Answered, then handed off",
      },
      controls: {
        pause: "Pause",
        play: "Continue",
        replay: "Replay",
      },
    },
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
      "You do not need a new system or anything to install. Knowledge in, WhatsApp connected, conversations in one inbox.",
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
        body: "Questions covered by your knowledge get a reply. Voice notes are transcribed so they can be answered too. When Echo is unsure, a person on your team continues.",
      },
    ],
  },
  features: {
    titleBefore: "What Echo ",
    titleEm: "does",
    titleAfter: "",
    description:
      "Four things, on purpose. Voice notes are transcribed and can be answered from your knowledge. Photos and stickers go to a person, and so does anything Echo is unsure about.",
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
    titleBefore: "It asks before it ",
    titleEm: "answers",
    titleAfter: ". A person steps in when it doesn't know.",
    description:
      "Your customer stays on the WhatsApp they already use. Echo answers from your documents, and when the question falls outside them, brings in a teammate with the thread so far.",
    business: "Harbor Goods",
    channel: "WhatsApp",
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
    period: "/month",
    body: "First 30 days free. Then R$297/month. No extra product tiers, and no “talk to sales” maze.",
    included: [
      "Answers from your knowledge base",
      "Clarifying questions when Echo is unsure",
      "Voice notes transcribed; photos, stickers, and unclear cases go to a person",
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
        question: "Can the customer ask for a person?",
        answer:
          "Yes. When the customer asks, Echo hands the conversation over right away, with the thread so far, and says a teammate will continue.",
      },
      {
        question: "What happens with audio, photos, or stickers?",
        answer:
          "Voice notes are transcribed, and Echo can answer them from your knowledge base. When the audio is unclear or Echo is not sure, the conversation goes to a person. Photos and stickers still go to a person — Echo does not try to interpret images.",
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
    openInbox: "Abrir as conversas",
    openMenu: "Abrir o menu",
    closeMenu: "Fechar o menu",
    primary: "Principal",
    mobile: "Celular",
    language: "Idioma",
    english: "EN",
    portuguese: "PT",
  },
  hero: {
    before: "O WhatsApp da sua empresa responde com o que ela ",
    em: "já sabe",
    after: "",
    subtext:
      "Para negócio local que já vive no WhatsApp. O Echo responde as perguntas repetidas com o que a empresa já tem escrito, inclusive depois do expediente, e chama alguém do time quando não sabe.",
    joinPilot: "Começar 30 dias grátis",
    openInbox: "Abrir as conversas",
    clickTrigger: "Vagas limitadas · Sem ligação de vendedor",
    scene: {
      sr: "O cliente pergunta o horário de sábado. O Echo lê o documento de horários, responde com ele e passa uma troca de endereço para a Ana do time.",
      knowledge: {
        title: "Casa do Porto · Base",
        meta: "3 documentos",
        source: "Fonte",
        footer: "As respostas ficam nestes documentos.",
        noMatch: "Nenhum documento cobre troca de endereço.",
      },
      documents: [
        {
          title: "Horários",
          body: "Sáb 10h–18h · Retirada até 17h30",
        },
        {
          title: "Entrega",
          body: "Porto Alegre: 3 a 5 dias úteis",
        },
        {
          title: "Pagamento",
          body: "Pix, cartão ou dinheiro na retirada",
        },
      ],
      conversation: {
        business: "Casa do Porto",
        channel: "WhatsApp",
        questionOne: "Que horas vocês fecham no sábado?",
        answerOne: "Sábado a gente abre das 10h às 18h. Retirada até as 17h30.",
        questionTwo: "Preciso trocar o endereço da entrega.",
        answerTwo: "Vou te passar para a Ana do time.",
      },
      handoff: {
        name: "Ana",
        note: "entrou pela caixa de entrada do time",
      },
      status: {
        listening: "Ouvindo no WhatsApp",
        reading: "Lendo a sua base",
        answering: "Respondendo com a sua base",
        answered: "Respondeu sozinho",
        noMatch: "Nada na base. Não inventa.",
        handingOff: "Passando para a Ana",
        done: "Respondeu e passou para uma pessoa",
      },
      controls: {
        pause: "Pausar",
        play: "Continuar",
        replay: "Repetir",
      },
    },
  },
  problem: {
    titleBefore: "As mesmas perguntas, ",
    titleEm: "o dia inteiro",
    titleAfter: ". Depois, silêncio até de manhã.",
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
        title: "Fora do horário, ninguém responde",
        body: "Quem escreve às 21h espera até de manhã. Muita gente não espera. Escreve para o próximo que responder.",
      },
    ],
  },
  how: {
    titleBefore: "Três passos. ",
    titleEm: "Sem ferramenta extra.",
    titleAfter: "",
    description:
      "Você não troca de sistema nem instala nada. Entra o conhecimento, conecta o WhatsApp, as conversas ficam numa caixa de entrada.",
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
        body: "Pergunta que está na base recebe resposta. Áudio é transcrito para também poder ser respondido. Se ficar na dúvida, alguém do time continua.",
      },
    ],
  },
  features: {
    titleBefore: "O que o Echo ",
    titleEm: "faz",
    titleAfter: "",
    description:
      "Quatro coisas, de propósito. Áudio é transcrito e pode ser respondido com a sua base. Foto, figurinha e qualquer coisa que deixe o Echo em dúvida vão para uma pessoa.",
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
        title: "Uma caixa de entrada para o time",
        body: "As conversas do WhatsApp caem numa caixa de entrada compartilhada. A próxima pessoa lê o que aconteceu e segue.",
      },
    ],
  },
  demo: {
    titleBefore: "Pergunta antes de ",
    titleEm: "responder",
    titleAfter: ". Chama uma pessoa quando não sabe.",
    description:
      "Seu cliente continua no WhatsApp de sempre. O Echo responde com o que está nos seus documentos e, quando a pergunta sai deles, passa para alguém do time com o histórico.",
    business: "Casa do Porto",
    channel: "WhatsApp",
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
    titleBefore: "Comece com ",
    titleEm: "30 dias",
    titleAfter: " grátis",
    description:
      "São 30 dias grátis, com vagas limitadas, para a gente acompanhar de perto cada negócio.",
    afterPilot: "Depois dos 30 dias",
    amount: "R$297",
    period: "/mês",
    body: "Preço único, na página. Sem passar por vendedor.",
    included: [
      "Respostas com a sua base de conhecimento",
      "Pergunta de esclarecimento quando o Echo não tem certeza",
      "Áudio transcrito; foto, figurinha e o que ficar em dúvida vão para uma pessoa",
      "Uma caixa de entrada para o time",
    ],
    joinPilot: "Começar 30 dias grátis",
    openInbox: "Abrir as conversas",
    clickTrigger: "Vagas limitadas · Cancele quando quiser",
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
          "É. O Echo usa um número dedicado pela API oficial do WhatsApp. Não é o WhatsApp pessoal de alguém.",
      },
      {
        question: "A inteligência artificial erra?",
        answer:
          "Erra. Modelo de linguagem erra. Por isso o Echo passa para uma pessoa em vez de chutar — e pergunta de novo quando a mensagem não está clara.",
      },
      {
        question: "O cliente pode pedir para falar com uma pessoa?",
        answer:
          "Pode. Quando ele pede, o Echo passa a conversa na hora, com o histórico, e avisa que alguém do time vai continuar.",
      },
      {
        question: "E áudio, foto ou figurinha?",
        answer:
          "Áudio é transcrito, e o Echo pode responder com a sua base. Quando o áudio não fica claro ou o Echo não tem certeza, a conversa vai para uma pessoa. Foto e figurinha continuam indo para uma pessoa — o Echo não tenta interpretar imagem.",
      },
      {
        question: "Dá para agendar horário ou disparar campanha?",
        answer:
          "Não. Sem agenda, sem disparo, sem mensagem em massa. Isso fica com alguém do time.",
      },
      {
        question: "Preciso integrar com outro sistema?",
        answer:
          "Não. Hoje o Echo é WhatsApp, a sua base e uma caixa de entrada web. Integração não está incluída.",
      },
    ],
  },
  finalCta: {
    titleBefore: "Responda o próximo WhatsApp ",
    titleEm: "sem",
    titleAfter: " virar a noite por causa dele",
    body: "Comece com 30 dias grátis. O Echo responde com o que a empresa já sabe e chama uma pessoa quando precisa.",
    joinPilot: "Começar 30 dias grátis",
    openInbox: "Abrir as conversas",
    clickTrigger: "Vagas limitadas · Sem ligação de vendedor",
  },
  footer: {
    blurb:
      "Atendimento no WhatsApp que responde com o que a empresa já sabe e chama uma pessoa quando precisa.",
    signIn: "Entrar",
    label: "Rodapé",
    note: "O Echo está em fase de testes, com poucas vagas. Se você não reconhece o Echo, não preenche dado nenhum.",
  },
}

export const dictionary = {
  en,
  "pt-BR": ptBR,
} as const

export type LandingCopy = typeof en
