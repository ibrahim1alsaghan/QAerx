# QAerx

**AI Agent for Automated Web Testing**

[![OpenAI API](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?logo=openai)](https://openai.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension%20MV3-4285F4?logo=googlechrome)](https://developer.chrome.com/docs/extensions/)

QAerx is an intelligent Chrome extension that uses LLM-powered analysis to automate web testing. It combines traditional record-and-replay automation with AI-driven page understanding, semantic data generation, and context-aware test creation.

**Keywords:** LLM, AI Agent, NLP, Prompt Engineering, GPT-4, Intelligent Automation, Web Testing

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

## Core Features

- **Record & Replay** - Record user actions and play them back automatically
- **Data-Driven Testing** - Run same test with multiple data sets using `{{variables}}`
- **Visual Element Picker** - Click to select elements, no manual selector writing
- **Smart Selectors** - Automatically finds the best CSS selectors (ID, name, aria, etc.)
- **Real-Time Validation** - See element count and status as you type selectors
- **Wait Strategies** - Wait for time or wait until elements appear
- **Multi-Page Support** - Navigate between pages seamlessly during tests
- **Live Execution Tracking** - Watch tests run with color-coded status
- **Test Suites** - Organize tests into folders
- **CSV Import/Export** - Import test data from spreadsheets
- **Local Storage** - All data stored in browser IndexedDB, fully private

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

### AI/ML Components

```
┌─────────────────────────────────────────────────────────────┐
│                      QAerx AI Layer                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ LLM Service  │  │   Prompt     │  │  Response    │       │
│  │ (OpenAI API) │  │  Templates   │  │   Parser     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│         │                 │                 │               │
│         ▼                 ▼                 ▼               │
│  ┌─────────────────────────────────────────────────┐        │
│  │              AI Service Orchestrator             │        │
│  │  • Rate limiting  • Caching  • Error handling   │        │
│  └─────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

| Component | Description |
|-----------|-------------|
| **LLM Integration** | OpenAI GPT-4o-mini for intelligent analysis |
| **Prompt Engineering** | Custom prompts for page analysis, data generation, selector healing |
| **NLP Processing** | Language detection, RTL/LTR classification, semantic field naming |
| **DOM Understanding** | AI interprets page structure without manual configuration |
| **Graceful Degradation** | Fallback mechanisms when AI is unavailable |

### Extension Architecture

```
src/
├── background/          # Service worker (Chrome MV3)
├── content/             # Page scripts (recorder, playback, picker)
├── sidepanel/           # Main UI (React app)
├── core/
│   ├── services/ai/     # AI service layer & prompt templates
│   ├── services/fonts/  # Font loading for PDF reports
│   └── storage/         # IndexedDB layer (Dexie.js)
├── shared/              # Shared utilities & messaging
└── types/               # TypeScript types
```

### AI Service Layer

- **Centralized LLM Communication** - Single service handles all AI requests
- **Modular Prompts** - Separate templates for different AI tasks
- **Robust JSON Extraction** - Handles markdown-wrapped and raw JSON responses
- **Error Handling** - Retry logic, graceful fallbacks, user-friendly messages
- **Rate Limiting** - Prevents API abuse and manages costs

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
| **jsPDF** | PDF report generation |
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

### Create a Test
1. Click QAerx icon in Chrome toolbar
2. Click "+ New Test"
3. Enter test name and starting URL

### Add Steps
- Click "Add Step" → choose type (Click, Type, Navigate, Wait)
- Use "Pick" button to visually select elements
- Or use **AI Page Analyzer** to auto-generate steps

### AI-Powered Data Generation
1. Go to "Data" tab
2. Click **"Generate with AI"** for smart data
3. Or click **"Generate Scenarios"** for edge case coverage
4. Use `{{variableName}}` in steps to reference data

### Example: Login Test

**Steps (can be auto-generated by AI):**
```
Type → #email → {{email}}
Type → #password → {{password}}
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

## Development

```bash
npm install          # Install dependencies
npm run dev          # Dev server (auto-rebuild)
npm run build        # Production build
npm run build:quick  # Skip TypeScript check
```

After building, reload the extension in Chrome to see changes.

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
