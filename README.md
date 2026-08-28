# 🌸 SheZen — Zero-Knowledge Encrypted Women's Health & Cycle Haven

[![Next.js 16](https://img.shields.io/badge/Next.js-16.3-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Security: Zero--Knowledge](https://img.shields.io/badge/Security-Zero--Knowledge-emerald?style=flat&logo=lock)](docs/02-SECURITY.md)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-purple?style=flat&logo=pwa)](https://web.dev/progressive-web-apps/)

> **SheZen** is a local-first, zero-knowledge encrypted Progressive Web App (PWA) designed for intimate health tracking, cycle prediction, journaling, and peer support. Built from the ground up to protect reproductive autonomy, SheZen ensures that **no unencrypted health data ever touches a remote server**.

---

## 📖 Table of Contents

- [The Core Promise](#-the-core-promise)
- [Key Features](#-key-features)
- [Cryptographic Architecture](#-cryptographic-architecture)
- [Trust Model Comparison](#-trust-model-comparison)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Database & Migrations](#-database--migrations)
- [Project Architecture](#-project-architecture)
- [Threat Model & Privacy Guarantees](#-threat-model--privacy-guarantees)
- [Documentation Specs](#-documentation-specs)
- [License](#-license)

---

## 🔒 The Core Promise

Most period and symptom tracking applications store raw health metrics in plaintext databases accessible to third parties, advertisers, and legal subpoenas.

**SheZen changes this paradigm:**
* 🛡️ **Client-Side AES-256-GCM Encryption**: All cycle entries, symptoms, flow data, mood logs, and personal journal notes are encrypted directly in memory in your browser.
* 🔑 **Zero-Knowledge Key Derivation**: Your master key is derived via **Argon2id (64MB memory cost)** from your passcode. The server only ever stores encrypted blobs and nonces.
* 🚪 **Decoy Mode Under Duress**: If forced to unlock your app under scrutiny, entering a predefined decoy passcode unlocks a realistic, blank secondary profile without revealing your true records.
* 💬 **Signal-Style E2E 1:1 Anonymous Chat**: Direct peer-to-peer messaging using **ECDH P-256** key exchange, completely isolated from your health profile.
* 📄 **24-Word Recovery Phrase**: BIP-39 recovery keys generated at setup allow complete zero-knowledge account restoration if you forget your passcode.

---

## ✨ Key Features

### 1. 🩸 Intimate Cycle & Health Logging
* Period start/end logging with interactive cycle calendar.
* Predictions for follicular, ovulatory, luteal, and menstrual phases.
* Granular tracking: Flow intensity, cervical mucus, pain/cramps, basal body temperature, sexual activity, and custom symptoms.
* Visual cycle history chart and symptom recurrence breakdown.

### 2. 🌿 Haven & Mindful Journal
* Safe, private space for personal thoughts, reflections, and emotional well-being.
* Tagging, search, and date-anchored notes.
* Immediate local encryption on every keystroke.

### 3. 👥 Anonymous Community & E2E Peer Chat
* Botanical & celestial avatar identity system (no real names or emails required).
* Category filters: Cycle & Period, PCOS & Endometriosis, Mood & Mind, Wellness.
* 1-Tap empathy reactions (*Hug*, *Relate*, *Helpful*, *Strength*).
* **Direct 1:1 Encrypted Chat**: Client-side **ECDH P-256 + AES-256-GCM** encryption. Server cannot decrypt messages.
* Built-in crisis helpline detection and quick-access 24/7 support resources.

### 4. 🤝 Granular Partner & Doctor Sharing
* Share temporary, time-bounded cycle data with a partner or medical professional.
* Selective scope: Choose to share only cycle dates, or include symptoms and basal temperature.
* Wrapped master keys encrypted with recipient's public key (revocable with 1 click).

### 5. 🥷 Duress & Decoy Protection
* Configure a secondary **Decoy Passcode** in Privacy Settings.
* Entering the decoy passcode unlocks an authentic but completely blank SheZen haven, protecting you from coerced inspection.

### 6. ⚡ Biometric Fast Unlock (WebAuthn)
* Unlock effortlessly with Touch ID, Face ID, or Windows Hello.
* Session keys remain purely in memory and are discarded on lock/tab close.

### 7. 💾 Local & Cloud Backup
* **Local .shezen File**: Export a password-protected JSON backup for cold offline storage.
* **Encrypted Cloud Sync**: Opt-in zero-knowledge multi-device sync via serverless NeonDB.

---

## 🔐 Cryptographic Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Device (Browser / PWA)"]
        UserPass["User Passcode / PIN"] -->|Argon2id KDF| WrapKey["Wrapping Key (256-bit)"]
        MasterKey["Master Encryption Key (AES-256-GCM)"]
        
        MasterKey -->|Wrap with WrapKey| EncMasterKey["Wrapped Key Blob + Salt + IV"]
        
        RawData["Plaintext Cycle / Note Data"] -->|Encrypt with MasterKey| Ciphertext["Encrypted Ciphertext + 12-byte IV"]
        
        RecoveryPhrase["24-Word Recovery Phrase"] -->|Argon2id| RecoveryWrapKey["Recovery Wrapping Key"]
        MasterKey -->|Wrap with RecoveryWrapKey| EncRecoveryKey["Recovery Wrapped Key Blob"]
    end
    
    subgraph Storage ["Storage Layer"]
        Ciphertext -->|Store Locally| Dexie["IndexedDB (Local-First)"]
        EncMasterKey -->|Store Locally| DexieKeyStore["IndexedDB KeyStore"]
        
        Ciphertext -.->|Opt-In Sync (Ciphertext Only)| NeonDB[("NeonDB Serverless PostgreSQL")]
        EncMasterKey -.->|Opt-In Cloud Backup| NeonDB
        EncRecoveryKey -.->|Opt-In Cloud Backup| NeonDB
    end
```

### Encryption Primitives:
* **Symmetric Encryption**: `AES-256-GCM` with random 12-byte initialization vectors (IVs) per record.
* **Key Derivation Function (KDF)**: `Argon2id` (Memory: 64 MiB, Iterations: 3, Parallelism: 1, Length: 32 bytes) via WebAssembly.
* **Asymmetric Exchange (Chat & Sharing)**: `ECDH` on the `P-256` NIST curve for peer key derivation.
* **Double Hashing**: Passwords sent to server for session verification are hashed with `SHA-256` client-side, then salted and hashed with `bcrypt (cost 12)` server-side.

---

## 📊 Trust Model Comparison

| Feature | Trust Model | Who Can Decrypt? | Server Storage |
| :--- | :--- | :--- | :--- |
| **Cycle & Health Logs** | **Zero-Knowledge** | You only (Client) | Encrypted ciphertext only |
| **Haven Journal Notes** | **Zero-Knowledge** | You only (Client) | Encrypted ciphertext only |
| **Decoy Haven Profile** | **Zero-Knowledge** | Decoy profile key | Separate encrypted records |
| **1:1 Direct Chat** | **End-to-End (E2E)** | You & Recipient | Ephemeral ciphertext |
| **Public Forum Posts** | **Encrypted at Rest** | Community Members | Encrypted (Server holds key for moderation) |

---

## 🛠️ Tech Stack

* **Framework**: [Next.js 16 (App Router & Turbopack)](https://nextjs.org/)
* **Language**: [TypeScript 5](https://www.typescriptlang.org/)
* **Local Database**: [Dexie.js](https://dexie.org/) (IndexedDB wrapper)
* **Cloud Database**: [Neon Serverless PostgreSQL](https://neon.tech/) + [Drizzle ORM](https://orm.drizzle.team/)
* **Cryptography**: Native WebCrypto API + [hash-wasm](https://github.com/Daninet/hash-wasm)
* **UI & Styling**: CSS Design Tokens, Vanilla CSS Modules, [Lucide Icons](https://lucide.dev/)
* **Session Auth**: [jose](https://github.com/panva/jose) (Edge-compatible JWTs in httpOnly cookies)

---

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) v18.18.0 or later
* npm / pnpm / yarn
* A free [Neon](https://neon.tech) PostgreSQL database (optional for local-only use, required for cloud sync & community)

### 1. Clone the repository
```bash
git clone https://github.com/X3cutioners/SheZen.git
cd SheZen
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup environment variables
Copy the template configuration:
```bash
cp .env.example .env.local
```

Open `.env.local` and add your database connection string and JWT secret:
```env
DATABASE_URL="postgresql://username:password@your-neon-host/neondb?sslmode=require"
JWT_SECRET="your-secure-random-jwt-secret-at-least-32-chars"
```

### 4. Push database schema
Push the Drizzle schema to your Neon database:
```bash
npx drizzle-kit push
```

### 5. Run development server
```bash
npm run dev
```

Visit **`http://localhost:3000`** in your browser.

---

## 📂 Project Architecture

```
shezen/
├── app/
│   ├── (app)/                  # Authenticated application layout
│   │   ├── cycle/              # Cycle tracking, calendar & predictions
│   │   ├── haven/              # Encrypted journal & symptoms notes
│   │   ├── community/          # Moderated forum & 1:1 E2E encrypted chat
│   │   └── privacy/            # Cloud backup, sharing, biometrics, decoy mode
│   ├── api/                    # Serverless Next.js API endpoints
│   │   ├── signup/             # Zero-knowledge cloud account registration
│   │   ├── login/              # Passcode verification & session creation
│   │   ├── sync/               # Push / pull encrypted ciphertext blobs
│   │   ├── recovery/           # 24-word key unlock & passcode reset
│   │   ├── community/          # Posts, replies, reactions & E2E chat routing
│   │   └── sharing/            # Ephemeral doctor/partner key grants
│   ├── setup/                  # First-run onboarding & 24-word key generation
│   └── unlock/                 # Passcode unlock, biometric auth & recovery modal
├── lib/
│   ├── crypto/                 # WebCrypto encryption, Argon2id, ECDH & biometrics
│   ├── db/                     # Drizzle ORM client, schemas & JWT helpers
│   ├── local-db/               # Dexie IndexedDB client & offline storage
│   ├── sync/                   # Last-write-wins synchronization engine
│   └── moderation/             # Distress signal detection & crisis resources
├── docs/                       # Comprehensive specifications & threat models
├── public/                     # Static assets, PWA manifest & service worker
└── drizzle.config.ts           # Drizzle database migration config
```

---

## 🛡️ Threat Model & Privacy Guarantees

1. **Subpoena Resistance**: Because all cycle entries and notes are encrypted with keys derived client-side on your device, no readable personal data can be provided from server logs or database dumps.
2. **Device Seizure (Decoy Mode)**: If coerced into unlocking the application, entering the secondary decoy PIN renders an empty profile.
3. **Data Portability**: You can export all your records at any time as an encrypted `.shezen` backup or export decrypted data as JSON.
4. **No Third-Party Analytics**: No Google Analytics, Meta Pixel, tracking scripts, or ad networks are present.

---

## 📚 Documentation Specs

For detailed architectural and security specifications, explore the [`docs/`](docs/) directory:
* [`00-PRODUCT.md`](docs/00-PRODUCT.md) — Product requirements and UX philosophy
* [`01-ARCHITECTURE.md`](docs/01-ARCHITECTURE.md) — System architecture and PWA engine
* [`02-SECURITY.md`](docs/02-SECURITY.md) — Cryptographic specifications and threat analysis
* [`03-DATA-MODEL.md`](docs/03-DATA-MODEL.md) — Schema definitions and storage layers
* [`04-API-SPEC.md`](docs/04-API-SPEC.md) — REST API endpoints and payload formats
* [`05-DESIGN.md`](docs/05-DESIGN.md) — Design tokens, typography, and accessibility guidelines

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with care for privacy, autonomy, and security. 🌸
</p>
