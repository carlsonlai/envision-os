/**
 * Shared leave type and status colour maps used by:
 *  - /hr/leave/page.tsx   (admin view)
 *  - /my/leave/page.tsx   (employee view)
 */

export type LeaveType   = 'Annual Leave' | 'Sick Leave' | 'Emergency Leave' | 'Unpaid Leave'
export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export const LEAVE_TYPE_COLORS: Record<LeaveType, string> = {
  'Annual Leave':    'text-[#818cf8] border-[#6366f1]/30 bg-[#6366f1]/10',
  'Sick Leave':      'text-red-400   border-red-500/30   bg-red-500/10',
  'Emergency Leave': 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  'Unpaid Leave':    'text-zinc-400  border-zinc-600/30  bg-zinc-700/20',
}

export const LEAVE_STATUS_COLORS: Record<LeaveStatus, string> = {
  pending:  'text-amber-400   border-amber-500/30   bg-amber-500/10',
  approved: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  rejected: 'text-red-400     border-red-500/20     bg-red-500/5',
}
