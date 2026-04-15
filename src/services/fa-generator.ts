import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Font,
} from '@react-pdf/renderer'
import { prisma } from '@/lib/db'

// Register a standard font (built-in Helvetica works without external files)
Font.register({
  family: 'Helvetica',
  fonts: [],
})

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    padding: 48,
    fontSize: 10,
    color: '#1a1a1a',
  },
  coverPage: {
    fontFamily: 'Helvetica',
    backgroundColor: '#0a0a14',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 60,
  },
  coverTitle: {
    fontSize: 32,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 16,
  },
  coverSubtitle: {
    fontSize: 14,
    color: '#a1a1aa',
    textAlign: 'center',
    marginBottom: 8,
  },
  coverCode: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#818cf8',
    textAlign: 'center',
    marginBottom: 8,
  },
  coverDate: {
    fontSize: 10,
    color: '#71717a',
    textAlign: 'center',
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a1a',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: '1px solid #e4e4e7',
  },
  table: {
    width: '100%',
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f4f4f5',
    padding: '8 10',
    borderBottom: '1px solid #d4d4d8',
  },
  tableRow: {
    flexDirection: 'row',
    padding: '7 10',
    borderBottom: '1px solid #f4f4f5',
  },
  tableRowAlt: {
    flexDirection: 'row',
    padding: '7 10',
    borderBottom: '1px solid #f4f4f5',
    backgroundColor: '#fafafa',
  },
  colItem: { flex: 3, fontSize: 9 },
  colQty: { flex: 1, fontSize: 9, textAlign: 'center' },
  colVersion: { flex: 1, fontSize: 9, textAlign: 'center' },
  colApprovedBy: { flex: 2, fontSize: 9 },
  colApprovedAt: { flex: 2, fontSize: 9 },
  headerText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#52525b' },
  itemCard: {
    border: '1px solid #e4e4e7',
    borderRadius: 4,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#fafafa',
  },
  itemCardTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#18181b',
    marginBottom: 4,
  },
  itemCardMeta: {
    fontSize: 9,
    color: '#71717a',
    marginBottom: 2,
  },
  approvalBadge: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    padding: '3 8',
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  revisionEntry: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottom: '1px solid #f4f4f5',
    gap: 8,
  },
  revisionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e4e4e7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#52525b',
    flexShrink: 0,
  },
  revisionContent: { flex: 1 },
  revisionFeedback: { fontSize: 9, color: '#3f3f46', marginBottom: 2 },
  revisionMeta: { fontSize: 8, color: '#a1a1aa' },
  disclaimer: {
    border: '1px solid #fbbf24',
    borderRadius: 4,
    padding: 16,
    backgroundColor: '#fffbeb',
    marginBottom: 24,
  },
  disclaimerTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#92400e',
    marginBottom: 8,
  },
  disclaimerText: {
    fontSize: 8.5,
    color: '#78350f',
    lineHeight: 1.6,
    marginBottom: 4,
  },
  signOffBox: {
    border: '1px solid #d4d4d8',
    borderRadius: 4,
    padding: 16,
    marginTop: 16,
  },
  signOffTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#18181b',
    marginBottom: 12,
  },
  signOffRow: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 8,
  },
  signOffLabel: {
    fontSize: 9,
    color: '#71717a',
    width: 100,
    flexShrink: 0,
  },
  signOffValue: {
    fontSize: 9,
    color: '#18181b',
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: '1px solid #e4e4e7',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: '#a1a1aa',
  },
  pageNumber: {
    fontSize: 8,
    color: '#a1a1aa',
  },
})

interface FAItem {
  id: string
  itemType: string
  description: string | null
  quantity: number
  revisionCount: number
  revisionLimit: number
  status: string
  revisions: Array<{
    revisionNumber: number
    feedback: string
    requestedBy: { name: string }
    createdAt: Date
    status: string
  }>
  latestFile: {
    version: number
    filename: string
    url: string
    uploadedBy: { name: string }
    createdAt: Date
  } | null
  qcChecks: Array<{
    passed: boolean
    notes: string | null
    checkedBy: { name: string }
    createdAt: Date
  }>
}

interface FAProject {
  id: string
  code: string
  client: { companyName: string; contactPerson: string; email: string } | null
  deliverableItems: FAItem[]
  faSignOffs: Array<{
    clientName: string
    signedAt: Date | null
    disclaimerAccepted: boolean
    bothPartiesChecked: boolean
    clientIP: string | null
  }>
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  BANNER: 'Banner',
  BROCHURE: 'Brochure',
  LOGO: 'Logo',
  SOCIAL: 'Social Media',
  PRINT: 'Print',
  THREE_D: '3D',
  VIDEO: 'Video',
  OTHER: 'Other',
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString('en-MY', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function CoverPage({ project }: { project: FAProject }) {
  return React.createElement(
    Page,
    { size: 'A4', style: styles.coverPage },
    React.createElement(
      View,
      { style: styles.coverContent },
      React.createElement(Text, { style: styles.coverTitle }, 'FINAL ARTWORK'),
      React.createElement(Text, { style: styles.coverCode }, project.code),
      React.createElement(
        Text,
        { style: styles.coverSubtitle },
        project.client?.companyName ?? 'Client'
      ),
      React.createElement(
        Text,
        { style: styles.coverDate },
        `Generated: ${formatDate(new Date())}`
      )
    )
  )
}

function SummaryPage({ project }: { project: FAProject }) {
  const approvedItems = project.deliverableItems.filter(
    (i) => i.status === 'DELIVERED' || i.status === 'APPROVED' || i.status === 'FA_SIGNED'
  )

  return React.createElement(
    Page,
    { size: 'A4', style: styles.page },
    React.createElement(Text, { style: styles.sectionTitle }, 'Artwork Summary'),

    React.createElement(
      View,
      { style: styles.table },
      // Header
      React.createElement(
        View,
        { style: styles.tableHeader },
        React.createElement(Text, { style: [styles.colItem, styles.headerText] }, 'Item'),
        React.createElement(Text, { style: [styles.colQty, styles.headerText] }, 'Qty'),
        React.createElement(Text, { style: [styles.colVersion, styles.headerText] }, 'Version'),
        React.createElement(
          Text,
          { style: [styles.colApprovedBy, styles.headerText] },
          'Uploaded By'
        ),
        React.createElement(
          Text,
          { style: [styles.colApprovedAt, styles.headerText] },
          'Date'
        )
      ),
      // Rows
      ...approvedItems.map((item, idx) =>
        React.createElement(
          View,
          { key: item.id, style: idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt },
          React.createElement(
            Text,
            { style: styles.colItem },
            `${ITEM_TYPE_LABELS[item.itemType] ?? item.itemType}${item.description ? ` — ${item.description}` : ''}`
          ),
          React.createElement(Text, { style: styles.colQty }, String(item.quantity)),
          React.createElement(
            Text,
            { style: styles.colVersion },
            item.latestFile ? `v${item.latestFile.version}` : '—'
          ),
          React.createElement(
            Text,
            { style: styles.colApprovedBy },
            item.latestFile?.uploadedBy.name ?? '—'
          ),
          React.createElement(
            Text,
            { style: styles.colApprovedAt },
            item.latestFile ? formatDate(item.latestFile.createdAt) : '—'
          )
        )
      )
    ),

    React.createElement(
      View,
      { style: styles.footer },
      React.createElement(Text, { style: styles.footerText }, `Envision OS — ${project.code}`),
      React.createElement(
        Text,
        { style: styles.footerText, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `Page ${pageNumber} of ${totalPages}`
        } as Parameters<typeof React.createElement>[1]
      )
    )
  )
}

function ItemPage({ item, projectCode }: { item: FAItem; projectCode: string }) {
  const latestQC = [...item.qcChecks].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0]

  return React.createElement(
    Page,
    { size: 'A4', style: styles.page },
    React.createElement(
      Text,
      { style: styles.sectionTitle },
      `${ITEM_TYPE_LABELS[item.itemType] ?? item.itemType}${item.description ? ` — ${item.description}` : ''}`
    ),

    React.createElement(
      View,
      { style: styles.itemCard },
      React.createElement(
        Text,
        { style: styles.itemCardTitle },
        item.latestFile?.filename ?? 'No file uploaded'
      ),
      React.createElement(
        Text,
        { style: styles.itemCardMeta },
        `Version: ${item.latestFile ? `v${item.latestFile.version}` : '—'}`
      ),
      React.createElement(
        Text,
        { style: styles.itemCardMeta },
        `Quantity: ${item.quantity}`
      ),
      React.createElement(
        Text,
        { style: styles.itemCardMeta },
        `Revisions Used: ${item.revisionCount} / ${item.revisionLimit}`
      ),
      item.latestFile
        ? React.createElement(
            Text,
            { style: styles.itemCardMeta },
            `Uploaded: ${formatDateTime(item.latestFile.createdAt)} by ${item.latestFile.uploadedBy.name}`
          )
        : null,
      latestQC
        ? React.createElement(
            View,
            { style: styles.approvalBadge },
            React.createElement(
              Text,
              null,
              `QC ${latestQC.passed ? 'Passed' : 'Failed'} — ${latestQC.checkedBy.name}`
            )
          )
        : null
    ),

    // QC Notes
    latestQC?.notes
      ? React.createElement(
          View,
          { style: { marginBottom: 16 } },
          React.createElement(
            Text,
            { style: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 4, color: '#52525b' } },
            'QC Notes:'
          ),
          React.createElement(
            Text,
            { style: { fontSize: 9, color: '#3f3f46', lineHeight: 1.5 } },
            latestQC.notes
          )
        )
      : null,

    React.createElement(
      View,
      { style: styles.footer },
      React.createElement(Text, { style: styles.footerText }, `Envision OS — ${projectCode}`),
      React.createElement(
        Text,
        { style: styles.footerText,
          render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `Page ${pageNumber} of ${totalPages}`
        } as Parameters<typeof React.createElement>[1]
      )
    )
  )
}

function RevisionHistoryPage({ items, projectCode }: { items: FAItem[]; projectCode: string }) {
  return React.createElement(
    Page,
    { size: 'A4', style: styles.page },
    React.createElement(Text, { style: styles.sectionTitle }, 'Complete Revision History'),

    ...items.flatMap((item) => [
      React.createElement(
        Text,
        {
          key: `${item.id}-title`,
          style: {
            fontSize: 10,
            fontFamily: 'Helvetica-Bold',
            color: '#18181b',
            marginBottom: 8,
            marginTop: 12,
          },
        },
        `${ITEM_TYPE_LABELS[item.itemType] ?? item.itemType}${item.description ? ` — ${item.description}` : ''}`
      ),
      ...(item.revisions.length === 0
        ? [
            React.createElement(
              Text,
              { key: `${item.id}-none`, style: { fontSize: 9, color: '#a1a1aa', marginBottom: 8 } },
              'No revisions requested.'
            ),
          ]
        : item.revisions.map((rev) =>
            React.createElement(
              View,
              { key: `${item.id}-rev-${rev.revisionNumber}`, style: styles.revisionEntry },
              React.createElement(
                View,
                { style: styles.revisionNumber },
                React.createElement(Text, null, String(rev.revisionNumber))
              ),
              React.createElement(
                View,
                { style: styles.revisionContent },
                React.createElement(Text, { style: styles.revisionFeedback }, rev.feedback),
                React.createElement(
                  Text,
                  { style: styles.revisionMeta },
                  `${rev.requestedBy.name} — ${formatDateTime(rev.createdAt)} — Status: ${rev.status}`
                )
              )
            )
          )),
    ]),

    React.createElement(
      View,
      { style: styles.footer },
      React.createElement(Text, { style: styles.footerText }, `Envision OS — ${projectCode}`),
      React.createElement(
        Text,
        { style: styles.footerText,
          render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `Page ${pageNumber} of ${totalPages}`
        } as Parameters<typeof React.createElement>[1]
      )
    )
  )
}

function DisclaimerPage({
  project,
  signOff,
}: {
  project: FAProject
  signOff: FAProject['faSignOffs'][0] | null
}) {
  return React.createElement(
    Page,
    { size: 'A4', style: styles.page },
    React.createElement(Text, { style: styles.sectionTitle }, 'Disclaimer & Sign-Off Record'),

    React.createElement(
      View,
      { style: styles.disclaimer },
      React.createElement(Text, { style: styles.disclaimerTitle }, 'IMPORTANT DISCLAIMER'),
      React.createElement(
        Text,
        { style: styles.disclaimerText },
        'By signing off this Final Artwork (FA) package, you confirm that:'
      ),
      ...[
        '1. You have reviewed ALL artwork included in this FA package in full detail.',
        '2. All artwork dimensions, typography, colour values, and specifications have been verified.',
        '3. All brand guidelines have been correctly applied.',
        '4. All copy, text, and messaging have been reviewed and approved by the appropriate stakeholders in your organisation.',
        '5. All imagery, logos, and graphical elements are approved for use.',
        '6. You accept that any amendments required after this FA sign-off will constitute additional work subject to additional charges.',
        '7. Envision Software shall bear no responsibility for errors discovered after this sign-off has been completed.',
        '8. This signed FA constitutes a legally binding acceptance of the artwork as presented.',
      ].map((line, i) =>
        React.createElement(Text, { key: i, style: styles.disclaimerText }, line)
      )
    ),

    React.createElement(
      View,
      { style: styles.signOffBox },
      React.createElement(Text, { style: styles.signOffTitle }, 'Sign-Off Record'),

      signOff
        ? React.createElement(
            View,
            null,
            React.createElement(
              View,
              { style: styles.signOffRow },
              React.createElement(Text, { style: styles.signOffLabel }, 'Client Name:'),
              React.createElement(Text, { style: styles.signOffValue }, signOff.clientName)
            ),
            React.createElement(
              View,
              { style: styles.signOffRow },
              React.createElement(Text, { style: styles.signOffLabel }, 'Company:'),
              React.createElement(
                Text,
                { style: styles.signOffValue },
                project.client?.companyName ?? '—'
              )
            ),
            React.createElement(
              View,
              { style: styles.signOffRow },
              React.createElement(Text, { style: styles.signOffLabel }, 'Signed At:'),
              React.createElement(
                Text,
                { style: styles.signOffValue },
                signOff.signedAt ? formatDateTime(signOff.signedAt) : '—'
              )
            ),
            React.createElement(
              View,
              { style: styles.signOffRow },
              React.createElement(Text, { style: styles.signOffLabel }, 'IP Address:'),
              React.createElement(
                Text,
                { style: styles.signOffValue },
                signOff.clientIP ?? '—'
              )
            ),
            React.createElement(
              View,
              { style: styles.signOffRow },
              React.createElement(Text, { style: styles.signOffLabel }, 'Disclaimer:'),
              React.createElement(
                Text,
                { style: styles.signOffValue },
                signOff.disclaimerAccepted ? 'Accepted' : 'Not accepted'
              )
            ),
            React.createElement(
              View,
              { style: styles.signOffRow },
              React.createElement(Text, { style: styles.signOffLabel }, 'Both Parties:'),
              React.createElement(
                Text,
                { style: styles.signOffValue },
                signOff.bothPartiesChecked ? 'Confirmed' : 'Not confirmed'
              )
            )
          )
        : React.createElement(
            Text,
            { style: { fontSize: 9, color: '#a1a1aa', fontStyle: 'italic' } },
            'Awaiting client sign-off.'
          )
    ),

    React.createElement(
      View,
      { style: styles.footer },
      React.createElement(Text, { style: styles.footerText }, `Envision OS — ${project.code}`),
      React.createElement(
        Text,
        { style: styles.footerText,
          render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `Page ${pageNumber} of ${totalPages}`
        } as Parameters<typeof React.createElement>[1]
      )
    )
  )
}

function FADocument({ project }: { project: FAProject }) {
  const signOff = project.faSignOffs[0] ?? null

  return React.createElement(
    Document,
    {
      title: `Final Artwork — ${project.code}`,
      author: 'Envision OS',
      subject: `FA Package for ${project.client?.companyName ?? project.code}`,
    },
    React.createElement(CoverPage, { project }),
    React.createElement(SummaryPage, { project }),
    ...project.deliverableItems.map((item) =>
      React.createElement(ItemPage, { key: item.id, item, projectCode: project.code })
    ),
    React.createElement(RevisionHistoryPage, {
      items: project.deliverableItems,
      projectCode: project.code,
    }),
    React.createElement(DisclaimerPage, { project, signOff })
  )
}

export async function generateFAPdf(projectId: string): Promise<Buffer> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: true,
      faSignOffs: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      deliverableItems: {
        include: {
          revisions: {
            include: {
              requestedBy: { select: { name: true } },
            },
            orderBy: { revisionNumber: 'asc' },
          },
          fileVersions: {
            include: {
              uploadedBy: { select: { name: true } },
            },
            orderBy: { version: 'desc' },
            take: 1,
          },
          qcChecks: {
            include: {
              checkedBy: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!project) {
    throw new Error(`Project not found: ${projectId}`)
  }

  const faProject: FAProject = {
    id: project.id,
    code: project.code,
    client: project.client
      ? {
          companyName: project.client.companyName,
          contactPerson: project.client.contactPerson,
          email: project.client.email,
        }
      : null,
    faSignOffs: project.faSignOffs.map((s) => ({
      clientName: s.clientName,
      signedAt: s.signedAt,
      disclaimerAccepted: s.disclaimerAccepted,
      bothPartiesChecked: s.bothPartiesChecked,
      clientIP: s.clientIP,
    })),
    deliverableItems: project.deliverableItems.map((item) => ({
      id: item.id,
      itemType: item.itemType,
      description: item.description,
      quantity: item.quantity,
      revisionCount: item.revisionCount,
      revisionLimit: item.revisionLimit,
      status: item.status,
      revisions: item.revisions.map((r) => ({
        revisionNumber: r.revisionNumber,
        feedback: r.feedback,
        requestedBy: r.requestedBy,
        createdAt: r.createdAt,
        status: r.status,
      })),
      latestFile:
        item.fileVersions[0]
          ? {
              version: item.fileVersions[0].version,
              filename: item.fileVersions[0].filename,
              url: item.fileVersions[0].url,
              uploadedBy: item.fileVersions[0].uploadedBy,
              createdAt: item.fileVersions[0].createdAt,
            }
          : null,
      qcChecks: item.qcChecks.map((q) => ({
        passed: q.passed,
        notes: q.notes,
        checkedBy: q.checkedBy,
        createdAt: q.createdAt,
      })),
    })),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = React.createElement(FADocument, { project: faProject }) as any
  const pdfBuffer = await renderToBuffer(doc)
  return Buffer.from(pdfBuffer)
}
