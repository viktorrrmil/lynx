#!/bin/bash

# Lynx Docker Compose Wrapper Script
# This script handles port cleanup before starting Docker Compose

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to cleanup ports
cleanup_ports() {
    echo -e "${BLUE}🧹 Cleaning up ports...${NC}"

    # Ports used by the application
    local ports=(5433 5000 8080 5173)

    for port in "${ports[@]}"; do
        # Find processes using the port
        local pids=$(lsof -ti:$port 2>/dev/null || true)

        if [ -n "$pids" ]; then
            echo -e "${YELLOW}⚠️  Found processes on port $port, killing them...${NC}"
            kill -9 $pids 2>/dev/null || true
            sleep 1

            # Verify they're gone
            local remaining_pids=$(lsof -ti:$port 2>/dev/null || true)
            if [ -z "$remaining_pids" ]; then
                echo -e "${GREEN}✅ Port $port cleared${NC}"
            else
                echo -e "${RED}❌ Failed to clear port $port${NC}"
            fi
        else
            echo -e "${GREEN}✅ Port $port is available${NC}"
        fi
    done
    echo ""
}

# Function to show usage
show_help() {
    echo "Lynx Docker Compose Wrapper"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  up         Start all services (with port cleanup)"
    echo "  down       Stop all services"
    echo "  restart    Restart all services (with port cleanup)"
    echo "  logs       Show logs from all services"
    echo "  clean      Stop services and remove volumes"
    echo "  cleanup    Only cleanup ports (don't start services)"
    echo "  help       Show this help message"
    echo ""
    echo "Any other arguments will be passed directly to docker-compose"
}

# Main logic
case "${1:-up}" in
    up)
        cleanup_ports
        echo -e "${BLUE}🚀 Starting Lynx services...${NC}"
        docker-compose up -d
        echo -e "${GREEN}✅ Services started! Check http://localhost:5173${NC}"
        ;;
    up-logs)
        cleanup_ports
        echo -e "${BLUE}🚀 Starting Lynx services with logs...${NC}"
        docker-compose up
        ;;
    down)
        echo -e "${BLUE}🛑 Stopping Lynx services...${NC}"
        docker-compose down
        echo -e "${GREEN}✅ Services stopped${NC}"
        ;;
    restart)
        echo -e "${BLUE}🔄 Restarting Lynx services...${NC}"
        docker-compose down
        cleanup_ports
        docker-compose up -d
        echo -e "${GREEN}✅ Services restarted! Check http://localhost:5173${NC}"
        ;;
    logs)
        docker-compose logs -f
        ;;
    clean)
        echo -e "${BLUE}🧽 Cleaning up everything...${NC}"
        docker-compose down -v
        docker system prune -f
        echo -e "${GREEN}✅ Cleanup complete${NC}"
        ;;
    cleanup)
        cleanup_ports
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        # Pass through to docker-compose
        docker-compose "$@"
        ;;
esac
