import { Role } from '@prisma/client'

export const PRICING_ROLES: Role[] = [Role.ADMIN, Role.SALES, Role.CLIENT_SERVICING]

export const CLIENT_IDENTITY_ROLES: Role[] = [Role.ADMIN, Role.SALES, Role.CLIENT_SERVICING]

export const WORKLOAD_ROLES: Role[] = [
  Role.ADMIN,
  Role.CREATIVE_DIRECTOR,
  Role.SENIOR_ART_DIRECTOR,
  Role.CLIENT_SERVICING,
]

export const ASSIGN_ROLES: Role[] = [
  Role.ADMIN,
  Role.CREATIVE_DIRECTOR,
  Role.SENIOR_ART_DIRECTOR,
  Role.CLIENT_SERVICING,
]

export const DESIGNER_ROLES: Role[] = [
  Role.JUNIOR_ART_DIRECTOR,
  Role.GRAPHIC_DESIGNER,
  Role.JUNIOR_DESIGNER,
  Role.DESIGNER_3D,
  Role.DIGITAL_MARKETING,
]

function includesRole(roles: Role[], role: string): boolean {
  return (roles as string[]).includes(role)
}

export function canSeePricing(role: string): boolean {
  return includesRole(PRICING_ROLES, role)
}

export function canSeeClientIdentity(role: string): boolean {
  return includesRole(CLIENT_IDENTITY_ROLES, role)
}

export function canSeeWorkload(role: string): boolean {
  return includesRole(WORKLOAD_ROLES, role)
}

export function canAssignTasks(role: string): boolean {
  return includesRole(ASSIGN_ROLES, role)
}

export function isDesignerRole(role: string): boolean {
  return includesRole(DESIGNER_ROLES, role)
}

export function canManageClients(role: string): boolean {
  return includesRole([Role.ADMIN, Role.CLIENT_SERVICING, Role.SALES], role)
}

export function canViewAllProjects(role: string): boolean {
  return includesRole(
    [Role.ADMIN, Role.CREATIVE_DIRECTOR, Role.SENIOR_ART_DIRECTOR, Role.CLIENT_SERVICING],
    role
  )
}

export function canApproveQC(role: string): boolean {
  return includesRole([Role.ADMIN, Role.CREATIVE_DIRECTOR, Role.SENIOR_ART_DIRECTOR], role)
}

export function canWaiveRevision(role: string): boolean {
  return includesRole([Role.ADMIN, Role.CLIENT_SERVICING], role)
}

export function canViewFinancials(role: string): boolean {
  return includesRole([Role.ADMIN, Role.CLIENT_SERVICING, Role.SALES], role)
}
