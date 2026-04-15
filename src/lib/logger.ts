type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogMeta {
  [key: string]: unknown
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return String(err)
}

function log(level: LogLevel, message: string, meta?: LogMeta): void {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    ...meta,
  }

  if (process.env.NODE_ENV === 'production') {
    process.stdout.write(JSON.stringify(entry) + '\n')
    return
  }

  const COLOR: Record<LogLevel, string> = {
    info:  '\x1b[36m',
    warn:  '\x1b[33m',
    error: '\x1b[31m',
    debug: '\x1b[90m',
  }
  const RESET = '\x1b[0m'
  const prefix = `${COLOR[level]}[${level.toUpperCase().padEnd(5)}]${RESET}`
  const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''
  // Use process.stdout/stderr directly to avoid recursive calls
  const out = level === 'error' ? process.stderr : process.stdout
  out.write(`${prefix} ${message}${metaStr}\n`)
}

export const logger = {
  info:  (message: string, meta?: LogMeta) => log('info',  message, meta),
  warn:  (message: string, meta?: LogMeta) => log('warn',  message, meta),
  error: (message: string, meta?: LogMeta) => log('error', message, meta),
  debug: (message: string, meta?: LogMeta) => log('debug', message, meta),
}

export { getErrorMessage }
