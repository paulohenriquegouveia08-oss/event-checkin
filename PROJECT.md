# Project: 3º COPOL — Pagamento PIX Manual & Gestão de Participantes

## Architecture
- **apps/backend**: Fastify v5 API + Prisma ORM + PostgreSQL. Provides public event endpoints, registration endpoints, administrative event settings, and attendee lifecycle operations (`confirm`, `cancel`, `delete`).
- **apps/admin**: Single-page administrative dashboard (React 19 + Vite + CSS Variables). Allows organizers to configure event PIX details and execute manual payment confirmation, cancellation, and physical deletion with security confirmation modal.
- **apps/pre-copol**: Landing page & registration portal for COPOL 2026 (Next.js 15 App Router with static export `output: "export"`). Replaces PicPay integration with a clean manual PIX payment view, copy-to-clipboard, warning alerts, and an interactive `mailto:` button.
- **E2E Testing & Integration**: Vitest test suites verifying full multi-tenancy isolation, PIX configuration, and participant lifecycle transitions.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Event PIX Database Schema | Add `pixKey`, `pixKeyType`, `pixReceiverName` to `model Event` in `schema.prisma` with migration | M1 | ORIGINAL_REQUEST R1 |
| 2 | Event Public Details PIX Exposure | Expose `pixKey`, `pixKeyType`, `pixReceiverName` in `GET /public/events/:slug` and `GET /events/:eventId/public` | M1 | ORIGINAL_REQUEST R1 |
| 3 | Event Settings Update Endpoint | Allow `PATCH /events/:eventId` to update PIX settings with schema validation | M1 | ORIGINAL_REQUEST R1 |
| 4 | Inscription Manual Confirmation Endpoint | `POST /events/:eventId/inscriptions/:id/confirm` marks `CONFIRMED`, generates `Participant`, ticket `qrToken`, dispatches receipt email | M1 | ORIGINAL_REQUEST R3 |
| 5 | Inscription Cancellation Endpoint | `POST /events/:eventId/inscriptions/:id/cancel` marks `CANCELLED` and frees batch capacity | M1 | ORIGINAL_REQUEST R3 |
| 6 | Inscription Physical Deletion Endpoint | `DELETE /events/:eventId/inscriptions/:id` safely deletes participant and inscription in transaction | M1 | ORIGINAL_REQUEST R3 |
| 7 | Payment Status Endpoint Enrichment | Expose `name`, `pixKey`, `pixKeyType`, `pixReceiverName` in `GET /inscriptions/:id/payment-status` | M1 | ORIGINAL_REQUEST R2 |
| 8 | Pre-COPOL Removal of PicPay Elements | Completely remove PicPay QR Code image, checkout links, and "Abrir no App PicPay" button | M2 | ORIGINAL_REQUEST R2 |
| 9 | Pre-COPOL Plain Text PIX & Copy Button | Display plain text PIX key with copy button and visual feedback ("Copiado!") | M2 | ORIGINAL_REQUEST R2 |
| 10 | Pre-COPOL Batch Price & Warning Banner | Display active lot value and verbatim warning: *"Sua vaga está pré-garantida! No entanto, caso o pagamento não seja confirmado pela organização, a inscrição será cancelada."* | M2 | ORIGINAL_REQUEST R2 |
| 11 | Pre-COPOL Instructions & Interactive Mailto | Receipt submission instructions for `terceirocopol@gmail.com` with `mailto:` button pre-filling subject & body | M2 | ORIGINAL_REQUEST R2 |
| 12 | Pre-COPOL Polling for Auto-Confirmation | Keep 3s polling to auto-transition from manual PIX screen to confirmed voucher on admin approval | M2 | ORIGINAL_REQUEST R2 |
| 13 | Admin Event PIX Settings Tab | UI in `ConfigTab.tsx` with inputs for Chave PIX, Tipo de Chave (`<select>`), and Beneficiário | M3 | ORIGINAL_REQUEST R1 |
| 14 | Admin Inscription Action Buttons | Add Confirm, Cancel, and Delete buttons to `InscriptionsReportTab.tsx` table rows | M3 | ORIGINAL_REQUEST R3 |
| 15 | Admin Deletion Confirmation Modal | Safe modal dialog asking for confirmation before permanently deleting an inscription record | M3 | ORIGINAL_REQUEST R3 |
| 16 | Admin API Client Methods | Add `confirmInscription`, `cancelInscription`, `deleteInscription` to `apps/admin/src/api/client.ts` | M3 | ORIGINAL_REQUEST R3 |
| 17 | Backend Unit & Integration Tests | Comprehensive Vitest suite covering PIX config, manual confirm, cancel, and delete with 100% pass | M4 | ORIGINAL_REQUEST R4 |
| 18 | E2E Opaque-Box Verification | Dual-track end-to-end verification covering registration, payment screen, admin lifecycle, and security | M4 | ORIGINAL_REQUEST R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend & Database Foundations | Prisma schema, migration, Event routes/service, Inscriptions routes/service (`confirm`, `cancel`, `delete`) | None | IN_PROGRESS |
| M2 | Pre-COPOL Manual PIX Screen | `apps/pre-copol`: Remove PicPay, add plain text PIX, copy feedback, warning banner, interactive mailto | Contract M1 | DONE |
| M3 | Admin PIX Config & Inscription Actions | `apps/admin`: Event config PIX card, attendee action buttons, deletion modal dialog, API client | Contract M1 | DONE |
| M4 | E2E Testing Suite & Acceptance | Integration tests, E2E validation, verification of 100% passing tests (`npm test`) | M1, M2, M3 | IN_PROGRESS |

## Interface Contracts

### 1. Event PIX Settings (Backend ↔ Admin & Pre-COPOL)
- **Database Model**: `Event`
  - `pixKey String?`
  - `pixKeyType String?` (e.g., `"EMAIL"`, `"CPF_CNPJ"`, `"PHONE"`, `"RANDOM"`)
  - `pixReceiverName String?`
- **Schema Validation** (`apps/backend/src/modules/events/events.schema.ts`):
  - `pixKey: z.string().max(255).optional()`
  - `pixKeyType: z.string().max(50).optional()`
  - `pixReceiverName: z.string().max(255).optional()`
- **Public Projections** (`GET /public/events/:slug` & `GET /events/:eventId/public`):
  - Returns `pixKey`, `pixKeyType`, `pixReceiverName` in the event payload.

### 2. Inscription Admin Management (Backend ↔ Admin)
- **POST `/events/:eventId/inscriptions/:id/confirm`**:
  - Permissions: `requirePermission("participants.edit")`
  - Behavior: Calls `confirmInscriptionPayment(id)`, transitions status to `CONFIRMED`, generates `Participant` record with unique `qrToken`, and queues/sends confirmation email with QR Code.
  - Response: `{ success: true, inscription: { id, status: "CONFIRMED", participantId } }`
- **POST `/events/:eventId/inscriptions/:id/cancel`**:
  - Permissions: `requirePermission("participants.edit")`
  - Behavior: Sets `status = "CANCELLED"`. If a linked `Participant` exists, sets its status to `"CANCELLED"`.
  - Response: `{ success: true, inscription: { id, status: "CANCELLED" } }`
- **DELETE `/events/:eventId/inscriptions/:id`**:
  - Permissions: `requirePermission("participants.edit")`
  - Behavior: Executes within a Prisma transaction:
    1. If `inscription.participantId` exists, deletes `Participant` (cascading deletes to `checkIns`, `certificates`, `attendanceProofs`).
    2. Deletes `Inscription`.
  - Response: `{ success: true, deletedId: id }`

### 3. Payment Status & Registration (Backend ↔ Pre-COPOL)
- **GET `/inscriptions/:id/payment-status`**:
  - Response:
    ```json
    {
      "id": "uuid",
      "status": "PENDING" | "CONFIRMED" | "CANCELLED",
      "name": "Nome do Participante",
      "amount": 10000,
      "category": "Estudante / Profissional",
      "pixKey": "terceirocopol@gmail.com",
      "pixKeyType": "E-mail",
      "pixReceiverName": "3º COPOL — Congresso Odontológico Positivo Londrinense",
      "participantId": "uuid-or-null",
      "qrToken": "token-or-null",
      "attendeePortalUrl": "url-or-null"
    }
    ```

### 4. Interactive Mailto Contract (Pre-COPOL)
- **Protocol**: `mailto:`
- **Destination**: `terceirocopol@gmail.com`
- **Subject**: `Comprovante de Pagamento - Inscrição #${id.substring(0,8).toUpperCase()} - ${participantName}`
- **Body**: `Olá Organização do 3º COPOL,\n\nSegue em anexo o comprovante de pagamento da minha inscrição.\n\nCódigo da Inscrição: ${id}\nNome: ${participantName}\nValor: R$ ${amount}\n\nAtenciosamente,\n${participantName}`

## Code Layout
- `apps/backend/prisma/schema.prisma`
- `apps/backend/prisma/migrations/20260912000000_add_event_pix_fields/migration.sql`
- `apps/backend/src/modules/events/events.schema.ts`
- `apps/backend/src/modules/events/events.service.ts`
- `apps/backend/src/modules/inscriptions/inscriptions.schema.ts`
- `apps/backend/src/modules/inscriptions/inscriptions.routes.ts`
- `apps/backend/src/modules/inscriptions/inscriptions.service.ts`
- `apps/backend/tests/inscriptions-pix-management.test.ts`
- `apps/admin/src/api/client.ts`
- `apps/admin/src/pages/event/ConfigTab.tsx`
- `apps/admin/src/pages/event/InscriptionsReportTab.tsx`
- `apps/admin/src/components/ConfirmDeleteModal.tsx`
- `apps/pre-copol/src/lib/api.ts`
- `apps/pre-copol/src/app/confirmacao/page.tsx`
- `apps/pre-copol/src/app/inscricao/page.tsx`
