#!/bin/bash
# Launcher for envision-os local dev server
cd "$(dirname "$0")"
clear
echo "Starting envision-os dev server..."
echo "Open http://localhost:3000 in your browser when you see 'Ready'"
echo ""
npm run dev
