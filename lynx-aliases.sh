#!/bin/bash
# Lynx Development Aliases
# Source this file to get convenient aliases for the Lynx project
# Usage: source lynx-aliases.sh

# Get the directory of this script
LYNX_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Make sure scripts are executable
chmod +x "$LYNX_DIR/lynx.sh" 2>/dev/null || true
chmod +x "$LYNX_DIR/cleanup-ports.sh" 2>/dev/null || true

# Aliases for common operations
alias lynx-up="cd '$LYNX_DIR' && ./lynx.sh up"
alias lynx-down="cd '$LYNX_DIR' && ./lynx.sh down"
alias lynx-restart="cd '$LYNX_DIR' && ./lynx.sh restart"
alias lynx-logs="cd '$LYNX_DIR' && ./lynx.sh logs"
alias lynx-clean="cd '$LYNX_DIR' && ./lynx.sh clean"
alias lynx-cleanup="cd '$LYNX_DIR' && ./lynx.sh cleanup"
alias lynx-status="cd '$LYNX_DIR' && docker-compose ps"

# Quick access to common URLs
alias lynx-open-app="open http://localhost:5173 2>/dev/null || xdg-open http://localhost:5173 2>/dev/null || echo 'App: http://localhost:5173'"
alias lynx-open-api="open http://localhost:8080 2>/dev/null || xdg-open http://localhost:8080 2>/dev/null || echo 'API: http://localhost:8080'"

# Development helpers
alias lynx-api-logs="cd '$LYNX_DIR' && docker-compose logs -f api"
alias lynx-frontend-logs="cd '$LYNX_DIR' && docker-compose logs -f frontend"
alias lynx-db-logs="cd '$LYNX_DIR' && docker-compose logs -f postgres"

echo "✅ Lynx aliases loaded! Available commands:"
echo "   lynx-up        - Start all services"
echo "   lynx-down      - Stop all services"
echo "   lynx-restart   - Restart all services"
echo "   lynx-logs      - Show all logs"
echo "   lynx-clean     - Clean everything"
echo "   lynx-cleanup   - Just cleanup ports"
echo "   lynx-status    - Show service status"
echo "   lynx-open-app  - Open frontend in browser"
echo "   lynx-open-api  - Open API docs in browser"
echo ""
echo "📍 Project directory: $LYNX_DIR"
