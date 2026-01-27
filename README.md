# QAerx - Intelligent Test Automation Chrome Extension

AI-Assisted Automation Testing Chrome Extension

QAerx is a privacy-first automation testing Chrome extension that supports UI/E2E testing and API testing in a unified workflow. It runs entirely in the browser, stores all data locally, and optionally uses AI for smarter test data generation and selector suggestions.

## ✨ Features

### Core Functionality
- **📹 Visual Test Recording**: Record user interactions and automatically generate test steps
- **📊 Data-Driven Testing**: Run tests with multiple data sets using variable substitution (`{{variable}}`)
- **🎯 Smart Element Selection**: Visual element picker with intelligent CSS selector generation
- **✅ Real-Time Validation**: Live validation of selectors with element count and status indicators
- **▶️ Step-by-Step Execution**: Watch tests execute with real-time visual feedback
- **🔄 Multi-Page Navigation**: Seamless navigation between pages with automatic content script injection

### Advanced Features
- **⏱️ Wait Strategies**:
  - Time-based waits (milliseconds)
  - Element-based waits (wait until element appears)
- **🧠 Selector Intelligence**:
  - Prioritizes stable selectors (ID, name, aria labels)
  - Form field detection and optimization
  - Multiple fallback selector strategies
- **🎨 Visual Feedback**:
  - Color-coded step status (🔵 running, ✅ passed, ❌ failed)
  - Inline error messages with duration tracking
  - Progress bars for test execution
- **👁️ Element Highlighting**: Preview elements on the page before execution
- **🔧 Flexible Step Types**:
  - Navigate to URL
  - Click element
  - Type text
  - Select dropdown option
  - Wait (time or element)
  - Assert visibility

## 🚀 Installation

### From Source (Development)

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/qaerx.git
   cd qaerx
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder from the project directory

### Production Build

For production deployment:
```bash
npm run build
```

The extension will be built to the `dist` folder, ready for distribution.

## 📖 Usage

### Creating Your First Test

1. **Open the Extension**
   - Click the QAerx icon in Chrome toolbar
   - Or use the side panel (recommended for better workflow)

2. **Create a New Test**
   - Click "+ New Test"
   - Enter test name and starting URL
   - Click "Create"

3. **Add Test Steps**
   - Click "Add Step" button
   - Choose step type (Click, Type, Navigate, Wait, etc.)
   - Use the "Pick" button to visually select elements
   - Configure step details

### Data-Driven Testing

1. **Navigate to Data Tab**
   - Open your test
   - Click on the "Data" tab

2. **Add Data Sets**
   - Click "+ Add Row" to create new data sets
   - Define variables (e.g., `email`, `password`, `username`)
   - Add multiple rows for different test scenarios

3. **Use Variables in Steps**
   - In any text field, use `{{variableName}}` syntax
   - Example: `{{email}}`, `{{password}}`
   - Variables will be replaced during execution

### Example: Login Test with Multiple Users

**Steps:**
```
1. Type text → #email → {{email}}
2. Type text → #password → {{password}}
3. Click → button[type="submit"]
4. Wait → 2000ms (wait for page load)
5. Navigate → https://example.com/dashboard
```

**Data:**
| email              | password    |
|--------------------|-------------|
| user1@test.com     | pass123     |
| user2@test.com     | pass456     |
| admin@test.com     | adminpass   |

The test will run 3 times, once for each data set.

## 📁 Project Structure

```
QAerx/
├── src/
│   ├── background/          # Background service worker
│   │   └── index.ts
│   ├── content/             # Content scripts
│   │   ├── index.ts
│   │   ├── recorder/        # Recording engine
│   │   ├── playback/        # Playback engine
│   │   ├── picker/          # Element picker
│   │   └── highlighter/     # Element highlighter
│   ├── sidepanel/           # Side panel UI
│   │   ├── components/
│   │   │   ├── tests/       # Test management
│   │   │   ├── steps/       # Step editor
│   │   │   └── data/        # Data panel
│   │   ├── hooks/           # React hooks
│   │   └── utils/
│   ├── popup/               # Extension popup
│   ├── core/                # Core business logic
│   │   └── storage/         # IndexedDB repositories
│   └── types/               # TypeScript definitions
├── public/                  # Static assets
├── dist/                    # Built extension (generated)
├── manifest.json            # Extension manifest
├── vite.config.ts          # Vite configuration
└── package.json
```

## 🏗️ Architecture

### Components

1. **Background Script** (`background/index.ts`)
   - Manages extension lifecycle
   - Handles tab communication
   - Coordinates between content scripts and UI

2. **Content Scripts** (`content/`)
   - Injected into web pages
   - Executes test steps on the page
   - Records user interactions
   - Provides element picking functionality

3. **Side Panel** (`sidepanel/`)
   - Main UI for test creation and management
   - Built with React and TypeScript
   - Real-time test execution monitoring

4. **Storage Layer** (`core/storage/`)
   - IndexedDB for local data persistence
   - Dexie.js wrapper for database operations
   - Repositories for tests, suites, and credentials

### Key Technologies

- **React 18**: UI framework
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and dev server
- **Dexie.js**: IndexedDB wrapper
- **Tailwind CSS**: Utility-first styling
- **Lucide React**: Icon library
- **React Hot Toast**: Toast notifications

## 💻 Development

### Prerequisites

- Node.js 16+ and npm
- Chrome browser
- Basic knowledge of TypeScript and React

### Development Mode

```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check

# Linting
npm run lint
```

### Development Workflow

1. Make code changes in `src/`
2. Run `npm run build` to rebuild
3. Reload extension in Chrome (`chrome://extensions/`)
4. Test your changes

### Hot Reload (Optional)

For faster development, you can use:
```bash
npm run dev
```

This watches for file changes and rebuilds automatically. You'll still need to reload the extension in Chrome after each build.

## ✅ Best Practices

### Writing Reliable Tests

1. **Use Stable Selectors**
   - Prefer IDs and name attributes
   - Avoid auto-generated classes
   - Use data-testid attributes when possible

2. **Add Wait Steps**
   - After navigation, add a wait step
   - After form submission, wait for page load
   - Use "Wait for Element" for dynamic content

3. **Organize Tests into Suites**
   - Group related tests
   - Use descriptive names
   - Add tags for filtering

4. **Use Descriptive Names**
   - Clear step names help debugging
   - Include expected behavior in test names

### Performance Tips

- Keep data sets reasonable (avoid 1000+ rows)
- Use "Wait for Element" instead of long time waits when possible
- Clean up old test results periodically

## 🔧 Troubleshooting

### Common Issues

**Q: "Message channel closed" error**
- **Solution**: This happens when the page is cached. The latest version handles this automatically by executing wait steps in the sidepanel.

**Q: Element not found**
- **Solution**:
  - Use the visual picker to select elements
  - Check if element is in an iframe
  - Add a wait step before the action
  - Verify selector with the Eye (preview) button

**Q: Test runs on wrong page**
- **Solution**:
  - Set the correct starting URL in test settings
  - Add navigation steps between page transitions
  - Ensure wait steps after navigation

**Q: Content script not loading**
- **Solution**: The extension auto-injects content scripts. If issues persist, manually reload the page.

### Debug Mode

Enable verbose logging:
1. Open DevTools (F12)
2. Check Console for `[QAerx]` messages
3. Monitor Network tab for API calls

## 🗺️ Roadmap

### Planned Features

- [ ] API testing support
- [ ] Visual regression testing
- [ ] Test result reporting
- [ ] CI/CD integration
- [ ] Cloud sync for tests
- [ ] Collaborative test editing
- [ ] Screenshot capture on failure
- [ ] Video recording
- [ ] Performance metrics
- [ ] Cross-browser support

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use TypeScript strict mode
- Follow existing code formatting
- Add comments for complex logic
- Write meaningful commit messages

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/qaerx/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/qaerx/discussions)
- **Email**: support@qaerx.com

## 🙏 Acknowledgments

- Built with [Claude](https://claude.ai) assistance
- Inspired by Selenium, Cypress, and Playwright
- Thanks to the open-source community

---

**Made with ❤️ for QA Engineers**

Happy Testing! 🚀
