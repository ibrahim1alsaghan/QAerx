# QAerx

**AI Agent for Automated Web Testing**

[![OpenAI API](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?logo=openai)](https://openai.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension%20MV3-4285F4?logo=googlechrome)](https://developer.chrome.com/docs/extensions/)

QAerx is an intelligent Chrome extension that uses LLM-powered analysis to automate web testing. It combines traditional record-and-replay automation with AI-driven page understanding, semantic data generation, and context-aware test creation.

**Keywords:** LLM, AI Agent, NLP, Prompt Engineering, GPT-4, Intelligent Automation, Web Testing

---

## What's New (v0.1.0)

### One-Click Recording
- **Floating Record Button** - Always-visible button to start recording instantly
- No need to create a test first - record now, save later
- Save to new test or append to existing test

### Smart Selector Detection
- **Dynamic ID Detection** - Automatically detects and avoids unstable selectors
- Supports Frappe, React, Angular, Vue, MUI, and 20+ framework patterns
- Visual stability indicators in element picker (✓ stable, ⚠️ unstable)
- Falls back to stable attributes (name, aria-label, placeholder)

### Arabic & RTL Support
- **Full Arabic text support** in PDF reports
- Amiri font loaded from CDN for proper Unicode rendering
- RTL text alignment in tables and data

### AI Status Indicator
- Real-time AI availability status in header
- Green (ready), Yellow (no API key), Red (offline)
- Quick link to configure API key

### Enhanced Error Handling
- Centralized error management with error codes
- User-friendly error messages
- Graceful fallbacks for all features

---

## AI-Powered Features

| Feature | Description |
|---------|-------------|
| **AI Page Analyzer** | Uses LLM to understand page structure, form semantics, and optimal test scenarios |
| **Context-Aware Data Synthesis** | Generates realistic test data based on field semantics and page context |
| **Semantic Variable Extraction** | AI extracts meaningful variable names from DOM context |
| **NLP-Based Language Detection** | Automatically detects page language and RTL/LTR direction |
| **Visual Debugging with AI Context** | Captures screenshots on failure with contextual analysis |
| **Self-Healing Selectors** | AI suggests alternative selectors when elements change |
| **Scenario-Based Testing** | Auto-generates best-case, worst-case, edge-case, and boundary test data |

## Core Features

- **Record & Replay** - Record user actions and play them back automatically
- **One-Click Recording** - Start recording instantly with floating button
- **Data-Driven Testing** - Run same test with multiple data sets using `{{variables}}`
- **Visual Element Picker** - Click to select elements with stability indicators
- **Smart Selectors** - Automatically finds the best CSS selectors, avoids dynamic IDs
- **Real-Time Validation** - See element count and status as you type selectors
- **Wait Strategies** - Wait for time or wait until elements appear
- **Multi-Page Support** - Navigate between pages seamlessly during tests
- **Live Execution Tracking** - Watch tests run with color-coded status
- **Test Suites** - Organize tests into folders
- **CSV Import/Export** - Import test data from spreadsheets
- **PDF Reports** - Generate comprehensive reports with Arabic/Unicode support
- **Local Storage** - All data stored in browser IndexedDB, fully private

---

## Smart Selector Detection

QAerx automatically detects and avoids unstable/dynamic selectors that change on page refresh:

### Detected Dynamic Patterns

| Framework | Pattern Examples |
|-----------|-----------------|
| **Frappe** | `frappe-ui-5`, `frappe_ui_8`, `control-1-2` |
| **React** | `:r0:`, `react-select-1` |
| **Angular** | `ng-5`, `ng_123` |
| **MUI** | `mui-456` |
| **HeadlessUI** | `headlessui-listbox-1` |
| **Radix** | `radix-dropdown-5` |
| **Select2** | `select2-email-container` |
| **Generic** | UUIDs, hashes, pure numbers |

### Selector Priority Order

1. `data-testid` / `data-cy` (highest stability)
2. `aria-label` attributes
3. Stable IDs (non-dynamic)
4. `name` attributes
5. `placeholder` attributes
6. Semantic CSS classes
7. Text content
8. Full CSS path (fallback)

---

## AI Features Deep Dive

### 1. Intelligent Page Analysis (AI Page Analyzer)

The AI analyzes raw DOM and extracts:
- **Form structure** and field relationships
- **Input types** and validation requirements
- **Page context** (login, signup, checkout, search, etc.)
- **Optimal test scenarios** based on page purpose

```
Page → LLM Analysis → Structured Test Steps + Smart Selectors
```

### 2. Semantic Data Generation (Context-Aware Data Synthesis)

Instead of random data, the AI generates contextually appropriate values:

| Capability | Example |
|------------|---------|
| Field semantics | Understands "email" vs "phone" from labels/placeholders |
| Edge cases | Generates boundary values, special characters, empty strings |
| Locale awareness | Arabic names for RTL pages, localized formats |
| Data consistency | Related fields maintain logical relationships |
| Scenario types | Best case, worst case, edge case, boundary testing |

### 3. Self-Healing Selectors (AI-Assisted)

When selectors break due to UI changes, AI suggests alternatives based on:
- Element attributes and context
- Surrounding DOM structure
- Historical selector patterns
- Semantic similarity

### 4. NLP-Based Language Detection

Automatically detects:
- Page language from content analysis
- RTL/LTR text direction
- Appropriate test data locale

---

## Technical Architecture

### Extension Architecture

```
src/
├── background/          # Service worker (Chrome MV3)
├── content/             # Page scripts (recorder, playback, picker)
│   ├── recorder/        # Recording engine & selector generator
│   ├── picker/          # Visual element picker
│   └── helpers/         # Page analyzer with field detection
├── sidepanel/           # Main UI (React app)
│   ├── components/      # UI components
│   │   ├── ai/          # AI status indicator
│   │   ├── recording/   # Floating record button
│   │   ├── tests/       # Test editor & runner
│   │   └── settings/    # Settings panel
│   └── hooks/           # Custom React hooks
├── core/
│   ├── services/        # Core services
│   │   ├── ai/          # AI service layer & prompts
│   │   ├── fonts/       # Arabic font loader for PDFs
│   │   └── PDFReport... # PDF generation with Unicode
│   ├── storage/         # IndexedDB layer (Dexie.js)
│   └── utils/           # Error handling, utilities
├── config/              # Environment & constants
└── types/               # TypeScript types
```

### AI Service Layer

- **Centralized LLM Communication** - Single service handles all AI requests
- **Modular Prompts** - Separate templates for different AI tasks
- **Robust JSON Extraction** - Handles markdown-wrapped and raw JSON responses
- **Error Handling** - Retry logic, graceful fallbacks, user-friendly messages
- **Rate Limiting** - Prevents API abuse and manages costs

### Configuration System

```typescript
// src/config/env.ts
export const defaultConfig = {
  ai: { provider: 'openai', model: 'gpt-4o-mini', maxTokens: 4096 },
  execution: { defaultTimeout: 30000, maxParallelTests: 3 },
  storage: { maxTestHistory: 100 },
  features: { aiDataGeneration: true, selectorHealing: true }
};
```

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **OpenAI API** | GPT-4o-mini for LLM features |
| **TypeScript** | Type-safe development |
| **React 18** | UI framework |
| **Vite** | Build tool |
| **Dexie.js** | IndexedDB wrapper |
| **Tailwind CSS** | Styling |
| **jsPDF** | PDF report generation with Arabic support |
| **Chrome MV3** | Extension platform |

---

## Installation

```bash
# Clone and install
git clone https://github.com/yourusername/qaerx.git
cd qaerx
npm install

# Build
npm run build

# Load in Chrome
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the "dist" folder
```

### AI Setup (Optional)

1. Go to **Settings** in QAerx
2. Enter your OpenAI API key
3. AI features will be enabled automatically

> Without an API key, QAerx works as a traditional test automation tool. AI features enhance but don't replace core functionality.

---

## Quick Start

### One-Click Recording (New!)
1. Open any webpage
2. Click the **floating Record button** (bottom-right)
3. Perform your actions on the page
4. Click **Stop** when done
5. Save to a new test or add to existing test

### Create a Test Manually
1. Click QAerx icon in Chrome toolbar
2. Click "+ New Test"
3. Enter test name and starting URL

### Add Steps
- Click "Add Step" → choose type (Click, Type, Navigate, Wait)
- Use "Pick" button to visually select elements
- Or use **Collect Fields** to auto-detect form fields
- Or use **AI Page Analyzer** to auto-generate steps

### AI-Powered Data Generation
1. Go to "Data" tab
2. Click **"Generate with AI"** for smart data
3. Or click **"Generate Scenarios"** for edge case coverage
4. Use `{{variableName}}` in steps to reference data

### Example: Login Test

**Steps (can be auto-generated by AI):**
```
Navigate → https://example.com/login
Type → [name="email"] → {{email}}
Type → [name="password"] → {{password}}
Click → button[type="submit"]
Wait → 2000ms
```

**AI-Generated Data (Context-Aware):**
| Scenario | email | password |
|----------|-------|----------|
| Best Case | user@example.com | ValidPass123! |
| Edge Case | a@b.co | A1! |
| Boundary | max_length_email...@test.com | 128CharPassword... |
| Worst Case | invalid-email | (empty) |

---

## PDF Reports

QAerx generates comprehensive PDF reports with:
- Test execution summary (pass/fail/skip rates)
- Step-by-step execution log
- Data set results with scenario badges
- Failure analysis with error messages
- **Full Arabic/Unicode support** via Amiri font

---

## Development

```bash
npm install          # Install dependencies
npm run dev          # Dev server (auto-rebuild)
npm run build        # Production build
npm run build:quick  # Skip TypeScript check
```

After building, reload the extension in Chrome to see changes.

---

## Project Structure

```
qaerx/
├── src/                 # Source code
├── dist/                # Built extension (gitignored)
├── scripts/             # Build scripts
├── manifest.json        # Chrome extension manifest
├── vite.config.ts       # Vite configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies
```

---

## Contributing

1. Fork the repo
2. Create feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push: `git push origin feature-name`
5. Open Pull Request

---

## License

MIT

---

<p align="center">
  <strong>QAerx</strong> - AI Agent for Automated Web Testing<br>
  <sub>Built with LLM intelligence for smarter test automation</sub>
</p>
