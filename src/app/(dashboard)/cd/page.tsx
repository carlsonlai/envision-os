import { redirect } from 'next/navigation'

// Creative Dashboard was merged into Team Workload (2026-04-16).
// This route is preserved for bookmarks and role-based default-landing
// links; all functionality (designer utilisation, at-risk items, active
// projects, alerts) now lives at /admin/workload.
export default function CDRedirect(): never {
  redirect('/admin/workload')
}
