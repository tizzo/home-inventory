# Architecture & Reference Documentation

This folder contains detailed architecture documentation and reference guides for the Home Inventory System.

## 📖 Contents

### Architecture Guides

- **[AUTHENTICATION.md](./AUTHENTICATION.md)** - Complete auth system architecture
  - OAuth flow diagram
  - Code locations for all auth components
  - Common issues and troubleshooting
  - Security considerations

### Project Status

- **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** - Current implementation status
  - What's completed (95%+ feature complete)
  - What's in progress
  - What's planned next
  - **Read this first** to understand where the project is

### Development Guides

- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Comprehensive development guide
  - Complete setup instructions
  - Development workflows
  - Testing strategies
  - Deployment procedures
  - Debugging tips

### Refactoring & Code Quality

- **[REFACTORING.md](./REFACTORING.md)** - Component refactoring guide
  - Replace manual modals with reusable components
  - Code patterns and examples
  - Before/after comparisons
  - ~60% code reduction opportunities

### Infrastructure Setup

- **[MINIO_SETUP.md](./MINIO_SETUP.md)** - MinIO/S3 storage setup
  - Automatic bucket creation
  - Local development setup
  - Troubleshooting storage issues

- **[FRONTEND_SETUP.md](./FRONTEND_SETUP.md)** - Frontend setup reference
  - Historical reference (most setup is now automatic)
  - Project structure explanation
  - Type generation workflow

## 🎯 When to Use These Docs

| Task | Read This |
|------|-----------|
| Login/auth broken | [AUTHENTICATION.md](./AUTHENTICATION.md) |
| What's implemented? | [PROJECT_STATUS.md](./PROJECT_STATUS.md) |
| How to deploy? | [DEVELOPMENT.md](./DEVELOPMENT.md) |
| Refactoring modals | [REFACTORING.md](./REFACTORING.md) |
| Photo upload issues | [MINIO_SETUP.md](./MINIO_SETUP.md) |

## 🔙 Back to Main Docs

For quick-start and frequently accessed docs, see the [root README.md](../README.md) or [DOCUMENTATION.md](../DOCUMENTATION.md) index.
