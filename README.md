---

# QAerx

**AI-Assisted Automation Testing Chrome Extension**

QAerx is a privacy-first automation testing Chrome extension that supports **UI/E2E testing and API testing in a unified workflow**. It runs entirely in the browser, stores all data locally, and optionally uses AI for smarter test data generation and selector suggestions.

---

## 🚀 Key Features

### 🧪 Testing Capabilities

* **UI / E2E Testing** – Record and automate browser interactions (clicks, inputs, scrolls, navigation).
* **API Testing** – Send HTTP requests and validate responses directly in the same test flow.
* **Unified Timeline** – UI steps and API calls appear in one execution timeline (blocking by default, parallel optional).

---

### 🧠 Test Data Generation

**Two modes supported:**

1. **Manual Mode** – Import JSON/CSV test data.
2. **AI Mode (Optional)** – Requires user-provided OpenAI API key.

   * Context-aware data generation (field names, labels, validation rules).
   * Automatic edge cases (empty values, boundary values, SQL injection, XSS payloads).
   * Schema-based fallback for ambiguous fields.

---

## 🏗 Architecture

### Platform

* Chrome Extension (Manifest V3)
* Runs fully client-side inside the browser
* Elevated permissions to bypass CORS restrictions

### Local-Only Storage

* **Credentials**: Encrypted using Web Crypto API
* **Test Results**: Stored locally
* **Test Definitions**: Stored as abstract JSON (future export planned)

> No telemetry, no cloud sync, no remote storage.

---

## 🧩 Test Creation Workflow

### Record → Edit (Recommended)

1. User performs actions on the target website
2. Extension records UI actions automatically
3. User edits steps visually or in code view
4. Noise is filtered while preserving intent

### Element Discovery

* Hybrid DOM crawling + user refinement
* AI suggestions panel for discovered elements
* Selector priority:

  1. `data-testid` / `data-cy`
  2. ARIA labels and roles
  3. Stable CSS selectors
  4. Text matching (lowest priority)

---

## ▶ Test Execution

### Smart Waits

* AI detects DOM stability and loading states
* Fixed timeout: **30 seconds** per wait

### Parallel Execution

* Multiple browser contexts supported
* User-configurable parallelism based on machine performance

### Error Handling

* Continue on failure, report all errors at end
* AI suggests selector fixes (user approval required)

### Anti-Bot Detection

* Detects CAPTCHA / bot blocks and warns user

---

## ✅ Assertions & Debugging

### Visual Assertions (Primary)

* Screenshot comparison
* Tolerance controls:

  * Pixel threshold
  * Ignore regions
  * Perceptual diff (AI-assisted)

### Failure Debugging

* Screenshot at failure
* Full DOM snapshot
* AI re-run triage to classify **bad test data vs real bug**

---

## 🗂 Test Organization

* Test Suites with before/after hooks
* Shared suite configuration
* No hard limits on steps or complexity
* Single target URL per test (v1)

---

## 🎨 User Interface

* Single dark creative theme
* Step-by-step execution timeline with screenshots
* Real-time execution progress view
* Basic keyboard shortcuts (run, stop, save)

---

## 🔐 Authentication Handling

* Encrypted stored credentials for target sites
* Auto-login before test execution
* iframe traversal supported
* Shadow DOM not supported (v1)

---

## 🤖 AI Integration

### Provider

* OpenAI API (user supplies key)
* AI features disabled until configured

### AI Capabilities

* Test data generation
* Element discovery suggestions
* Selector self-healing suggestions
* Failure triage classification

---

## 🧑‍🏫 Onboarding

* Interactive guided tutorial
* Demo site for first test creation
* Step-by-step walkthrough:

  * Install extension
  * Record test
  * Run test
  * Configure AI (optional)

---

## 🧰 Tech Stack

* **React** (Extension UI)
* **Chrome Extension Manifest V3**
* **IndexedDB** for storage
* **Web Crypto API** for encryption

---

## 🔒 Privacy & Security

* No telemetry or analytics
* No cloud storage
* No data sharing/export (v1)
* AES encryption for credentials
* Keys stored in browser secure storage

---

## ⚙ Scheduling & CI/CD

* Manual execution only (v1)
* No scheduling
* No CI/CD export or integration

---

## 🎯 Target Audience

* QA Engineers
* Developers
* Non-technical users

Power features available for advanced users, but no coding required for basic automation.

---

## 💰 Business Model

* Completely free
* No paid tiers
* Community-focused

---

## ❌ Out of Scope (v1)

* Firefox / Safari support
* Shadow DOM traversal
* Multi-environment configs
* Test export/sharing
* Scheduled runs
* Cloud sync
* Telemetry / analytics

---

## 🔮 Future Roadmap

* Export to Playwright / Cypress
* Shadow DOM support
* Multi-environment configuration
* Team collaboration & sharing (cloud-based)

---

## 📄 License

MIT (or choose your preferred license)

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome.

---

## ⭐ Acknowledgements

Built to simplify automation testing with AI while keeping **privacy and local-first execution as the core principle**.
