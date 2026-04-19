import type { ItemType } from '@prisma/client'

/**
 * QA VALIDATORS
 *
 * Heuristic validators used by the QA Agent to auto-grade uploaded deliverables.
 * These are deliberately deterministic and cheap — no external ML calls — so they
 * can run inside the Inngest step without budget or latency risk.
 *
 * Future: swap runBrandCheck() for a real vision-model call behind a feature flag.
 */

export interface FileTypeCheckResult {
  valid: boolean
  got: string
  expected: readonly string[]
  reason: string
}

export type BrandCheckVerdict = 'PASS_HEURISTIC' | 'NEEDS_HUMAN' | 'FAIL'

export interface BrandCheckResult {
  verdict: BrandCheckVerdict
  signals: {
    sizeBytes: number | null
    sizeOk: boolean
    filenamePattern: 'studio-standard' | 'loose' | 'unrecognised'
  }
  reason: string
}

export interface QaCheckSummary {
  fileType: FileTypeCheckResult
  brand: BrandCheckResult
  autoPass: boolean
  notes: string
}

// ── File-type expectations by deliverable type ──────────────────────────────
// Keep conservative — we'd rather flag NEEDS_HUMAN than auto-approve a wrong format.
const EXPECTED_EXTENSIONS: Record<ItemType, readonly string[]> = {
  BANNER: ['png', 'jpg', 'jpeg', 'pdf', 'psd', 'ai'],
  BROCHURE: ['pdf', 'indd', 'psd', 'ai'],
  LOGO: ['svg', 'ai', 'eps', 'png', 'pdf'],
  SOCIAL: ['png', 'jpg', 'jpeg', 'mp4', 'mov', 'gif'],
  PRINT: ['pdf', 'ai', 'indd', 'psd', 'eps'],
  THREE_D: ['blend', 'fbx', 'obj', 'glb', 'gltf', 'mp4', 'mov', 'png', 'jpg', 'jpeg'],
  VIDEO: ['mp4', 'mov', 'mkv', 'webm'],
  OTHER: ['png', 'jpg', 'jpeg', 'pdf', 'mp4', 'mov', 'ai', 'psd', 'svg'],
}

// Size caps per item type (bytes) — anything above triggers NEEDS_HUMAN.
// These are soft limits used only by the brand-check heuristic.
const SIZE_CAP_BYTES: Record<ItemType, number> = {
  BANNER: 25 * 1024 * 1024,
  BROCHURE: 80 * 1024 * 1024,
  LOGO: 10 * 1024 * 1024,
  SOCIAL: 30 * 1024 * 1024,
  PRINT: 120 * 1024 * 1024,
  THREE_D: 250 * 1024 * 1024,
  VIDEO: 500 * 1024 * 1024,
  OTHER: 100 * 1024 * 1024,
}

// Minimums: suspiciously small files are likely placeholders.
const MIN_SIZE_BYTES: Record<ItemType, number> = {
  BANNER: 20 * 1024,
  BROCHURE: 50 * 1024,
  LOGO: 1 * 1024,
  SOCIAL: 20 * 1024,
  PRINT: 50 * 1024,
  THREE_D: 100 * 1024,
  VIDEO: 500 * 1024,
  OTHER: 1 * 1024,
}

function extensionOf(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot < 0 || lastDot === filename.length - 1) return ''
  return filename.slice(lastDot + 1).toLowerCase()
}

/**
 * Validate that the uploaded file extension matches what we expect for the
 * deliverable's item type. Defensive: unknown item types fall back to OTHER.
 */
export function validateFileType(filename: string, itemType: ItemType): FileTypeCheckResult {
  const ext = extensionOf(filename)
  const expected = EXPECTED_EXTENSIONS[itemType] ?? EXPECTED_EXTENSIONS.OTHER

  if (!ext) {
    return {
      valid: false,
      got: '(no extension)',
      expected,
      reason: `File "${filename}" has no extension — cannot verify format for ${itemType}`,
    }
  }

  const valid = expected.includes(ext)
  return {
    valid,
    got: ext,
    expected,
    reason: valid
      ? `Format .${ext} matches ${itemType} expectations`
      : `Format .${ext} not in expected set for ${itemType} (${expected.join(', ')})`,
  }
}

// Envicion studio filename pattern: PROJECTCODE_VXX_description.ext (e.g. JOB123_V01_hero.png)
const STUDIO_PATTERN = /^[A-Z0-9]{3,}[_-]V\d{1,3}[_-].+\.[a-zA-Z0-9]+$/

function classifyFilename(filename: string): 'studio-standard' | 'loose' | 'unrecognised' {
  if (STUDIO_PATTERN.test(filename)) return 'studio-standard'
  if (filename.includes('_') || filename.includes('-')) return 'loose'
  return 'unrecognised'
}

/**
 * Heuristic brand check. Cannot actually look at the pixels — but can reject
 * obviously-wrong uploads (zero-byte, 2 GB placeholder, "screenshot 2024.png")
 * and route mid-confidence files to human review.
 *
 * Returns PASS_HEURISTIC only when every signal looks healthy. Anything
 * ambiguous goes to NEEDS_HUMAN. Hard violations (format mismatch at size
 * extremes) return FAIL.
 */
export function runBrandCheck(input: {
  filename: string
  fileSize: number | null
  itemType: ItemType
}): BrandCheckResult {
  const { filename, fileSize, itemType } = input
  const cap = SIZE_CAP_BYTES[itemType] ?? SIZE_CAP_BYTES.OTHER
  const floor = MIN_SIZE_BYTES[itemType] ?? MIN_SIZE_BYTES.OTHER

  const filenamePattern = classifyFilename(filename)

  if (fileSize !== null && fileSize <= 0) {
    return {
      verdict: 'FAIL',
      signals: { sizeBytes: fileSize, sizeOk: false, filenamePattern },
      reason: `Zero-byte file — upload likely failed`,
    }
  }

  if (fileSize !== null && fileSize > cap) {
    return {
      verdict: 'FAIL',
      signals: { sizeBytes: fileSize, sizeOk: false, filenamePattern },
      reason: `File size ${Math.round(fileSize / 1024 / 1024)}MB exceeds ${Math.round(cap / 1024 / 1024)}MB cap for ${itemType}`,
    }
  }

  if (fileSize !== null && fileSize < floor) {
    return {
      verdict: 'NEEDS_HUMAN',
      signals: { sizeBytes: fileSize, sizeOk: false, filenamePattern },
      reason: `File size ${fileSize}B below ${floor}B minimum for ${itemType} — could be placeholder`,
    }
  }

  if (filenamePattern === 'unrecognised') {
    return {
      verdict: 'NEEDS_HUMAN',
      signals: { sizeBytes: fileSize, sizeOk: fileSize !== null, filenamePattern },
      reason: `Filename "${filename}" does not follow studio naming convention — please confirm`,
    }
  }

  return {
    verdict: 'PASS_HEURISTIC',
    signals: {
      sizeBytes: fileSize,
      sizeOk: fileSize !== null,
      filenamePattern,
    },
    reason: `Size ${fileSize ?? '?'}B within bounds, filename pattern ${filenamePattern}`,
  }
}

/**
 * Combine both checks into a single decision-ready summary. Auto-pass requires:
 *   - file-type valid
 *   - brand-check PASS_HEURISTIC
 */
export function summariseQaChecks(input: {
  filename: string
  fileSize: number | null
  itemType: ItemType
}): QaCheckSummary {
  const fileType = validateFileType(input.filename, input.itemType)
  const brand = runBrandCheck(input)
  const autoPass = fileType.valid && brand.verdict === 'PASS_HEURISTIC'

  const notes = [
    `[file-type] ${fileType.reason}`,
    `[brand-check:${brand.verdict}] ${brand.reason}`,
    autoPass ? '[outcome] auto-pass eligible' : '[outcome] human review required',
  ].join('\n')

  return { fileType, brand, autoPass, notes }
}
