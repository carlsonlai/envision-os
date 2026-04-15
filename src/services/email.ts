import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL ?? 'noreply@envicion.com'

export async function sendFAConfirmation(params: {
  clientEmail: string
  clientName: string
  projectCode: string
  signedAt: Date
  faDownloadUrl: string
}): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to: params.clientEmail,
    subject: `Final Artwork Signed — ${params.projectCode}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#111">Final Artwork Sign-Off Confirmed</h2>
        <p>Dear ${params.clientName},</p>
        <p>This email confirms that you have signed off on the final artwork for project <strong>${params.projectCode}</strong> on ${params.signedAt.toLocaleDateString('en-MY', { dateStyle: 'long' })}.</p>
        <p>You can download your signed FA document here:</p>
        <p><a href="${params.faDownloadUrl}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Download FA Document</a></p>
        <p style="color:#666;font-size:12px;margin-top:24px">This is an automated confirmation from Envision OS. Please retain this email for your records.</p>
      </div>
    `,
  })
}

export async function sendInvoiceEmail(params: {
  clientEmail: string
  clientName: string
  invoiceNumber: string
  amount: number
  dueDate: Date
  paymentLink: string
}): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to: params.clientEmail,
    subject: `Invoice ${params.invoiceNumber} — RM ${params.amount.toLocaleString()}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#111">Invoice ${params.invoiceNumber}</h2>
        <p>Dear ${params.clientName},</p>
        <p>Please find your invoice details below:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;border-bottom:1px solid #eee">Invoice Number</td><td style="padding:8px;border-bottom:1px solid #eee"><strong>${params.invoiceNumber}</strong></td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee">Amount Due</td><td style="padding:8px;border-bottom:1px solid #eee"><strong>RM ${params.amount.toLocaleString()}</strong></td></tr>
          <tr><td style="padding:8px">Due Date</td><td style="padding:8px"><strong>${params.dueDate.toLocaleDateString('en-MY', { dateStyle: 'long' })}</strong></td></tr>
        </table>
        <p><a href="${params.paymentLink}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Pay Now</a></p>
        <p style="color:#666;font-size:12px;margin-top:24px">If you have any questions, please contact your account manager.</p>
      </div>
    `,
  })
}

export async function sendUnbilledAlert(params: {
  csEmail: string
  projectCode: string
  hoursUnbilled: number
  amount: number
}): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to: params.csEmail,
    subject: `[Action Required] Unbilled Hours — ${params.projectCode}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#dc2626">Unbilled Hours Alert</h2>
        <p>Project <strong>${params.projectCode}</strong> has unbilled hours that require your action.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;border-bottom:1px solid #eee">Unbilled Hours</td><td style="padding:8px;border-bottom:1px solid #eee"><strong>${params.hoursUnbilled}h</strong></td></tr>
          <tr><td style="padding:8px">Estimated Value</td><td style="padding:8px"><strong>RM ${params.amount.toLocaleString()}</strong></td></tr>
        </table>
        <p>Please raise the invoice as soon as possible to avoid cash flow delays.</p>
      </div>
    `,
  })
}

export async function sendNewLeadNotification(params: {
  salesEmail: string
  leadName: string
  company: string
  score: string
  source: string
}): Promise<void> {
  const scoreColor = params.score === 'HOT' ? '#dc2626' : params.score === 'WARM' ? '#d97706' : '#3b82f6'

  await resend.emails.send({
    from: FROM,
    to: params.salesEmail,
    subject: `New ${params.score} Lead — ${params.leadName} (${params.company})`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#111">New Lead Assigned</h2>
        <p>A new lead has been assigned to you:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;border-bottom:1px solid #eee">Name</td><td style="padding:8px;border-bottom:1px solid #eee"><strong>${params.leadName}</strong></td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee">Company</td><td style="padding:8px;border-bottom:1px solid #eee"><strong>${params.company}</strong></td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #eee">Score</td><td style="padding:8px;border-bottom:1px solid #eee"><strong style="color:${scoreColor}">${params.score}</strong></td></tr>
          <tr><td style="padding:8px">Source</td><td style="padding:8px">${params.source}</td></tr>
        </table>
        <p>Log in to Envision OS to take action on this lead.</p>
      </div>
    `,
  })
}
