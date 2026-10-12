const en = {
  metaTitle: "Knowledge Base | Echo",
  nav: "Knowledge Base",
  title: "Knowledge Base",
  description: "Support information Echo can use in first responses.",
  addTitle: "Add knowledge",
  addBody:
    "Add pasted text or one PDF, DOCX, Markdown, or plain-text file up to 10 MB.",
  titleLabel: "Title",
  titlePlaceholder: "Support policy",
  source: "Source",
  pastedText: "Pasted text",
  fileUpload: "File upload",
  content: "Content",
  contentPlaceholder: "Paste the support information Echo can use.",
  file: "File",
  fileHint: "Files upload directly to private storage before indexing.",
  uploading: "Uploading",
  add: "Add knowledge",
  documents: "Documents",
  refreshing: "Refreshing",
  loading: "Loading documents.",
  loadError: "Documents could not be loaded.",
  retry: "Retry",
  emptyTitle: "No knowledge yet",
  emptyBody:
    "Add support information here. Echo will use ready documents in first responses.",
  failure: {
    index_dispatch_failed: "Indexing could not be started.",
    indexing_failed: "Indexing failed.",
  },
  reindexing: "Reindexing",
  reindex: "Reindex",
  status: {
    pending: "Pending",
    processing: "Processing",
    ready: "Ready",
    failed: "Failed",
  },
  validation: {
    title: "Enter a title",
    content: "Enter support knowledge",
    file: "Choose a file",
  },
  errors: {
    upload: "The file upload could not be completed.",
    request: "The Knowledge Base request could not be completed.",
  },
}

const ptBR = {
  metaTitle: "Base de conhecimento | Echo",
  nav: "Base de conhecimento",
  title: "Base de conhecimento",
  description:
    "Informações de suporte que a Echo pode usar nas primeiras respostas.",
  addTitle: "Adicionar conhecimento",
  addBody:
    "Cole um texto ou envie um PDF, DOCX, Markdown ou texto simples de até 10 MB.",
  titleLabel: "Título",
  titlePlaceholder: "Política de suporte",
  source: "Origem",
  pastedText: "Texto colado",
  fileUpload: "Arquivo",
  content: "Conteúdo",
  contentPlaceholder: "Cole as informações de suporte que a Echo pode usar.",
  file: "Arquivo",
  fileHint:
    "O arquivo vai direto para o armazenamento privado antes da indexação.",
  uploading: "Enviando",
  add: "Adicionar conhecimento",
  documents: "Documentos",
  refreshing: "Atualizando",
  loading: "Carregando documentos.",
  loadError: "Não foi possível carregar os documentos.",
  retry: "Tentar de novo",
  emptyTitle: "Nenhum conhecimento ainda",
  emptyBody:
    "Adicione informações de suporte aqui. A Echo usa os documentos prontos nas primeiras respostas.",
  failure: {
    index_dispatch_failed: "Não foi possível iniciar a indexação.",
    indexing_failed: "A indexação falhou.",
  },
  reindexing: "Reindexando",
  reindex: "Reindexar",
  status: {
    pending: "Pendente",
    processing: "Processando",
    ready: "Pronto",
    failed: "Falhou",
  },
  validation: {
    title: "Informe um título",
    content: "Informe o conhecimento de suporte",
    file: "Escolha um arquivo",
  },
  errors: {
    upload: "Não foi possível concluir o envio do arquivo.",
    request: "Não foi possível concluir a solicitação da base de conhecimento.",
  },
} satisfies typeof en

export type KnowledgeMessages = typeof en

export const knowledgeMessages = {
  en,
  "pt-BR": ptBR,
}
