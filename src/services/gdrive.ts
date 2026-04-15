/**
 * Google Drive service — single account (envicionstudiosdnbhd@gmail.com).
 *
 * Uses OAuth 2.0 refresh-token flow. Credentials come from Vercel env vars:
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 *   GOOGLE_REFRESH_TOKEN
 *   GDRIVE_TARGET_ACCOUNT   (for logging / sanity checks only)
 *
 * Scope: https://www.googleapis.com/auth/drive.file — per-file scope.
 * This means Drive only gives us access to files we create through this app,
 * not the user's existing Drive content. Safe for production.
 */

import { google, drive_v3 } from 'googleapis'
import { Readable } from 'stream'

const SCOPES = ['https://www.googleapis.com/auth/drive.file']

export type UploadInput = {
  name: string
  mimeType: string
  /** Raw bytes. Either a Buffer, Uint8Array, or Node Readable stream. */
  data: Buffer | Uint8Array | Readable
  /** Optional Drive folder ID to nest the upload into. */
  folderId?: string
}

export type DriveFileMeta = {
  id: string
  name: string
  mimeType: string
  size: number
  webViewLink: string | null
  webContentLink: string | null
  thumbnailLink: string | null
}

let cachedDrive: drive_v3.Drive | null = null

/** Lazy-initialise the Drive client. Throws clearly if env vars are missing. */
function getDriveClient(): drive_v3.Drive {
  if (cachedDrive) return cachedDrive

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Google Drive not configured — set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN',
    )
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
  oauth2.setCredentials({ refresh_token: refreshToken, scope: SCOPES.join(' ') })

  cachedDrive = google.drive({ version: 'v3', auth: oauth2 })
  return cachedDrive
}

/** Convert anything uploadable into a Readable stream for the Drive SDK. */
function toStream(data: Buffer | Uint8Array | Readable): Readable {
  if (data instanceof Readable) return data
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
  return Readable.from(buf)
}

/**
 * Upload a file to Drive and return its metadata.
 * The file is given `reader` access to anyone with the link so it can be
 * embedded in social posts / previewed in the Envicion OS UI.
 */
export async function uploadToDrive(input: UploadInput): Promise<DriveFileMeta> {
  const drive = getDriveClient()

  const create = await drive.files.create({
    requestBody: {
      name: input.name,
      mimeType: input.mimeType,
      parents: input.folderId ? [input.folderId] : undefined,
    },
    media: {
      mimeType: input.mimeType,
      body: toStream(input.data),
    },
    fields: 'id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink',
  })

  const file = create.data
  if (!file.id) throw new Error('Drive upload returned no file id')

  // Make link-shareable so previews/embeds work.
  try {
    await drive.permissions.create({
      fileId: file.id,
      requestBody: { role: 'reader', type: 'anyone' },
    })
  } catch {
    // Non-fatal — file still exists, just not publicly linkable.
  }

  // Re-fetch the file so links reflect the new permission.
  const fresh = await drive.files.get({
    fileId: file.id,
    fields: 'id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink',
  })
  const f = fresh.data

  return {
    id: f.id!,
    name: f.name || input.name,
    mimeType: f.mimeType || input.mimeType,
    size: Number(f.size ?? 0),
    webViewLink: f.webViewLink ?? null,
    webContentLink: f.webContentLink ?? null,
    thumbnailLink: f.thumbnailLink ?? null,
  }
}

/** Delete a Drive file by id. Safe to call on missing files. */
export async function deleteFromDrive(fileId: string): Promise<void> {
  const drive = getDriveClient()
  try {
    await drive.files.delete({ fileId })
  } catch (e: unknown) {
    const err = e as { code?: number }
    if (err.code !== 404) throw e
  }
}

/** Map a mimeType to an AssetKind-compatible string. */
export function kindFromMime(mime: string): 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' | 'OTHER' {
  if (mime.startsWith('image/')) return 'IMAGE'
  if (mime.startsWith('video/')) return 'VIDEO'
  if (mime.startsWith('audio/')) return 'AUDIO'
  if (
    mime === 'application/pdf' ||
    mime.startsWith('application/vnd.openxmlformats') ||
    mime.startsWith('application/msword') ||
    mime.startsWith('text/')
  ) {
    return 'DOCUMENT'
  }
  return 'OTHER'
}
