import PusherClient from 'pusher-js'

let client: PusherClient | null = null

export function getPusherClient(): PusherClient {
  if (client) return client

  client = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? 'ap1',
    authEndpoint: '/api/pusher/auth',
  })

  return client
}

export const pusherClient = typeof window !== 'undefined' ? getPusherClient() : null
