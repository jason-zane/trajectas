# Admin-Operated Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock down the complete admin-operated workflow: create assessment → create campaign → invite candidates → candidate completes → results stored → branded report auto-generated → admin reviews/releases report.

**Architecture:** The runtime engine, scoring, and report rendering infrastructure are already production-ready. This plan closes the remaining gaps: automatic report processing after session completion, real report surfaces replacing placeholders, campaign-level branding across runner + reports, email invites via Resend, and enforcement of all visible settings.

**Tech Stack:** Next.js (App Router), Supabase (Postgres + Storage), Resend (email), Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-04-02-admin-operated-launch-design.md`

---

## Phases

1. Auto report generation — trigger processing from submitSession
2. Real report surfaces — replace placeholders with snapshot-backed views
3. Campaign branding — campaign-level brand override across runner + reports
4. Email invites — Resend integration with branded templates
5. Tighten product contract — enforce all visible settings
6. Full E2E test — admin campaign lifecycle
