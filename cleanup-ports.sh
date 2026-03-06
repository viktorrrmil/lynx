#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ports used by the application
PORTS=(5433 5000 8080 5173)

echo -e "${YELLOW}Checking for processes on ports: ${PORTS[@]}${NC}"

for port in "${PORTS[@]}"; do
    # Find processes using the port (including root processes)
    pids=$(sudo lsof -ti:$port 2>/dev/null)

    if [ -n "$pids" ]; then
        echo -e "${RED}Found processes on port $port: $pids${NC}"

        # Show what processes are running
        echo "Process details:"
        sudo lsof -i:$port 2>/dev/null

        # Kill the processes (using sudo to handle docker-proxy and other root processes)
        echo -e "${YELLOW}Killing processes on port $port...${NC}"
        sudo kill -9 $pids 2>/dev/null

        # Verify they're gone
        sleep 1
        remaining_pids=$(sudo lsof -ti:$port 2>/dev/null)
        if [ -z "$remaining_pids" ]; then
            echo -e "${GREEN}Successfully killed processes on port $port${NC}"
        else
            echo -e "${RED}Failed to kill some processes on port $port: $remaining_pids${NC}"
        fi
    else
        echo -e "${GREEN}Port $port is free${NC}"
    fi
    echo ""
done

echo -e "${GREEN}Port cleanup complete!${NC}"
