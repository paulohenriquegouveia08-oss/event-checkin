# E2E Test Infra: 3º COPOL (Pagamento PIX Manual & Gestão de Participantes)

## Test Philosophy
- Opaque-box, requirement-driven, derived strictly from `ORIGINAL_REQUEST.md` (R1-R4).
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Workload Verification.

## Feature Inventory & Test Matrix
| # | Feature | Source (Requirement) | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Cross-Feature) | Tier 4 (Scenario) |
|---|---------|----------------------|:----------------:|:-----------------:|:----------------------:|:-----------------:|
| 1 | Event PIX Config (Persistence & Exposure) | R1 | 5 | 5 | ✓ | ✓ |
| 2 | Inscription Manual Confirmation | R3 | 5 | 5 | ✓ | ✓ |
| 3 | Inscription Cancellation | R3 | 5 | 5 | ✓ | ✓ |
| 4 | Inscription Physical Deletion | R3 | 5 | 5 | ✓ | ✓ |
| 5 | Pre-COPOL Manual PIX Page & Flow | R2 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Integration & E2E Runner**: Vitest (`npm test` in `apps/backend`).
- **Frontend Build Verification**: `npm run build` in `apps/pre-copol` and `apps/admin`.
- **Directory Layout**: `apps/backend/tests/e2e-pix-manual-flow.test.ts`.

## Coverage Goals
- **Tier 1 (Feature Coverage)**: Happy-path validation of each endpoint/action in isolation (set PIX keys, confirm registration, cancel registration, delete registration, query public details).
- **Tier 2 (Boundary & Corner Cases)**: Edge cases (empty keys, invalid formats, non-existent IDs, deleting already confirmed participant, double confirmation, unauthorized access).
- **Tier 3 (Cross-Feature Combinations)**: Multi-step lifecycle (create inscription -> inspect pending payment -> confirm -> check participant & QR token created -> check email receipt trigger -> verify batch capacity freed on cancellation).
- **Tier 4 (Real-World Workload Scenarios)**: Realistic end-to-end user and admin journeys (e.g., student registers, pays via manual PIX, admin verifies and confirms in dashboard, ticket is generated; or user cancels or is purged by admin).
