# Documentation Index

This document provides an overview of all documentation files in this repository.

## 📖 Core Documentation

### [README.md](./README.md)
Main project overview, architecture, setup instructions, and API reference.

### [docs/PROJECT_STATUS.md](./docs/PROJECT_STATUS.md)
**Current implementation status** - what's done, what's in progress, and what's next.
**Read this first** to understand the project's current state.

### [TODO.md](./TODO.md)
Comprehensive list of all planned features, improvements, and tasks organized by priority.

## 🚀 Getting Started

### [QUICK_START.md](./QUICK_START.md)
Fast-track guide to get the system running locally in minutes.

### [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)
Detailed development workflow, conventions, and best practices.

## 🏗️ Architecture Documentation

### [docs/AUTHENTICATION.md](./docs/AUTHENTICATION.md)
**Complete authentication architecture guide** - OAuth flow, code locations, common issues, and fixes.
**Read this** when working on login/auth functionality.

### [docs/REFACTORING.md](./docs/REFACTORING.md)
Component refactoring guide - replacing manual modals with reusable components, code patterns.

## 🔧 Setup Guides

### [docs/MINIO_SETUP.md](./docs/MINIO_SETUP.md)
MinIO (S3-compatible storage) setup for local photo storage.

### [docs/FRONTEND_SETUP.md](./docs/FRONTEND_SETUP.md)
Frontend-specific setup and configuration (mostly historical reference).

### [backend/GOOGLE_AUTH_SETUP.md](./backend/GOOGLE_AUTH_SETUP.md)
Google OAuth configuration - how to obtain credentials from Google Console.

## 🤖 AI Assistant Instructions

### [CLAUDE.md](./CLAUDE.md)
**Quick start guide for Claude Code** - where to find documentation for common tasks.
**Start here** to quickly navigate to relevant docs.

### [AGENTS.md](./AGENTS.md)
**Project-wide rules** for AI assistants (Cascade/Windsurf).
Contains architecture decisions, conventions, and quality gates.

### [backend/AGENTS.md](./backend/AGENTS.md)
Backend-specific rules for AI assistants.

### [frontend/AGENTS.md](./frontend/AGENTS.md)
Frontend-specific rules for AI assistants.


## 📂 Archived/Removed Documentation

The following files have been removed as they're now outdated or redundant:

- ~~`NEXT_STEPS.md`~~ - Replaced by `docs/PROJECT_STATUS.md` and `TODO.md`
- ~~`PHASE_2_WORKLIST.md`~~ - Empty, phase 2 complete
- ~~`ROOMS_CRUD.md`~~ - Implementation complete
- ~~`TESTING.md`~~ - Basic testing info, needs comprehensive update
- ~~`MODAL_IMPLEMENTATION.md`~~ - Implementation complete
- ~~`PHOTO_UPLOAD_TROUBLESHOOTING.md`~~ - Issues resolved
- ~~`LABEL_PDF_FLOW.md`~~ - Implementation complete, details in code
- ~~`PHOTO_UPLOAD_SETUP.md`~~ - Implementation complete, covered in QUICK_START.md
- ~~`START_MINIO.md`~~ - Redundant with docs/MINIO_SETUP.md
- ~~`WINDSURF_RULES.md`~~ - Empty, redundant with AGENTS.md
- ~~`WINDSURF_SETUP.md`~~ - Empty, not needed
- ~~`WINDSURF_WORKFLOWS.md`~~ - Empty, workflows covered in docs/DEVELOPMENT.md

## 🎯 Where to Start

**AI Assistant (Claude Code)?**
1. Read [CLAUDE.md](./CLAUDE.md) - Quick navigation guide to find relevant docs for any task

**New to the project?**
1. Read [README.md](./README.md) for overview
2. Check [docs/PROJECT_STATUS.md](./docs/PROJECT_STATUS.md) for what's implemented
3. Follow [QUICK_START.md](./QUICK_START.md) to run locally
4. Review [TODO.md](./TODO.md) to see what's next

**Contributing?**
1. Read [AGENTS.md](./AGENTS.md) for project rules
2. Check [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) for workflows
3. Review [TODO.md](./TODO.md) for available tasks
4. See [docs/REFACTORING.md](./docs/REFACTORING.md) for refactoring opportunities

**Working on authentication?**
1. Read [docs/AUTHENTICATION.md](./docs/AUTHENTICATION.md) for complete architecture
2. Check [backend/GOOGLE_AUTH_SETUP.md](./backend/GOOGLE_AUTH_SETUP.md) for OAuth setup

**Setting up infrastructure?**
1. Follow [QUICK_START.md](./QUICK_START.md) for complete setup
2. [docs/MINIO_SETUP.md](./docs/MINIO_SETUP.md) for photo storage details
3. [backend/GOOGLE_AUTH_SETUP.md](./backend/GOOGLE_AUTH_SETUP.md) for authentication
4. [docs/FRONTEND_SETUP.md](./docs/FRONTEND_SETUP.md) for frontend config (historical reference)

## 📝 Documentation Standards

When creating new documentation:

- Use clear, descriptive titles
- Include a "Last Updated" date at the top
- Add to this index
- Keep it concise and actionable
- Use code examples where helpful
- Link to related documentation

## 🔄 Maintenance

This index should be updated whenever:
- New documentation is added
- Documentation is removed or archived
- Major changes are made to existing docs
- Project structure changes significantly

**Last Updated**: January 2025
