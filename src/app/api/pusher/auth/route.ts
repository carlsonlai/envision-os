import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pusherServer } from '@/services/pusher'
import { logger, getErrorMessage } from '@/lib/logger'

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.text()
    const params = new URLSearchParams(body)
    const socketId = params.get('socket_id')
    const channelName = params.get('channel_name')

    if (!socketId || !channelName) {
      return NextResponse.json({ error: 'Missing socket_id or channel_name' }, { status: 400 })
    }

    const authResponse = pusherServer.authorizeChannel(socketId, channelName, {
      user_id: session.user.id,
      user_info: {
        name: session.user.name ?? '',
        role: session.user.role,
      },
    })

    return NextResponse.json(authResponse)
  } catch (error) {
    logger.error('POST /api/pusher/auth error:', { error: getErrorMessage(error) })
    return NextResponse.json({ error: 'Failed to authenticate channel' }, { status: 500 })
  }
}
