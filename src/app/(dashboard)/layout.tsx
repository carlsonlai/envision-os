'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard,
  Briefcase,
  Users,
  TrendingUp,
  Palette,
  LogOut,
  ChevronRight,
  Bell,
  Zap,
  MessageCircle,
  Building2,
  BarChart3,
  Heart,
  Star,
  ListTodo,
  Menu,
  X,
  FolderKanban,
  Settings,
  HeartHandshake,
  CalendarDays,
  Bot,
  Megaphone,
  UserCheck,
  Brain,
  Share2,
  Link2,
  DollarSign,
  Award,
  Activity,
  Library,
  Cpu,
} from 'lucide-react'
interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  exact?: boolean
}

interface NavGroup {
  label?: string
  items: NavItem[]
}

// ââ Personal section reused across roles ââââââââââââââââââââââââââââââââââââ
const PERSONAL_GROUP: NavGroup = {
  label: 'Personal',
  items: [
    { href: '/my/payslips', label: 'My Payslips', icon: DollarSign },
    { href: '/my/leave',    label: 'My Leave',    icon: CalendarDays },
    { href: '/my/career',   label: 'Career Path', icon: Award },
    { href: '/calendar',    label: 'Calendar',    icon: CalendarDays },
  ],
}

const NAV_BY_ROLE: Record<string, NavGroup[]> = {

  // âââ ADMIN ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  ADMIN: [
    {
      items: [
        { href: '/command',        label: 'Command Centre', icon: Zap,          exact: true },
        { href: '/admin/projects', label: 'All Projects',   icon: FolderKanban },
        { href: '/calendar',       label: 'Calendar',       icon: CalendarDays },
      ],
    },
    {
      label: 'Client Services',
      items: [
        { href: '/cs',           label: 'CS Hub',        icon: HeartHandshake, exact: true },
        { href: '/cs/job-track', label: 'Job Track',     icon: ListTodo },
        { href: '/crm',          label: 'CRM & Client Health', icon: Heart },
      ],
    },
    {
      label: 'Creative',
      items: [
        { href: '/admin/workload', label: 'Team Workload',   icon: Activity, exact: true },
        { href: '/designer',       label: 'Designer Queue',  icon: Palette },
      ],
    },
    {
      label: 'Sales',
      items: [
        { href: '/sales',          label: 'Sales Pipeline',   icon: TrendingUp,   exact: true },
        { href: '/sales/personal', label: 'My Sales Command', icon: UserCheck },
        { href: '/sales/whatsapp', label: 'WhatsApp Inbox',   icon: MessageCircle },
        { href: '/admin/payment-collection', label: 'Payment Collection', icon: DollarSign },
        { href: '/kpi',            label: 'Agency KPI',       icon: BarChart3 },
      ],
    },
    {
      label: 'Social',
      items: [
        { href: '/social-hub',          label: 'Social Hub',      icon: Share2,      exact: true },
        { href: '/social-hub/create',   label: 'Content Studio',  icon: Zap },
        { href: '/social-hub/calendar', label: 'Social Calendar', icon: CalendarDays },
        { href: '/social-hub/analytics',label: 'Analytics',       icon: BarChart3 },
        { href: '/media',               label: 'Media Library',   icon: Library },
      ],
    },
    {
      label: 'HR',
      items: [
        { href: '/hr',        label: 'HR & Admin',       icon: Briefcase,   exact: true },
        { href: '/hr/leave',  label: 'Leave Management', icon: CalendarDays },
        { href: '/hr/payroll',label: 'Payroll',          icon: DollarSign },
      ],
    },
    {
      label: 'Team',
      items: [
        { href: '/admin/users',         label: 'Team Members',  icon: Users },
        { href: '/command/freelancers', label: 'Freelancers',   icon: Settings },
        { href: '/command/staff',       label: 'Staff Monitor', icon: Users },
        { href: '/command/reputation',  label: 'Reputation',    icon: Star },
        { href: '/command/ai-report',   label: 'AI Report',     icon: Brain },
      ],
    },
    {
      label: 'Autonomy',
      items: [
        { href: '/admin/brain',  label: 'AI Brain',      icon: Brain, exact: true },
        { href: '/admin/agents', label: 'Agent Control',  icon: Cpu,   exact: true },
      ],
    },
    {
      label: 'Integrations',
      items: [
        { href: '/admin/lark-import',    label: 'Lark Import',   icon: Link2 },
        { href: '/admin/social-connect', label: 'Social Connect',icon: Link2 },
      ],
    },
  ],

  // âââ SALES ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  SALES: [
    {
      items: [
        { href: '/sales',          label: 'Sales Pipeline', icon: TrendingUp,   exact: true },
        { href: '/sales/whatsapp', label: 'WhatsApp Inbox', icon: MessageCircle },
        { href: '/crm',            label: 'CRM',            icon: Building2 },
        { href: '/kpi',            label: 'My KPI',         icon: BarChart3 },
      ],
    },
    PERSONAL_GROUP,
  ],

  // âââ CLIENT SERVICING âââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // CS is the bridge between clients and creative â needs full visibility
  CLIENT_SERVICING: [
    {
      label: 'Client Management',
      items: [
        { href: '/cs/dashboard',  label: 'CS Dashboard',        icon: LayoutDashboard },
        { href: '/cs/job-track',  label: 'Job Track',           icon: ListTodo },
        { href: '/crm',           label: 'CRM & Client Health', icon: Heart },
        { href: '/admin/payment-collection', label: 'Payment Collection', icon: DollarSign },
      ],
    },
    {
      label: 'Creative Team',
      items: [
        { href: '/admin/workload', label: 'Team Workload',     icon: Activity },
        { href: '/designer',       label: 'Designer Progress',  icon: Palette },
        { href: '/calendar',       label: 'Calendar',           icon: CalendarDays },
      ],
    },
    {
      label: 'Performance',
      items: [
        { href: '/kpi',            label: 'My KPI',            icon: BarChart3 },
      ],
    },
    PERSONAL_GROUP,
  ],

  // âââ CREATIVE DIRECTOR ââââââââââââââââââââââââââââââââââââââââââââââââââââ
  CREATIVE_DIRECTOR: [
    {
      items: [
        { href: '/admin/workload', label: 'Team Workload',       icon: Activity, exact: true },
        { href: '/admin/projects', label: 'All Projects',        icon: Briefcase },
        { href: '/designer',       label: 'All Designer Tasks',  icon: ListTodo },
        { href: '/cs/job-track',   label: 'Job Track',           icon: ListTodo},
        { href: '/command/freelancers', label: 'Freelancers',    icon: Users },
        { href: '/calendar',       label: 'Calendar',            icon: CalendarDays},
        { href: '/kpi',            label: 'Team KPI',            icon: BarChart3 },
      ],
    },
    PERSONAL_GROUP,
  ],

  // âââ SENIOR ART DIRECTOR ââââââââââââââââââââââââââââââââââââââââââââââââââ
  SENIOR_ART_DIRECTOR: [
    {
      items: [
        { href: '/admin/workload', label: 'Team Workload',       icon: Activity, exact: true },
        { href: '/admin/projects', label: 'All Projects',        icon: Briefcase },
        { href: '/designer',       label: 'All Designer Tasks',  icon: ListTodo },
        { href: '/cs/job-track',   label: 'Job Track',           icon: ListTodo},
        { href: '/calendar',       label: 'Calendar',            icon: CalendarDays},
        { href: '/kpi',            label: 'Team KPI',            icon: BarChart3 },
      ],
    },
    PERSONAL_GROUP,
  ],

  // âââ JUNIOR ART DIRECTOR (sees all jobs, manages own) âââââââââââââââââââââ
  JUNIOR_ART_DIRECTOR: [
    {
      items: [
        { href: '/designer',       label: 'All Jobs',     icon: ListTodo },
        { href: '/admin/workload', label: 'Team Timeline', icon: Activity },
        { href: '/kpi',            label: 'My KPI',        icon: BarChart3 },
      ],
    },
    PERSONAL_GROUP,
  ],

  GRAPHIC_DESIGNER: [
    {
      items: [
        { href: '/designer', label: 'My Queue', icon: ListTodo },
        { href: '/kpi',      label: 'My KPI',   icon: BarChart3 },
      ],
    },
    PERSONAL_GROUP,
  ],

  JUNIOR_DESIGNER: [
    {
      items: [
        { href: '/designer', label: 'My Queue', icon: ListTodo },
        { href: '/kpi',      label: 'My KPI',   icon: BarChart3 },
      ],
    },
    PERSONAL_GROUP,
  ],

  DESIGNER_3D: [
    {
      items: [
        { href: '/designer', label: 'My Queue', icon: ListTodo },
        { href: '/kpi',      label: 'My KPI',   icon: BarChart3 },
      ],
    },
    PERSONAL_GROUP,
  ],

  DIGITAL_MARKETING: [
    {
      items: [
        { href: '/designer', label: 'My Campaigns', icon: TrendingUp },
        { href: '/social-hub/create',   label: 'Content Studio',  icon: Zap },
        { href: '/social-hub/analytics',label: 'Analytics',       icon: BarChart3 },
        { href: '/media',    label: 'Media Library', icon: Library },
        { href: '/kpi',      label: 'My KPI',        icon: BarChart3 },
      ],
    },
    PERSONAL_GROUP,
  ],

  MULTIMEDIA_DESIGNER: [
    {
      items: [
        { href: '/designer', label: 'My Queue',      icon: ListTodo },
        { href: '/media',    label: 'Media Library', icon: Library },
        { href: '/kpi',      label: 'My KPI',        icon: BarChart3 },
      ],
    },
    PERSONAL_GROUP,
  ],

  // âââ AI SALES AGENT âââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  AI_SALES_AGENT: [
    {
      label: 'AI Sales',
      items: [
        { href: '/ai-sales',           label: 'AI Sales Hub',   icon: Bot,          exact: true },
        { href: '/ai-sales/ads',       label: 'Ad Campaigns',   icon: Megaphone },
        { href: '/ai-sales/leads',     label: 'Lead Pipeline',  icon: TrendingUp },
        { href: '/ai-sales/prospects', label: 'Prospect Chat',  icon: MessageCircle },
      ],
    },
    {
      items: [
        { href: '/sales/whatsapp', label: 'WhatsApp Inbox', icon: MessageCircle },
        { href: '/crm',            label: 'CRM',            icon: Building2 },
        { href: '/kpi',            label: 'AI KPI',         icon: BarChart3 },
      ],
    },
  ],

  // âââ AI CS AGENT ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  AI_CS_AGENT: [
    {
      label: 'AI Client Services',
      items: [
        { href: '/ai-cs',        label: 'AI CS Hub',          icon: Bot,          exact: true },
        { href: '/ai-cs/comms',  label: 'Client Comms',       icon: MessageCircle },
        { href: '/crm',          label: 'CRM & Client Health', icon: UserCheck },
      ],
    },
    {
      items: [
        { href: '/cs',         label: 'Projects',   icon: Briefcase, exact: true },
        { href: '/cs/sentiment',label: 'Sentiment', icon: Heart },
        { href: '/crm',        label: 'CRM',        icon: Building2 },
        { href: '/kpi',        label: 'AI KPI',     icon: BarChart3 },
      ],
    },
  ],
}

// Flatten all groups into a single item list for a given role
function flatNavItems(groups: NavGroup[]): NavItem[] {
  return groups.flatMap(g => g.items)
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  CREATIVE_DIRECTOR: 'Creative Director',
  SENIOR_ART_DIRECTOR: 'Senior Art Director',
  SALES: 'Sales',
  CLIENT_SERVICING: 'Client Services',
  JUNIOR_ART_DIRECTOR: 'Junior Art Director',
  GRAPHIC_DESIGNER: 'Graphic Designer',
  JUNIOR_DESIGNER: 'Junior Designer',
  DESIGNER_3D: '3D Designer',
  DIGITAL_MARKETING: 'Digital Marketing',
  MULTIMEDIA_DESIGNER: 'Multimedia Designer',
  CLIENT: 'Client',
  AI_SALES_AGENT: 'AI Sales Agent',
  AI_CS_AGENT: 'AI CS Agent',
}

const ROLE_DEFAULT_ROUTES: Record<string, string> = {
  ADMIN: '/command',
  CREATIVE_DIRECTOR: '/admin/workload',
  SENIOR_ART_DIRECTOR: '/admin/workload',
  SALES: '/sales',
  CLIENT_SERVICING: '/cs/dashboard',
  JUNIOR_ART_DIRECTOR: '/designer',
  GRAPHIC_DESIGNER: '/designer',
  JUNIOR_DESIGNER: '/designer',
  DESIGNER_3D: '/designer',
  DIGITAL_MARKETING: '/designer',
  MULTIMEDIA_DESIGNER: '/designer',
  CLIENT: '/portal',
  AI_SALES_AGENT: '/ai-sales',
  AI_CS_AGENT: '/ai-cs',
}

export { ROLE_DEFAULT_ROUTES }

function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(item.href + '/')
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Auth + role-based redirects are now handled by `src/middleware.ts` at the
  // edge, so the layout no longer needs to gate rendering on `status`. We keep
  // a defensive client-side redirect for the rare case where the JWT expires
  // mid-session, but we DO NOT block FCP on it.
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // Close mobile nav on route change
  const prevPathname = useRef(pathname)
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      // Use requestAnimationFrame to avoid synchronous setState in effect
      requestAnimationFrame(() => setMobileOpen(false))
    }
  }, [pathname])

  // Render the dashboard shell immediately â middleware guarantees the user is
  // authenticated, so the worst case here is a one-frame render with empty nav
  // while `useSession()` rehydrates from the cookie. This keeps FCP fast.
  const userRole = session?.user?.role ?? ''
  const navGroups = NAV_BY_ROLE[userRole] ?? []
  const allNavItems = flatNavItems(navGroups)

  // Bottom nav: first 4 items for mobile
  const bottomNavItems = allNavItems.slice(0, 4)

  const currentPageLabel = allNavItems.find(n => isNavActive(pathname, n))?.label ?? 'Dashboard'

  return (
    <div className="flex h-screen bg-[#0a0a0f] text-zinc-100 overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar â desktop always visible, mobile slide-in */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-60 flex-shrink-0 flex flex-col border-r border-zinc-800/60 bg-[#0d0d14]
        transition-transform duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between gap-2.5 px-5 py-5 border-b border-zinc-800/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="text-sm font-semibold tracking-tight text-zinc-100">Envicion OS</span>
              <p className="text-[10px] text-zinc-500 leading-none mt-0.5">Agency Platform</p>
            </div>
          </div>
          <button type="button"
            onClick={() => setMobileOpen(false)}
            className="md:hidden text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav â grouped sections */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {navGroups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
              {/* Section header */}
              {group.label && (
                <p className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = isNavActive(pathname, item)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-all duration-150 ${
                        isActive
                          ? 'bg-[#6366f1]/15 text-[#818cf8] font-medium'
                          : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50'
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {item.label}
                      {isActive && <ChevronRight className="ml-auto h-3 w-3 opacity-60" />}
                    </Link>
                  )
                })}
              </div>
              {/* Divider between groups (not after last) */}
              {gi < navGroups.length - 1 && (
                <div className="mt-4 border-t border-zinc-800/40" />
              )}
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-zinc-800/60 p-3">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-xs font-semibold text-white flex-shrink-0">
              {session?.user?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-zinc-200">
                {session?.user?.name ?? ''}
              </p>
              <p className="truncate text-[10px] text-zinc-500">
                {userRole ? (ROLE_LABELS[userRole] ?? userRole) : ''}
              </p>
            </div>
            <button type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex-shrink-0 rounded p-1 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="flex h-12 items-center justify-between border-b border-zinc-800/60 bg-[#0d0d14] px-4 md:px-6 flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Mobile hamburger */}
            <button type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors mr-1"
            >
              <Menu className="h-4 w-4" />
            </button>
            <LayoutDashboard className="h-4 w-4 text-zinc-600 hidden sm:block" />
            <span className="text-sm text-zinc-500">{currentPageLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
              <Bell className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">{children}</main>

        {/* Mobile Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden border-t border-zinc-800 bg-[#0d0d14]">
          {bottomNavItems.map(item => {
            const Icon = item.icon
            const isActive = isNavActive(pathname, item)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                  isActive ? 'text-[#818cf8]' : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px]">{item.label.split(' ')[0]}</span>
              </Link>
            )
          })}
          {/* More button if > 4 nav items */}
          {allNavItems.length > 4 && (
            <button type="button"
              onClick={() => setMobileOpen(true)}
              className="flex flex-1 flex-col items-center justify-center py-2 gap-0.5 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <Menu className="h-5 w-5" />
              <span className="text-[10px]">More</span>
            </button>
          )}
        </nav>
      </div>
    </div>
  )
}
