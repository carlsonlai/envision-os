import PusherClient from 'pusher-js'

let client: PusherClient | null = null
let warned = false

/**
 * Returns a singleton Pusher client, or null if the public key env var is
 * missing. Components MUST handle the null case so a missing env on Vercel
 * does not crash the entire page render.
 */
export function getPusherClient(): PusherClient | null {
  if (client) return client

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY

  if (!key) {
    if (!warned && typeof window !== 'undefined') {
      console.warn(
        '[pusher-client] NEXT_PUBLIC_PUSHER_KEY is not set. Realtime features are disabled.'
      )
      warned = true
    }
    return null
  }

  client = new PusherClient(key, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? 'ap1',
    authEndpoint: '/api/pusher/auth',
  })

  return client
}

/**
 * Backwards-compatible export. Lazy and defensive — never throws at import
 * time. Will be `null` on the server and when the public key is missing.
 */
export const pusherClient: PusherClient | null =
  typeof window !== 'undefined' ? getPusherClient() : null
