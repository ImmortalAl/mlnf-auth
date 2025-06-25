#!/bin/bash

# MLNF Backend Deployment Script
# This script helps deploy backend changes to production

echo "🚀 MLNF Backend Deployment Helper"
echo "=================================="
echo ""

# Check current status
echo "📊 Current Git Status:"
git status --short
echo ""

# Show pending commits
echo "📝 Pending Commits to Deploy:"
git log origin/main..HEAD --oneline
echo ""

# Show the auth fix commit specifically
echo "🔑 Authentication Fix Commit:"
git show --stat 4882c23
echo ""

echo "🎯 Deployment Options:"
echo "1. Manual GitHub Push: You'll need to push these changes to GitHub manually"
echo "2. Render Dashboard: Use Render's manual deploy button"
echo "3. GitHub Integration: Ensure your GitHub account is connected to Render"
echo ""

echo "📋 Quick Commands for Manual Deployment:"
echo "  git remote set-url origin https://github.com/ImmortalAl/mlnf-auth.git"
echo "  git push origin main"
echo ""

echo "🔧 Files Changed:"
git diff --name-only HEAD~1
echo ""

echo "✅ Ready to deploy authentication fix!"
echo "   This will resolve the 401 login errors."