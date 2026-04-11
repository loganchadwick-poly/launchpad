#!/bin/bash
# Quick deploy script - stages, commits, and pushes to GitHub

cd "$(dirname "$0")"
git add -A
git commit -m "Deploy: $(date +'%Y-%m-%d %H:%M')" || exit 0
git push
