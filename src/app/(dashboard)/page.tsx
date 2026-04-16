'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const ROLE_ROUTES: Record<string, string> = {
  ADMIN: '/command',
  CREATIVE_DIRECTOR: '/admin/workload',
  SENIOR_ART_DIRECTOR: '/admin/workload',
  SALES: '/sales',
  CLIENT_SERVICING: '/cs',
  JUNIOR_ART_DIRECTOR: '/designer',
  GRAPHIC_DESIGNER: '/designer',
  JUNIOR_DESIGNER: '/designer',
  DESIGNER_3D: '/designer',
  DIGITAL_MARKETING: '/designer',
  CLIENT: '/portal',
}

export default function DashboardIndex() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role) {
      const destination = ROLE_ROUTES[session.user.role] ?? '/command'
      router.replace(destination)
    }
  }, [status, session, router])

  return (
    <div className="flex items-center justify-center h-full">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6366f1] border-t-transparent" />
    </div>
  )
}
