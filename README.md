# QAerx

**AI-Powered Test Automation Chrome Extension**

QAerx is a Chrome extension for automated UI testing that runs entirely in your browser. No cloud dependencies, all data stored locally with optional AI assistance for smarter testing.

## Features

- **Record & Replay** - Record user actions and play them back automatically
- **Data-Driven Testing** - Run same test with multiple data sets using `{{variables}}`
- **AI Data Generation** - Generate realistic test data with AI assistance
- **Visual Element Picker** - Click to select elements, no manual selector writing
- **Smart Selectors** - Automatically finds the best CSS selectors (ID, name, aria, etc.)
- **Real-Time Validation** - See element count and status as you type selectors
- **Element Preview** - Highlight elements on page before running tests
- **Wait Strategies** - Wait for time or wait until elements appear
- **Multi-Page Support** - Navigate between pages seamlessly during tests
- **Live Execution Tracking** - Watch tests run with color-coded status (blue=running, green=passed, red=failed)
- **Inline Error Reports** - See exactly what failed and why, with execution time
- **Test Suites** - Organize tests into folders
- **CSV Import/Export** - Import test data from spreadsheets
- **Local Storage** - All data stored in browser IndexedDB, fully private

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

## Quick Start

### Create a Test
1. Click QAerx icon in Chrome toolbar
2. Click "+ New Test"
3. Enter test name and starting URL

### Add Steps
- Click "Add Step" → choose type (Click, Type, Navigate, Wait)
- Use "Pick" button to visually select elements (no need to write selectors manually)
- Configure step details

### Data-Driven Testing
1. Go to "Data" tab
2. Click "+ Add Row"
3. Define variables: `email`, `password`, etc.
4. Add multiple rows for different test scenarios
5. Use `{{variableName}}` in steps to reference data

### Example: Login with Multiple Users

**Steps:**
```
Type → #email → {{email}}
Type → #password → {{password}}
Click → button[type="submit"]
Wait → 2000ms
Navigate → https://example.com/dashboard
```

**Data:**
```
email              | password
-------------------|----------
user1@test.com     | pass123
user2@test.com     | pass456
```

Test runs twice (once per data row).

## Tech Stack

- **React 18** + TypeScript
- **Vite** - Build tool
- **Dexie.js** - IndexedDB wrapper
- **Tailwind CSS** - Styling
- **Chrome Extensions Manifest V3**

## Project Structure

```
src/
├── background/     # Service worker
├── content/        # Page scripts (recorder, playback, picker)
├── sidepanel/      # Main UI (React app)
├── core/storage/   # IndexedDB layer
└── types/          # TypeScript types
```

## Development

```bash
npm install          # Install dependencies
npm run dev          # Dev server (auto-rebuild)
npm run build        # Production build
npm run type-check   # TypeScript check
```

After building, reload the extension in Chrome to see changes.

## Tips

- Use the visual picker instead of writing selectors manually
- Add wait steps after navigation and form submissions
- Prefer "Wait for Element" over fixed time delays
- Use descriptive test and step names
- Keep data sets under 100 rows for better performance
- Organize tests into suites by feature/module

**Debug:**
- Open DevTools (F12)
- Check Console for `[QAerx]` messages

## Contributing

1. Fork the repo
2. Create feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push: `git push origin feature-name`
5. Open Pull Request