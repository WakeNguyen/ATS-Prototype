# ATS 3.0 — Enterprise Applicant Tracking & Recruitment Automation Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![n8n](https://img.shields.io/badge/n8n-Workflow_Automation-EA4B71?style=flat-square&logo=n8n)](https://n8n.io/)
[![NextAuth](https://img.shields.io/badge/Auth.js-v5_Beta-purple?style=flat-square&logo=auth0)](https://authjs.dev/)

> **ATS 3.0** is an enterprise-grade recruitment platform and candidate pipeline management system. Built with Next.js 16 App Router (Turbopack), PostgreSQL (Supabase), and self-hosted n8n automation pipelines, it unifies candidate lifecycle tracking (Candidate 360°), AI-assisted resume parsing with Human-in-the-Loop (HITL) review, multi-channel sourcing, job order workbench, and high-resilience social campaign dispatching.

---

## 🏛️ System Architecture

```mermaid
flowchart TB
    subgraph Client ["Client Layer"]
        UI["Modern Enterprise UI (Next.js 16 / React 19 / Tailwind v4)"]
        Components["Base UI + Shadcn + Lucide Icons"]
    end

    subgraph AppLayer ["Application & API Layer (Vercel Serverless)"]
        ServerActions["Next.js Server Actions (Optimistic UI)"]
        AsyncHandlers["Background Task Orchestration (next/server after())"]
        AuthModule["NextAuth.js v5 (Google OAuth 2.0 SSO)"]
        SecurityEngine["AES-256-GCM Encryption & HMAC Webhook Guards"]
    end

    subgraph DataLayer ["Data & Persistence Layer (PostgreSQL / Supabase)"]
        ProdSchema["public Schema (Production Data)"]
        SandboxSchema["sandbox Schema (Zero-Trust Isolated QA Data)"]
        ConnectionPooler["PgBouncer Pooler (Singapore AWS)"]
    end

    subgraph AutomationLayer ["Automation & Worker Fleet (n8n Pro / Node.js)"]
        n8nCore["n8n Workflow Engine"]
        CVParser["AI Resume Parser & HITL Normalization Pipeline"]
        ContactsSync["Google Contacts Two-Way Sync Pipeline"]
        FBBridge["Facebook Job Posting & Warming Puppeteer Workers"]
    end

    UI --> ServerActions
    ServerActions --> AsyncHandlers
    ServerActions --> AuthModule
    ServerActions --> ConnectionPooler
    AsyncHandlers -.->|HMAC Webhooks| n8nCore
    ConnectionPooler --> ProdSchema
    ConnectionPooler --> SandboxSchema
    n8nCore --> CVParser
    n8nCore --> ContactsSync
    n8nCore --> FBBridge
    FBBridge -.->|Progress Callbacks| AppLayer
```

---

## ✨ Key Features & Engineering Highlights

### 1. 👤 Candidate 360° Hub
* **Holistic Candidate Profile**: Centralized view of contact points, employment history, tags, interview notes, and activity timeline.
* **Embedded Multi-Version CV Viewer**: In-app PDF/Doc preview with version history and atomic version deletion.
* **Contact Normalization & Cross-Platform Dedup**: Automatic channel recognition (`phone`, `email`, `facebook`, `zalo`, `linkedin`, `telegram`), URI query-string preservation (e.g., `profile.php?id=...`), and duplicate prevention across candidates and within individual candidate profiles.

### 2. 🤖 AI CV Parser with Human-in-the-Loop (HITL)
* **AI Extraction Pipeline**: Ingests resumes via forms or Drive uploads, extracts structured candidate data via LLM workflows.
* **HITL Review Modal**: Dedicated staging queue allowing recruiters to review, diff, and approve candidate information before merging or creating new records.
* **Intelligent Entity Merge**: Preserves existing candidate metadata, merges contact points with deduplication, and appends new CV versions seamlessly.

### 3. 💼 Jobs & Clients Workbench
* **Job Orders Pipeline**: Track requisition lifecycles, salary ranges, candidate pipeline counts, and hiring milestones.
* **Client & Branch Location Resolver**: Dynamic resolution and atomic synchronization between client office locations, branches, and specific job requisitions.

### 4. 📢 Campaigns & Social Warming Hub
* **Multi-Account Posting & Group Warming**: Automates social recruitment postings and account warming/join-group workflows.
* **Per-Nick Circuit Breaker**: Automatically detaches and unticks accounts encountering consecutive failures ($\ge 3$), protecting social accounts from checkpoint bans.
* **Dynamic Timeout Guard & Action Clamping**: Auto-clamps batch sizes (`max_posts_per_run`) based on active account count to guarantee run completion within infrastructure timeout limits (55 minutes).
* **Live Progress Streaming**: Webhook callbacks update real-time progress indicators, account logs, and status badges.

### 5. ⚡ Robust Serverless Webhook Dispatch (`after()`)
* Eliminates cold-start dropouts on serverless functions by wrapping outgoing webhook triggers in `next/server` `after()` execution blocks (`waitUntil`), ensuring background API calls finish without blocking UI responses.

---

## 🛠️ Technology Stack

| Domain | Technologies |
| :--- | :--- |
| **Frontend** | [Next.js 16.3 (Turbopack)](https://nextjs.org/), [React 19.2](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [@base-ui/react](https://base-ui.com/), [Shadcn UI](https://ui.shadcn.com/), [Lucide React](https://lucide.dev/) |
| **Backend** | Next.js Server Actions, Node.js, `postgres.js` |
| **Database** | PostgreSQL 16 on [Supabase](https://supabase.com/) with dual `public` / `sandbox` schema architecture |
| **Authentication** | [Auth.js (NextAuth v5)](https://authjs.dev/) with Google OAuth 2.0 & whitelist domain enforcement |
| **Automation** | [n8n Workflow Engine](https://n8n.io/), Puppeteer, RESTful Webhooks |
| **Security** | AES-256-GCM symmetric encryption for account credentials, SHA-256 HMAC Webhook signatures |

---

## 🚀 Getting Started (Local Development)

### 1. Clone the Repository
```bash
git clone https://github.com/WakeNguyen/ATS-Prototype.git
cd ATS-Prototype
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env.local` and populate your credentials:
```bash
cp .env.example .env.local
```

Example configuration (`.env.local`):
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/ats_db"
DB_SCHEMA=sandbox
AUTH_SECRET="your-32-char-random-secret-key"
AUTH_GOOGLE_ID="your-client-id.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="your-client-secret"
ALLOWED_EMAILS="admin@example.com"
APP_ENCRYPTION_SECRET="your-32-byte-aes-secret-key-phrase!"
INTERNAL_WEBHOOK_SECRET="your-webhook-secret-token"
```

### 4. Database Setup & Migrations
Ensure PostgreSQL has the necessary schema tables. You can apply migration definitions located in `docs/architecture/schema-map.md`.

### 5. Run the Application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📂 Project Structure

```text
├── src/
│   ├── app/                     # Next.js App Router routes & Server Actions
│   │   ├── (auth)/login/        # Google SSO Authentication page
│   │   ├── candidates/          # Candidate 360 & CV Viewer module
│   │   ├── jobs/                # Jobs & Clients Workbench module
│   │   ├── campaigns/           # Facebook Campaigns & Warming Hub
│   │   ├── search/              # Full-text Candidate & Blacklist Search
│   │   ├── api/                 # Webhooks, HITL review & QA endpoints
│   │   ├── actions.js           # Core Candidate & Job Server Actions
│   │   ├── campaign_actions.js  # Campaign Dispatch & Circuit Breaker Actions
│   │   └── hitl_actions.js      # Resume Parser HITL Validation Actions
│   ├── components/              # Reusable UI & Modal components
│   ├── constants/               # Domain Enums, Statuses & Schemas
│   └── lib/                     # Database client, AES crypto, utils
├── docs/
│   ├── architecture/            # System blueprints, Schema maps & API contracts
│   ├── features/                # Module functional specifications
│   └── testing/                 # Master test matrices & verification logs
├── scripts/                     # Worker scripts, automation bridges & diagnostics
└── .env.example                 # Standardized environment configuration template
```

---

## 🔒 Security & Privacy Notice

This repository represents a sanitized public prototype and portfolio demonstration:
* All live production credentials, server IP addresses, access tokens, and candidate personally identifiable information (PII) have been completely removed and replaced with standard placeholders.
* Sensitive fields in database tables (e.g., proxies, 2FA backup keys) are protected with AES-256-GCM encryption at rest.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
