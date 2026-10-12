import { env } from "@/config/env"

export function isBaileysPairingEnabled(): boolean {
  return env.BAILEYS_PAIRING_ENABLED === true
}
