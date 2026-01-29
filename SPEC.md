# QAerx - Automation Testing Application

## Overview

QAerx is a free Chrome browser extension for automation testing that supports both UI/E2E and API testing. The application features AI-powered test data generation (when API key is configured) and manual data entry modes, with a privacy-first local-only architecture.

---

## Core Features

### Testing Capabilities
- **UI/E2E Testing**: Browser automation for clicking buttons, filling forms, user flow validation
- **API Testing**: HTTP request testing, response validation, integrated in unified timeline with UI steps
- **Unified Timeline**: API calls appear as steps in the same flow as UI actions, blocking by default with parallel override option

### Test Data Modes
1. **Manual Data Entry**: JSON/CSV file import for test data
2. **AI-Generated Data** (requires OpenAI API key):
   - Context-aware generation analyzing field names, labels, and validation rules
   - Falls back to schema-based or user prompt for ambiguous fields
   - Always includes edge cases: empty strings, SQL injection attempts, XSS payloads, boundary values

---

## Architecture

### Platform
- **Chrome Extension** (Chrome only, no Firefox/Safari support)
- Elevated extension permissions to bypass CORS restrictions
- Client-side test execution in user's browser

### Storage (Local-Only)
- **Credentials**: Encrypted locally using Web Crypto API (browser built-in), never leaves device
- **Test Results**: Stored locally only, no cloud sync
- **Test Definitions**: Stored locally in abstract JSON format (exportable to multiple targets later)

### Network Requirements
- **Online Required**: Internet connectivity needed for all features
- AI features require OpenAI API key when configured

---

## Test Creation Workflow

### Record + Edit (Recommended Approach)
1. User performs actions on target site
2. Extension records all actions (clicks, inputs, scrolls) automatically
3. User edits/refines recorded steps in visual or code view
4. Smart filtering removes noise while preserving intent

### Element Discovery
- **Hybrid Approach**: Auto-crawl DOM combined with user refinement
- **AI Suggestions Panel**: Discovered elements shown as suggestions user can accept/reject/modify
- **Selector Priority**: data-testid first, falls back to other stable selectors

### Selector Strategy
1. `data-testid` / `data-cy` attributes (highest priority)
2. ARIA labels and roles
3. Stable CSS selectors
4. Text content matching (lowest priority)

---

## Test Execution

### Smart Waits
- AI detects loading states and automatically waits for DOM stability
- **Fixed timeout**: 30 seconds for all waits
- Handles SPAs, async data loading, and dynamic content

### Parallel Execution
- Support for multiple browser contexts (different users/sessions)
- **User-configurable limit** based on their machine's capabilities
- Same test can run with different data in parallel

### Error Handling
- **Continue and Report**: Mark failed step, continue remaining steps, report all failures at end
- Self-healing selectors: AI suggests fixes for broken selectors but **does not auto-apply** (requires user approval)

### Anti-Bot Detection
- **Detect and Warn**: When blocked by CAPTCHA or bot detection, warn user and let them handle manually

---

## Assertions & Validation

### Visual Comparison (Primary)
- Screenshot comparison at assertion points
- **Tolerance Options**:
  - Pixel threshold (allow X% difference)
  - Ignore regions (user marks dynamic content areas)
  - Perceptual diff (AI-powered, ignores insignificant changes)

### Failure Debugging
- Screenshot capture at failure point
- Full DOM snapshot
- **Failure Triage**: Auto-retry with different AI-generated data to distinguish "bad test data" vs "real bug"

---

## Test Organization

### Structure
- **Suites with Hooks**: Folders with before/after hooks for shared setup and cleanup
- Tests organized into suites
- Shared configuration at suite level

### Limits
- **Performance-based**: Dynamic limits based on user's system capabilities
- No arbitrary hard limits on steps or complexity

### Environments
- No environment support (tests use hardcoded URLs)
- Single target URL per test

---

## User Interface

### Theme
- **Single creative dark theme** (no light mode)
- Modern, visually distinctive design

### Test Results Display
- **Step-by-step timeline**: Visual timeline showing each step's status with screenshots
- Real-time execution progress with live step view

### Execution Feedback
- **Live Step View**: Real-time view of current step being executed during test run

### Accessibility
- **Basic keyboard shortcuts** for essential actions (run, stop, save)
- Mouse-first design

---

## Authentication Handling

### Target Site Auth
- **Stored Credentials**: User provides login credentials
- Credentials encrypted locally using Web Crypto API
- App performs login before each test run

### Complex DOM
- **iframe Support**: Traverse into iframes seamlessly
- Shadow DOM: Not supported in initial version

---

## AI Integration

### Provider
- **OpenAI API** (user provides their own API key)
- AI features disabled until key is configured
- Manual data entry works without API key

### AI Capabilities
1. **Test Data Generation**: Context-aware with edge cases
2. **Element Discovery**: Suggestions for testable elements
3. **Self-Healing**: Selector repair suggestions (user-approved)
4. **Failure Triage**: Re-run analysis to classify failures

---

## Onboarding

### First-Time Experience
- **Interactive Tutorial**: Guided walkthrough creating first test on a demo site
- Step-by-step instructions for:
  - Installing extension
  - Recording first test
  - Running and viewing results
  - Configuring AI (optional)

---

## Technical Stack

### Frontend
- **React** for extension UI
- Chrome Extension Manifest V3

### Storage
- IndexedDB for local persistence
- Web Crypto API for encryption

### Test Format
- **Abstract internal JSON format**
- Designed for future export to Playwright/Cypress/other formats

---

## Privacy & Security

### Data Handling
- **No telemetry**: Complete privacy, no data collection
- **No cloud sync**: All data stays on user's device
- **No export/sharing**: Tests cannot be shared with others

### Credential Security
- AES encryption using Web Crypto API
- Keys derived from browser's secure storage
- Credentials never transmitted

---

## Scheduling & CI/CD

### Execution Mode
- **On-demand only**: User manually triggers tests
- No scheduled/recurring runs
- No CI/CD integration or export

---

## Target Audience

- **All skill levels**: Technical QA engineers, developers, and non-technical users
- Designed for accessibility without requiring programming knowledge
- Power features available for advanced users

---

## Business Model

- **Completely free**: No monetization, no paid tiers
- Open for community use

---

## Out of Scope (v1)

- Firefox/Safari support
- Shadow DOM traversal
- Environment variables / multi-environment support
- Test export/sharing
- Scheduled test runs
- Cloud storage/sync
- Telemetry/analytics

---

## Future Considerations

- Export to Playwright/Cypress formats
- Shadow DOM support
- Multi-environment configuration
- Team sharing capabilities (would require cloud infrastructure)
