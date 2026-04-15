/**
 * Envicion OS — Lark Chat ID Fetcher
 * Run: node scripts/get-lark-chat-ids.mjs
 *
 * This script:
 *  1. Gets an access token using your LARK_APP_ID + LARK_APP_SECRET
 *  2. Lists all group chats the bot is a member of
 *  3. Prints the chat IDs so you can paste them into .env
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

// ── Load .env manually (no dotenv dependency needed) ──────────────────────────
const envPath = resolve(process.cwd(), '.env')
const envVars = {}
try {
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [key, ...rest] = trimmed.split('=')
    envVars[key.trim()] = rest.join('=').trim()
  }
} catch {
  console.error('Could not read .env — make sure you run this from the project root.')
  process.exit(1)
}

const APP_ID     = envVars.LARK_APP_ID
const APP_SECRET = envVars.LARK_APP_SECRET
const BASE       = 'https://open.larksuite.com/open-apis'

if (!APP_ID || !APP_SECRET) {
  console.error('LARK_APP_ID and LARK_APP_SECRET must be set in .env')
  process.exit(1)
}

// ── Step 1: Get tenant access token ──────────────────────────────────────────
console.log('\n🔑  Getting Lark access token...')
const tokenRes = await fetch(`${BASE}/auth/v3/tenant_access_token/internal`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
})
const tokenData = await tokenRes.json()

if (tokenData.code !== 0) {
  console.error('❌  Auth failed:', tokenData)
  process.exit(1)
}

const token = tokenData.tenant_access_token
console.log('✅  Token obtained.\n')

// ── Step 2: List all chats the bot is in ─────────────────────────────────────
console.log('📋  Fetching chat list...')
const chatsRes = await fetch(`${BASE}/im/v1/chats?page_size=50`, {
  headers: { Authorization: `Bearer ${token}` },
})
const chatsData = await chatsRes.json()

if (chatsData.code !== 0) {
  console.error('❌  Failed to list chats:', chatsData)
  console.log('\n💡  Make sure you have added the Envicion OS bot to your group chats.')
  console.log('    In each group: click ⚙️ Settings → Bots → Add Bot → search "Envicion OS"\n')
  process.exit(1)
}

const chats = chatsData.data?.items ?? []

if (chats.length === 0) {
  console.log('⚠️   No chats found. The bot has not been added to any groups yet.')
  console.log('\n    Steps:')
  console.log('    1. Open a group chat in Lark')
  console.log('    2. Click ⚙️  Settings (top right) → Bots → Add Bot')
  console.log('    3. Search for "Envicion OS" and add it')
  console.log('    4. Repeat for each team channel')
  console.log('    5. Run this script again\n')
  process.exit(0)
}

// ── Step 3: Print results ─────────────────────────────────────────────────────
console.log(`Found ${chats.length} chat(s):\n`)
console.log('─'.repeat(70))
for (const chat of chats) {
  console.log(`Name:    ${chat.name}`)
  console.log(`Chat ID: ${chat.chat_id}`)
  console.log(`Type:    ${chat.chat_type}`)
  console.log('─'.repeat(70))
}

// ── Step 4: Suggest .env values ───────────────────────────────────────────────
console.log('\n📝  Copy the relevant chat IDs into your .env:\n')
console.log('LARK_CHANNEL_CREATIVE=    # paste the Creative / Design team chat ID')
console.log('LARK_CHANNEL_CS=          # paste the Client Servicing chat ID')
console.log('LARK_CHANNEL_SALES=       # paste the Sales / Marketing chat ID')
console.log('LARK_CHANNEL_MANAGEMENT=  # paste the Management / All Staff chat ID')
console.log('')

// ── Step 5: Also get Drive root folder token via Lark Drive API ───────────────
console.log('📁  Fetching root Drive folder info (so you can pick your project folder)...')
const driveRes = await fetch(`${BASE}/drive/v1/files?folder_token=&page_size=20`, {
  headers: { Authorization: `Bearer ${token}` },
})
const driveData = await driveRes.json()

if (driveData.code === 0) {
  const files = driveData.data?.files ?? []
  if (files.length > 0) {
    console.log('\nRoot Drive items (folders shown with their token):\n')
    console.log('─'.repeat(70))
    for (const f of files) {
      if (f.type === 'folder') {
        console.log(`Folder: ${f.name}`)
        console.log(`Token:  ${f.token}`)
        console.log('─'.repeat(70))
      }
    }
    console.log('\nSet LARK_ROOT_FOLDER_TOKEN= to the token of your "Envicion OS Projects" folder.')
  }
} else {
  console.log('⚠️   Could not fetch Drive root — make sure drive:drive permission is enabled in your Lark app.')
}

console.log('\n✅  Done! Once you fill in the .env values, restart the dev server.\n')
