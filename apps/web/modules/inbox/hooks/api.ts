const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

export class InboxApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

export async function inboxApiRequest<T>(path: string): Promise<T> {
  const response = await fetch(new URL(path, apiUrl), {
    credentials: "include",
    headers: { accept: "application/json" },
  })

  if (!response.ok) {
    throw new InboxApiError(
      "The Support Inbox could not be loaded.",
      response.status
    )
  }

  return response.json() as Promise<T>
}

export function getInboxWebSocketUrl(): string {
  const url = new URL("/v1/support-conversations/events", apiUrl)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  return url.toString()
}
