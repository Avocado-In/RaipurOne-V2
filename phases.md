# Project Phases

This document defines exactly what should be implemented in each phase.

No phase may implement features belonging to later phases.

---

# Phase 1 — Website

Goal

Create the complete web application frontend.

Build only the website UI.

No backend logic.

No AI.

No authentication.

No database.

No Telegram bot.

No Flutter app.

Focus entirely on the web experience.

The website should include:

• Landing Page
• Citizen Dashboard
• Admin Dashboard UI
• Worker Dashboard UI
• Complaint Submission UI
• Complaint Detail UI
• Analytics UI
• Login UI
• Registration UI
• Settings UI
• Notification UI

Use mock data.

Every page should be production quality.

Responsive.

Minimalistic.

Modern.

Reusable.

---

# Phase 2 — Backend + AI + Telegram

Goal

Connect the frontend with a real backend.

Build:

FastAPI backend

Telegram Bot

AI pipeline

Authentication

REST APIs

Worker allocation logic

Complaint categorization

Priority prediction

Image upload

Notification system

Connect backend with frontend.

Database is NOT implemented yet.

Temporary storage or mocked repositories may be used.

---

# Phase 3 — Database

Goal

Replace temporary storage with Supabase.

Design complete database.

Implement:

Authentication

Users

Workers

Departments

Complaints

Complaint Images

Trust Scores

Ratings

Notifications

Assignment History

Audit Logs

Policies

Indexes

Triggers

Migrations

Backend should now use Supabase completely.

---

# Phase 4 — Flutter Application

Goal

Build the mobile application.

Implement

Citizen App

Worker App

Authentication

Complaint submission

Task management

Notifications

Ratings

Maps

Image upload

Everything must integrate with the backend built in previous phases.

Reuse API endpoints.

Reuse business logic.

Maintain consistent UI with website.

---

Completion Rule

Each phase must finish in a deployable state.

No incomplete features.

No TODO placeholders.

Every phase should be independently testable.