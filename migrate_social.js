require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function run() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS social_platform_stats (
      id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      platform_id     TEXT UNIQUE NOT NULL,
      platform_name   TEXT NOT NULL,
      followers       INT  DEFAULT 0,
      follower_growth FLOAT DEFAULT 0,
      reach           INT  DEFAULT 0,
      engagement      FLOAT DEFAULT 0,
      leads           INT  DEFAULT 0,
      posts           INT  DEFAULT 0,
      likes           INT  DEFAULT 0,
      comments        INT  DEFAULT 0,
      score           INT  DEFAULT 0,
      best_time       TEXT DEFAULT '',
      updated_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_by      TEXT DEFAULT 'manual'
    )
  `);
  console.log('Table created ✓');
  const platforms = [
    { id: 'instagram', name: 'Instagram',    score: 87, bestTime: 'Tue & Thu 8-9 AM' },
    { id: 'tiktok',    name: 'TikTok',        score: 79, bestTime: 'Fri & Sat 7-9 PM' },
    { id: 'linkedin',  name: 'LinkedIn',      score: 91, bestTime: 'Mon & Wed 9 AM'   },
    { id: 'facebook',  name: 'Facebook',      score: 62, bestTime: 'Wed 12 PM'        },
    { id: 'youtube',   name: 'YouTube',       score: 74, bestTime: 'Sat & Sun 10 AM'  },
    { id: 'rednote',   name: 'RedNote (XHS)', score: 68, bestTime: 'Wed & Sun 8 PM'   },
    { id: 'mailchimp', name: 'Mailchimp',     score: 83, bestTime: 'Tue 10 AM'        },
  ];
  for (const p of platforms) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO social_platform_stats (platform_id,platform_name,score,best_time)
       VALUES ($1,$2,$3,$4) ON CONFLICT (platform_id) DO NOTHING`,
      p.id, p.name, p.score, p.bestTime
    );
  }
  const rows = await prisma.$queryRawUnsafe('SELECT platform_id FROM social_platform_stats ORDER BY platform_id');
  console.log('Rows in DB:', rows.map(r => r.platform_id).join(', '));
  await prisma.$disconnect();
}
run().catch(e => { console.error(e.message); process.exit(1); });
