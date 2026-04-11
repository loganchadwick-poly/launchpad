#!/bin/bash

# Simple script to push to GitHub
# Run this with: bash push-to-github.sh

echo "🚀 Pushing to GitHub..."
echo ""
echo "When prompted:"
echo "  Username: loganchadwick"
echo "  Password: [paste your GitHub token]"
echo ""
echo "Get a token at: https://github.com/settings/tokens"
echo ""

cd /Users/loganchadwick/uat-platform
git push origin main

echo ""
echo "✅ Done! Vercel will auto-deploy in 2-3 minutes"
