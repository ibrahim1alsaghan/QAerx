# QAerx

**AI Agent for Automated Web Testing**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?logo=openai)](https://openai.com)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension%20MV3-4285F4?logo=googlechrome)](https://developer.chrome.com/docs/extensions/)

Chrome extension that uses AI to automate web testing. No code required.

---

## Installation
```bash
git clone https://github.com/ibrahim1alsaghan/QAerx.git
cd QAerx
npm install
npm run build
```

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → select `dist` folder

---

## 3 Ways to Create Tests

| Method | Description |
|--------|-------------|
| **Natural Language** | Write "Login with admin@test.com" → AI builds the test |
| **Smart Collect** | One click → AI detects all form fields |
| **Manual Record** | Record your actions → becomes a test |

---

## AI Features

- **AI Page Analyzer** - Understands page structure and form semantics
- **Smart Data Generation** - Generates realistic data (supports Arabic/RTL)
- **Failure Analyzer** - Analyzes why tests fail and suggests fixes
- **Self-Healing Selectors** - AI finds alternatives when selectors break

---

## Core Features

- Auto Playback
- Test History
- PDF Reports
- Test Suites
- Data-Driven Testing with `{{variables}}`

---

## Privacy

All data stored locally. No cloud. No servers.

---

## Tech Stack

TypeScript • React 18 • OpenAI API • Chrome Extension MV3 • IndexedDB

---

## License

MIT
