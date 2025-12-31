.PHONY: help up down logs db-shell backend-shell test clean

help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

up: ## Start all services
	docker-compose up -d

down: ## Stop all services
	docker-compose down

logs: ## Show logs for all services
	docker-compose logs -f

logs-backend: ## Show backend logs only
	docker-compose logs -f backend

logs-db: ## Show database logs only
	docker-compose logs -f postgres

db-shell: ## Open PostgreSQL shell
	docker-compose exec postgres psql -U postgres -d inventory

backend-shell: ## Open shell in backend container
	docker-compose exec backend /bin/bash

restart: ## Restart all services
	docker-compose restart

rebuild: ## Rebuild and restart all services
	docker-compose up -d --build

clean: ## Stop and remove all containers, volumes, and images
	docker-compose down -v --rmi all

status: ## Show status of all services
	docker-compose ps

test: ## Run backend tests
	docker-compose exec backend cargo test

fmt: ## Format backend code
	docker-compose exec backend cargo fmt

clippy: ## Run clippy linter
	docker-compose exec backend cargo clippy -- -D warnings

dev: ## Start services and show logs
	docker-compose up
