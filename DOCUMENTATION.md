# Documentation Index

This document provides an overview of all documentation files in this repository.

## 📖 Core Documentation

### [README.md](./README.md)
Main project overview, architecture, setup instructions, and API reference.

### [CURRENT_STATUS.md](./CURRENT_STATUS.md)
**Current implementation status** - what's done, what's in progress, and what's next.  
**Read this first** to understand the project's current state.

### [TODO.md](./TODO.md)
Comprehensive list of all planned features, improvements, and tasks organized by priority.

## 🚀 Getting Started

### [QUICK_START.md](./QUICK_START.md)
Fast-track guide to get the system running locally in minutes.

### [DEVELOPMENT.md](./DEVELOPMENT.md)
Detailed development workflow, conventions, and best practices.

## 🔧 Setup Guides

### [MINIO_SETUP.md](./MINIO_SETUP.md)
MinIO (S3-compatible storage) setup for local photo storage.

### [FRONTEND_SETUP.md](./FRONTEND_SETUP.md)
Frontend-specific setup and configuration.

### [backend/GOOGLE_AUTH_SETUP.md](./backend/GOOGLE_AUTH_SETUP.md)
Google OAuth configuration and setup.

## 📋 Implementation Notes

### [REFACTORING_NEXT_STEPS.md](./REFACTORING_NEXT_STEPS.md)
Component refactoring opportunities - replacing manual modals with reusable components.

## 🤖 AI Assistant Instructions

### [AGENTS.md](./AGENTS.md)
**Project-wide rules** for AI assistants (Cascade/Windsurf).  
Contains architecture decisions, conventions, and quality gates.

### [backend/AGENTS.md](./backend/AGENTS.md)
Backend-specific rules for AI assistants.

### [frontend/AGENTS.md](./frontend/AGENTS.md)
Frontend-specific rules for AI assistants.


## 📂 Archived/Removed Documentation

The following files have been removed as they're now outdated or redundant:

- ~~`NEXT_STEPS.md`~~ - Replaced by `CURRENT_STATUS.md` and `TODO.md`
- ~~`PHASE_2_WORKLIST.md`~~ - Phase 2 is complete
- ~~`ROOMS_CRUD.md`~~ - Implementation complete
- ~~`TESTING.md`~~ - Basic testing info, needs comprehensive update
- ~~`MODAL_IMPLEMENTATION.md`~~ - Implementation complete
- ~~`PHOTO_UPLOAD_TROUBLESHOOTING.md`~~ - Issues resolved
- ~~`LABEL_PDF_FLOW.md`~~ - Implementation complete, details in code
- ~~`PHOTO_UPLOAD_SETUP.md`~~ - Implementation complete, covered in QUICK_START.md
- ~~`START_MINIO.md`~~ - Redundant with MINIO_SETUP.md
- ~~`CLAUDE.md`~~ - Redundant with AGENTS.md
- ~~`WINDSURF_RULES.md`~~ - Redundant with AGENTS.md
- ~~`WINDSURF_SETUP.md`~~ - Not needed, AGENTS.md files are auto-detected
- ~~`WINDSURF_WORKFLOWS.md`~~ - Not needed, workflows covered in DEVELOPMENT.md

## 🎯 Where to Start

**New to the project?**
1. Read [README.md](./README.md) for overview
2. Check [CURRENT_STATUS.md](./CURRENT_STATUS.md) for what's implemented
3. Follow [QUICK_START.md](./QUICK_START.md) to run locally
4. Review [TODO.md](./TODO.md) to see what's next

**Contributing?**
1. Read [AGENTS.md](./AGENTS.md) for project rules
2. Check [DEVELOPMENT.md](./DEVELOPMENT.md) for workflows
3. Review [TODO.md](./TODO.md) for available tasks
4. See [REFACTORING_NEXT_STEPS.md](./REFACTORING_NEXT_STEPS.md) for refactoring opportunities

**Setting up infrastructure?**
1. Follow [QUICK_START.md](./QUICK_START.md) for complete setup
2. [MINIO_SETUP.md](./MINIO_SETUP.md) for photo storage details
3. [backend/GOOGLE_AUTH_SETUP.md](./backend/GOOGLE_AUTH_SETUP.md) for authentication
4. [FRONTEND_SETUP.md](./FRONTEND_SETUP.md) for frontend config

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

**Last Updated**: December 2024
