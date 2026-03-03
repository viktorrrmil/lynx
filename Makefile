# Lynx Project Makefile

.PHONY: cleanup-ports up down restart logs clean help

# Default target
help:
	@echo "Available commands:"
	@echo "  make cleanup-ports  - Kill processes running on required ports (5433, 5000, 8080, 5173)"
	@echo "  make up            - Start all services with port cleanup"
	@echo "  make down          - Stop all services"
	@echo "  make restart       - Restart all services with port cleanup"
	@echo "  make logs          - Show logs from all services"
	@echo "  make clean         - Stop services and remove volumes"

# Clean up ports before starting
cleanup-ports:
	@echo "Checking and cleaning up ports..."
	@chmod +x cleanup-ports.sh
	@./cleanup-ports.sh

# Start services (with port cleanup)
up: cleanup-ports
	docker-compose up -d

# Start services with logs (with port cleanup)
up-logs: cleanup-ports
	docker-compose up

# Stop services
down:
	docker-compose down

# Restart services (with port cleanup)
restart: down cleanup-ports
	docker-compose up -d

# Show logs
logs:
	docker-compose logs -f

# Clean everything (stop services and remove volumes)
clean:
	docker-compose down -v
	docker system prune -f

# Force cleanup and restart
force-restart: cleanup-ports
	docker-compose down -v
	docker-compose up -d
