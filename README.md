# 💸 Expense Tracker

A calm, minimalist, offline-first Progressive Web App for logging and reviewing your personal spending — no sign-in, no backend, no network dependency. Your data lives on your device.

**🔗 Live Demo:** https://fishcake07.github.io/expense-tracker/
**📦 Repository:** https://github.com/fishCake07/expense-tracker

> ✨ **Built with vibe coding.** This project was developed through conversational, AI-assisted ("vibe coded") development rather than a traditional hand-written-from-scratch workflow. See [Development Notes](#-development-notes) below.

---

## Overview

Expense Tracker is a single-page, installable PWA for quickly logging daily expenses and reviewing where your money goes — on any device, in seconds, without creating an account.

## ✨ Features

- **Quick expense entry** — amount, category (with icons & color tags), date (defaults to today), and an optional note
- **Transaction history** — reverse-chronological list with category, note, and formatted amount
- **Delete with safeguard** — instant delete with an undo/confirmation step
- **Spending summary** — total spend card plus a category breakdown with proportions
- **Receipt photos** — attach and auto-compress a receipt image to a transaction
- **Fully responsive** — mobile layout with touch-friendly controls; desktop layout with side-by-side dashboard cards
- **Installable PWA** — add to your home screen on Android, iOS, Windows, or Mac and use it offline
- **100% local & private** — no account, no server, no analytics; everything stays on your device

## 🗄️ Data Storage & Backups

All data is stored locally in the browser using **IndexedDB** (not just `localStorage`), which gives a much higher storage ceiling — important since receipt photos are stored alongside transactions.

To keep that local data safe, the app layers in automatic backups:

- **Rolling snapshots** — a full snapshot of your data is saved automatically every ~12 hours and the last 7 are kept, so a single corrupted write can't wipe out your history.
- **Linked backup folder** *(Chromium browsers only — Chrome, Edge, etc.)* — optionally link a real folder on your computer via the File System Access API. The app then writes a backup file there on every save, so a copy survives even if you clear your browser's storage.
- **Manual export** — export a full JSON backup or a CSV (for Excel/Sheets) at any time from Settings, and re-import a JSON backup later.
- **Restore from snapshot** — browse and restore any automatic snapshot from Settings → Backup & Data Management.

> Safari and Firefox don't support the linked-folder backup (no File System Access API support yet), but rolling snapshots and manual export still work everywhere.

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3, vanilla JavaScript (ES6+) — no frameworks, no build step
- **Styling:** CSS custom properties (design tokens), Flexbox, CSS Grid
- **Persistence:** IndexedDB, with automatic migration from older `localStorage` data
- **PWA:** Web App Manifest + Service Worker for offline support and home-screen installability

## 🚀 Getting Started

This is a fully static app with no backend and no build process.

### Run it locally

Because the app uses a Service Worker and the Fetch API, it needs to be served over `http://` or `https://` rather than opened directly as a `file://` URL. Any static file server works:

```bash
# Using Python
python -m http.server 8000

# Using Node (npx)
npx serve .
```

Then open `http://localhost:8000` in your browser.

### Install as an app

Open the live demo (or your locally served copy) in a supported browser and use the browser's "Install" / "Add to Home Screen" option.

## 📁 Project Structure

```
expense-tracker/
├── index.html          # Application shell & semantic structure
├── style.css            # Design tokens, mobile & desktop layouts
├── app.js                # Business logic, state management, UI rendering
├── db.js                  # IndexedDB persistence, snapshots & local backups
├── sw.js                   # Service worker for offline caching
├── manifest.json            # PWA manifest (Android, iOS, Windows, Mac)
├── agents.md                 # AI agent operating rules for this repo
├── product-design.md          # Product scope & MVP boundaries
├── tech-spec.md                 # Technical architecture notes
└── README.md                     # You are here
```

## 🧭 Roadmap / Out of Scope

These are intentionally **not** part of the current MVP:

- Income tracking and budget limit alerts
- Multi-currency conversion
- Cloud account sync and authentication
- Receipt OCR / auto-scanning (manual photo attachment only, for now)

## 🤖 Development Notes

This app was built using **vibe coding** — an iterative, conversational development process where features, fixes, and refactors were driven through natural-language collaboration with an AI assistant rather than being hand-written line by line. As with any vibe-coded project, you should review the code yourself before relying on it for anything sensitive.

## 📄 License

No license has been specified for this project — all rights reserved by the author. If you'd like to use, modify, or distribute this code, please reach out first.

## 🙌 Credits

Developed by [@fishCake07](https://github.com/fishCake07).
