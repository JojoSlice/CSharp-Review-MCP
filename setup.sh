#!/bin/bash

# Setup script for C# Review MCP Server

set -e

echo "========================================="
echo "C# Review MCP Server - Setup"
echo "========================================="
echo ""

# Check for Node.js
echo "Checking for Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi
echo "✓ Node.js found: $(node --version)"
echo ""

# Check for npm
echo "Checking for npm..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi
echo "✓ npm found: $(npm --version)"
echo ""

# Install npm dependencies
echo "Installing npm dependencies..."
npm install
echo "✓ npm dependencies installed"
echo ""

# Build TypeScript
echo "Building TypeScript..."
npm run build
echo "✓ TypeScript build complete"
echo ""

# Check for .NET SDK
echo "Checking for .NET SDK..."
if ! command -v dotnet &> /dev/null; then
    echo "⚠️  .NET SDK is not installed."
    echo ""
    echo "Roslyn analyzer will not be available."
    echo "To enable Roslyn features, install .NET SDK 8.0+:"
    echo "  https://dotnet.microsoft.com/download"
    echo ""
    echo "Setup complete (without Roslyn support)"
    exit 0
fi

DOTNET_VERSION=$(dotnet --version)
echo "✓ .NET SDK found: $DOTNET_VERSION"
echo ""

# Build Roslyn analyzer
echo "Building Roslyn analyzer..."
cd roslyn-analyzer
if dotnet build; then
    echo "✓ Roslyn analyzer build complete"
    echo ""
    echo "========================================="
    echo "✓ Setup complete!"
    echo "========================================="
    echo ""
    echo "You can now use the MCP server with full Roslyn support."
else
    echo "⚠️  Roslyn analyzer build failed"
    echo ""
    echo "The MCP server will work, but Roslyn features will be unavailable."
    echo "Check the error messages above and ensure .NET SDK 8.0+ is installed."
fi

cd ..

echo ""
echo "To start the server:"
echo "  npm start"
echo ""
echo "To pre-populate documentation cache:"
echo "  npm run prepopulate"
