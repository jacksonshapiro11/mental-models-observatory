#!/bin/bash

# Mental Models Observatory Setup Script
# This script sets up the development environment

set -e

echo "🧠 Setting up Mental Models Observatory Development Environment..."
echo "=================================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1)

if [ "$MAJOR_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $NODE_VERSION"
    exit 1
fi

echo "✅ Node.js version: $NODE_VERSION"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm and try again."
    exit 1
fi

echo "✅ npm version: $(npm -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Copy environment variables template
if [ ! -f .env.local ]; then
    echo "📋 Creating .env.local from template..."
    cp .env.local.example .env.local
    echo "⚠️  Please edit .env.local and add your Readwise API token"
else
    echo "✅ .env.local already exists"
fi

# Check if Git is initialized
if [ ! -d .git ]; then
    echo "🔧 Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit: Mental Models Observatory setup"
    echo "✅ Git repository initialized"
else
    echo "✅ Git repository already exists"
fi

# Run type checking
echo "🔍 Running type check..."
npm run type-check

# Run linting
echo "🧹 Running linter..."
npm run lint

# Check formatting
echo "📝 Checking code formatting..."
npm run format:check

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local and add your Readwise API token"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "📚 Available commands:"
echo "  npm run dev          - Start development server"
echo "  npm run build        - Build for production"
echo "  npm run lint         - Run linter"
echo "  npm run type-check   - Check TypeScript types"
echo "  npm run format       - Format code with Prettier"
echo ""
echo "📖 For more information, see README.md"
