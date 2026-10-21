# HUEGO — Agent Development Rules v0.1

> Version: 0.1  
> Project: HUEGO — AI Trip Planner for Huế  
> Status: Approved for MVP Development

## 1. Purpose

This document defines the rules an AI coding Agent must follow while developing HUEGO.

The Agent MUST read:
1. `PRD.md`
2. `USER_FLOW.md`
3. `TECHNICAL_ARCHITECTURE.md`
4. Relevant screen specifications
5. Relevant database documentation

before implementing major features.

## 2. Core Principles

- Follow the approved product scope.
- Prefer simple, maintainable MVP implementations.
- Reuse existing components before creating duplicates.
- Do not introduce unnecessary libraries or services.
- Keep frontend, backend/API logic, database, and AI logic separated.
- Never expose secrets or API keys in client-side code.
- Do not hard-code fake production data where a real data layer is required.
- Handle loading, error, and empty states.
- Preserve responsive behavior.
- Keep accessibility in mind.

## 3. Architecture Rules

- Frontend: React + TypeScript.
- Database/backend services: Supabase.
- AI: external LLM API through a secure server-side layer.
- Routing/map services must be isolated behind service functions.
- Environment variables must be used for secrets.
- Database changes must be documented.

## 4. UX Rules

The approved primary flow is:

Language Selection → Home → Plan Trip → AI Generating → Trip Result → Trip Edit/Re-plan → Trip Result.

Do not change this flow without approval.

Location permission is optional. Denying location must never block normal website usage.

Authentication should not block basic browsing or trip planning. It is mainly required for persistent personal data such as saved trips/favorites.

## 5. Coding Rules

- Use TypeScript types/interfaces for application data.
- Keep components focused and reasonably small.
- Avoid duplicated business logic.
- Use clear naming.
- Validate user input.
- Handle API failures explicitly.
- Keep UI state separate from server/data state where practical.
- Do not silently swallow errors.
- Do not delete working functionality merely to simplify implementation.

## 6. Change Control

For architectural or UX changes:

1. Explain the problem.
2. Explain the proposed change.
3. Identify affected documents/features.
4. Wait for user approval.
5. Implement only after approval.

## 7. Definition of Done

A feature is complete only when:
- It follows the approved flow.
- It has loading/error/empty states where relevant.
- It works on desktop and mobile layouts.
- It does not introduce obvious regressions.
- It uses the approved architecture.
- Relevant documentation is updated.
