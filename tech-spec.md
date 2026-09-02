# Technical Architecture Specification

## 1. Stack & Runtime
- **Frontend**: Standards-compliant HTML5, CSS3, Modern JavaScript (ES6+ Modules / Vanilla JS).
- **Styling**: Responsive CSS custom properties (design tokens), Flexbox, CSS Grid.
- **Persistence**: Browser `localStorage` API.
- **PWA Capabilities**: Web App Manifest (`manifest.json`) and Service Worker (`sw.js`) for offline asset caching and standalone display mode.

## 2. Directory Layout
```
expense-tracker/
├── index.html          # Application shell & semantic structure
├── style.css           # Design tokens, mobile & desktop layouts
├── app.js              # Business logic, state management, UI rendering
├── manifest.json       # PWA manifest for Android, iOS, Windows, Mac
├── sw.js               # Service worker for offline capability
├── icons/              # App icons for mobile/desktop install
├── tests/              # Automated verification test suite
├── agents.md           # Agent operational guidelines
├── product-design.md   # MVP scope & boundaries
└── tech-spec.md        # Technical specification
```

## 3. Data Schema
Transaction object:
```json
{
  "id": "uuid/string",
  "amount": 12.50,
  "category": "Food & Dining",
  "date": "2026-09-02",
  "note": "Lunch at cafe",
  "createdAt": 1725253161000
}
```

## 4. State Management
- Single source of truth in memory: `transactions` array.
- Reactive updates: Every state mutation (add, delete) triggers `saveToStorage()` and `renderApp()`.
