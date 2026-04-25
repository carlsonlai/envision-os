#!/bin/bash
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
cd /Users/laichanchean/Desktop/Jobs/envision-os

echo "Pulling production environment variables from Vercel..."
npx --yes vercel env pull .env.production.local --environment=production 2>&1

if [ ! -f .env.production.local ]; then
  echo ""
  echo "ERROR: Could not pull production env vars. Make sure you are logged into Vercel CLI."
  echo "Run: npx vercel login"
  read -n 1
  exit 1
fi

echo ""
echo "Running Prisma seed against production database..."
set -a
source .env.production.local
set +a

npx --yes tsx ./prisma/seed.ts

echo ""
echo "Seed complete! Press any key to close."
read -n 1

# Clean up
rm -f .env.production.local
