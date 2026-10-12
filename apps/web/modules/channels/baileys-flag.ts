export function isBaileysPairingEnabled(): boolean {
  return import.meta.env.VITE_BAILEYS_PAIRING_ENABLED === "true"
}
