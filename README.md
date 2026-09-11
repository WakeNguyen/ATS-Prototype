# ATS 3.0 - Modern Applicant Tracking System & Headhunting CRM

An enterprise-grade, high-performance Applicant Tracking System (ATS) and Recruitment CRM built with **Next.js (App Router)**, **PostgreSQL (Supabase/Neon)**, **Tailwind CSS**, and **n8n Automation Engine**.

---

## 🌟 Key Features

- **Candidate Pipeline & Kanban Hub**: Real-time drag-and-drop workflow tracking candidates from Sourcing, Screening, Interviewing, to Placement.
- **Client & Job Order Management**: Manage job requisitions, headhunting pipelines, candidate shortlists, and placement tracking.
- **Automated Resume & CV Processing**: Multi-batch CV ingestion and automated parsing integrated with n8n workflow automations.
- **Enterprise Search & Filter**: Real-time server-side search, debounced filtering, and multi-criteria candidate tagging.
- **Recruitment Campaign & Social Sync**: Multi-channel candidate sourcing, automated warming, and group synchronization with advisory locking.
- **Enterprise Security & Compliance**:
  - AES-256-GCM data encryption for sensitive credentials.
  - Multi-tenant / Sandbox schema isolation (`sandbox` vs `public`).
  - Webhook validation using SHA-256 internal secrets and IP filtering.
  - Google OAuth 2.0 Single Sign-On (SSO) with domain email whitelisting.

---

## 🛠️ Technology Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Server Actions, API Routes)
- **Database**: PostgreSQL / [Supabase](https://supabase.com/) / [Neon](https://neon.tech/) with connection pooling
- **Styling**: Tailwind CSS & Lucide Icons
- **Authentication**: NextAuth.js (Auth.js) + Google SSO
- **Automation**: [n8n](https://n8n.io/) Workflow Automation Engine
- **Deployment**: Vercel Edge & Serverless Functions

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js >= 18.17.0
- A PostgreSQL database (e.g. Supabase, Neon, or local PostgreSQL instance)
- (Optional) An n8n instance for automated CV ingestion and webhook triggers

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/your-username/ats-web.git
cd ats-web
npm install
```

### 3. Environment Configuration
Copy the provided `.env.example` to `.env.local` and fill in your configuration:
```bash
cp .env.example .env.local
```

Configure the necessary variables:
```env
# Database
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres?sslmode=require"
DB_SCHEMA=sandbox # or 'public'

# Auth & Security
AUTH_SECRET="your-32-character-secret"
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
ALLOWED_EMAILS="admin@yourcompany.com"

# Internal Encryption & Webhooks
APP_ENCRYPTION_SECRET="your-32-char-encryption-key"
INTERNAL_WEBHOOK_SECRET="your-webhook-secret"
```

### 4. Database Setup
Initialize the database tables and schemas using the scripts in `scripts/` or the schema definitions in `docs/architecture/schema-map.md`.

### 5. Running the Application
Start the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📂 Project Architecture

```text
ats-web/
├── docs/                     # Comprehensive architecture, features, and deployment docs
│   ├── architecture/         # System diagrams, DB schema map, API contracts
│   ├── features/             # Feature specifications & UI workflows
│   └── deployment/           # Vercel & infrastructure guides
├── src/
│   ├── app/                  # Next.js App Router (Pages, Layouts, Server Actions)
│   │   ├── api/              # API & Webhook endpoints
│   │   ├── components/       # UI Components & Interactive Drawers/Modals
│   │   └── ...
│   └── lib/                  # Database connections, encryption, and utilities
├── scripts/                  # Data migration & administrative utility scripts
└── public/                   # Static assets & icons
```

---

## 📄 License
This project is licensed under the MIT License.
