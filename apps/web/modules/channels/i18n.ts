"use client"

import { useState } from "react"

import {
  prefersPortuguese,
  readLanguageCookie,
} from "@/modules/marketing/i18n/negotiation"

export type ChannelsLocale = "en" | "pt-BR"

const en = {
  metaTitle: "Channels | Echo",
  nav: "Channels",
  title: "Channels",
  description:
    "WhatsApp numbers that receive conversations for this organization.",
  add: "Add channel",
  loading: "Loading channels.",
  refreshing: "Refreshing",
  loadError: "Channels could not be loaded.",
  retry: "Try again",
  emptyTitle: "No number connected",
  emptyBody: "Connect a Twilio number so Echo can answer on WhatsApp.",
  live: "Live",
  reconnecting: "Reconnecting",
  recommended: "Recommended",
  betaSoon: "Beta — coming soon",
  chooseTitle: "How do you want to connect?",
  officialTitle: "Official WhatsApp (Twilio)",
  officialBody:
    "Echo checks the Account SID, auth token, and number with Twilio before saving.",
  qrTitle: "Connect with a QR code",
  qrBody: "Uses unofficial WhatsApp Web. Not available yet.",
  qrBodyEnabled:
    "Scan a QR code from this browser. The phone should stay online.",
  beta: "Beta",
  qrWaiting: "Waiting for the QR code.",
  qrScan: "On the phone, open WhatsApp, Linked devices, and scan this code.",
  qrRisk:
    "This path uses WhatsApp Web. Keep the phone nearby until it connects.",
  pairingPhone: "Phone number",
  pairingRequest: "Or pair with a code",
  pairingWaiting: "Enter this code in WhatsApp under Linked devices.",
  pairingSubmit: "Request code",
  pairingSubmitting: "Requesting",
  baileysSubmit: "Start pairing",
  baileysSubmitting: "Starting",
  back: "Back",
  cancel: "Cancel",
  displayName: "Name",
  displayNamePlaceholder: "Main support",
  accountSid: "Account SID",
  authToken: "Auth token",
  tokenHint:
    "Echo validates it with Twilio and stores it encrypted. It is not shown again.",
  address: "Number",
  addressHint: "International format, with +. Example: +5511999999999",
  inboxId: "Inbox",
  inboxHint: "Optional label used to group this number.",
  inboxPlaceholder: "general",
  inboxEmpty: "No inbox",
  submit: "Validate and connect",
  submitting: "Validating",
  successTitle: "Number connected",
  successBody:
    "In the Twilio console, open this number and paste the URL below into the incoming message webhook.",
  webhookLabel: "Webhook URL",
  copyWebhook: "Copy URL",
  copied: "Copied",
  done: "Done",
  edit: "Edit",
  save: "Save",
  saving: "Saving",
  remove: "Remove",
  confirmRemove: "Remove this number?",
  confirmRemoveBody:
    "Past conversations stay. Echo stops sending and receiving on it.",
  confirm: "Confirm removal",
  activate: "Activate",
  details: "Details",
  hideDetails: "Hide details",
  connectedSentence: "This number is receiving messages.",
  pendingSentence: "Waiting for Twilio to finish connecting.",
  disabledSentence: "Turned off. Past conversations stay, with no new sending.",
  lastConnected: "Last connection",
  noLastConnection: "No connection recorded yet.",
  updatedAt: "Updated",
  lastError: "Last error",
  noLastError: "No recent error.",
  provider: {
    twilio: "Twilio",
    baileys: "WhatsApp via QR · Beta",
    meta_cloud: "Meta Cloud API",
  },
  status: {
    active: "Connected",
    pending: "Pending",
    disabled: "Off",
  },
  session: {
    connecting: "Connecting",
    qr_pending: "Waiting for QR",
    pairing_code_pending: "Waiting for code",
    connected: "Connected",
    disconnected: "Disconnected",
    logged_out: "Signed out",
    banned_suspected: "Possible block",
  },
  validation: {
    displayName: "Enter a name.",
    accountSid: "The Account SID starts with AC and has 34 characters.",
    authToken: "Enter the auth token.",
    address: "Use the international format, with +. Example: +5511999999999",
  },
  verification: {
    sender_not_found:
      "Twilio could not find this WhatsApp number on the account.",
    sender_not_online: "The number exists, but it is not online in Twilio yet.",
    account_not_active: "The Twilio account is not active.",
    invalid_sandbox_address: "For the sandbox, use the number +14155238886.",
    provider_request_failed:
      "Echo could not validate the credentials with Twilio. Check the Account SID and auth token.",
  },
  errors: {
    routingConflict: "This number is already in use by another organization.",
    sessionExists: "This organization already has a QR session open.",
    pairingRequired: "Pair this number again before turning it on.",
    invalid: "Review the fields and try again.",
    generic: "The channel could not be saved.",
  },
}

const ptBR = {
  metaTitle: "Canais | Echo",
  nav: "Canais",
  title: "Canais",
  description:
    "Números de WhatsApp que recebem as conversas desta organização.",
  add: "Adicionar canal",
  loading: "Carregando canais.",
  refreshing: "Atualizando",
  loadError: "Não foi possível carregar os canais.",
  retry: "Tentar de novo",
  emptyTitle: "Nenhum número conectado",
  emptyBody: "Conecte um número da Twilio para a Echo atender no WhatsApp.",
  live: "Ao vivo",
  reconnecting: "Reconectando",
  recommended: "Recomendado",
  betaSoon: "Beta — em breve",
  chooseTitle: "Como você quer conectar?",
  officialTitle: "WhatsApp oficial (Twilio)",
  officialBody:
    "A Echo confere o Account SID, o token e o número na Twilio antes de salvar.",
  qrTitle: "Conectar com QR code",
  qrBody: "Usa o WhatsApp Web não oficial. Ainda não está disponível.",
  qrBodyEnabled:
    "Escaneie um QR code neste navegador. O celular precisa ficar online.",
  beta: "Beta",
  qrWaiting: "Aguardando o QR code.",
  qrScan:
    "No celular, abra o WhatsApp, Aparelhos conectados, e escaneie este código.",
  qrRisk:
    "Este caminho usa o WhatsApp Web. Deixe o celular por perto até conectar.",
  pairingPhone: "Número",
  pairingRequest: "Ou parear com um código",
  pairingWaiting: "Digite este código no WhatsApp, em Aparelhos conectados.",
  pairingSubmit: "Pedir código",
  pairingSubmitting: "Pedindo",
  baileysSubmit: "Começar pareamento",
  baileysSubmitting: "Iniciando",
  back: "Voltar",
  cancel: "Cancelar",
  displayName: "Nome",
  displayNamePlaceholder: "Suporte principal",
  accountSid: "Account SID",
  authToken: "Auth token",
  tokenHint:
    "A Echo valida na Twilio e guarda o token criptografado. Ele não aparece de novo.",
  address: "Número",
  addressHint: "Formato internacional, com +. Ex.: +5511999999999",
  inboxId: "Inbox",
  inboxHint: "Rótulo opcional para agrupar este número.",
  inboxPlaceholder: "geral",
  inboxEmpty: "Sem inbox",
  submit: "Validar e conectar",
  submitting: "Validando",
  successTitle: "Número conectado",
  successBody:
    "No console da Twilio, abra este número e cole a URL abaixo no webhook de mensagens recebidas.",
  webhookLabel: "URL do webhook",
  copyWebhook: "Copiar URL",
  copied: "Copiado",
  done: "Concluir",
  edit: "Editar",
  save: "Salvar",
  saving: "Salvando",
  remove: "Remover",
  confirmRemove: "Remover este número?",
  confirmRemoveBody:
    "As conversas antigas ficam. A Echo para de enviar e receber por ele.",
  confirm: "Confirmar remoção",
  activate: "Ativar",
  details: "Detalhes",
  hideDetails: "Ocultar detalhes",
  connectedSentence: "Este número está recebendo mensagens.",
  pendingSentence: "Aguardando a Twilio concluir a conexão.",
  disabledSentence:
    "Desativado. As conversas antigas permanecem, sem envio novo.",
  lastConnected: "Última conexão",
  noLastConnection: "Ainda não há registro de conexão.",
  updatedAt: "Atualizado",
  lastError: "Último erro",
  noLastError: "Nenhum erro recente.",
  provider: {
    twilio: "Twilio",
    baileys: "WhatsApp via QR · Beta",
    meta_cloud: "Meta Cloud API",
  },
  status: {
    active: "Conectado",
    pending: "Pendente",
    disabled: "Desativado",
  },
  session: {
    connecting: "Conectando",
    qr_pending: "Aguardando QR",
    pairing_code_pending: "Aguardando código",
    connected: "Conectado",
    disconnected: "Desconectado",
    logged_out: "Sessão encerrada",
    banned_suspected: "Possível bloqueio",
  },
  validation: {
    displayName: "Informe um nome.",
    accountSid: "O Account SID começa com AC e tem 34 caracteres.",
    authToken: "Informe o Auth token.",
    address: "Use o formato internacional, com +. Ex.: +5511999999999",
  },
  verification: {
    sender_not_found:
      "A Twilio não encontrou esse número de WhatsApp nesta conta.",
    sender_not_online: "O número existe, mas ainda não está online na Twilio.",
    account_not_active: "A conta Twilio não está ativa.",
    invalid_sandbox_address: "No sandbox, use o número +14155238886.",
    provider_request_failed:
      "Não foi possível validar as credenciais na Twilio. Confira o Account SID e o Auth token.",
  },
  errors: {
    routingConflict: "Esse número já está em uso em outra organização.",
    sessionExists: "Esta organização já tem uma sessão de QR aberta.",
    pairingRequired: "Pareie este número de novo antes de ativá-lo.",
    invalid: "Revise os campos e tente de novo.",
    generic: "Não foi possível salvar o canal.",
  },
} satisfies typeof en

export type ChannelsCopy = typeof en

export const channelsCopy: Record<ChannelsLocale, ChannelsCopy> = {
  en,
  "pt-BR": ptBR,
}

export function resolveChannelsLocale(): ChannelsLocale {
  if (typeof document === "undefined") return "en"
  const choice = readLanguageCookie(document.cookie)
  if (choice === "pt-br") return "pt-BR"
  if (choice === "en") return "en"
  if (
    typeof navigator !== "undefined" &&
    prefersPortuguese(navigator.language)
  ) {
    return "pt-BR"
  }
  return "en"
}

export function channelsNavLabel(): string {
  return channelsCopy[resolveChannelsLocale()].nav
}

export function useChannelsCopy() {
  const [locale] = useState(resolveChannelsLocale)
  return { locale, copy: channelsCopy[locale] }
}
