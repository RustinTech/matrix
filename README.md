# Rustin's Matrix Kanban

A premium, offline-first Kanban board and Eisenhower Matrix application. Designed for speed, privacy, and visual excellence.

![Matrix Preview](https://github.com/RustinTech/matrix/blob/main/screenshot/screenshot.png)
![Matrix Mode](https://github.com/RustinTech/matrix/blob/main/screenshot/matrixmode.png)

## 🚀 Two Ways to Use

### 1. Standalone Web Page (`index.html`)
- Open the file directly in any browser.
- Uses `localStorage` to save your data safely on your machine.
- Zero dependencies, completely portable.

### 2. Chrome Extension (`MatrixExtension/`)
- Replaces your **New Tab** page with the Kanban board.
- Uses `chrome.storage` for enhanced data persistence.
- Offline-enabled and security-hardened.
- **To Install:**
  1. Go to `chrome://extensions` in Chrome.
  2. Enable **Developer mode** (top right).
  3. Click **Load unpacked** and select the `MatrixExtension` folder.

---

## ✨ Key Features

- **Kanban & Matrix Views:** Seamlessly switch between a traditional progress board and an Eisenhower Matrix (Urgent/Important) View.
- **Multi-Board Support:** Create multiple boards for different projects and switch between them instantly.
- **Subtasks:** Break down complex tasks into smaller, manageable steps.
- **Glassmorphism UI:** A modern, stunning aesthetic with translucent panels and mesh gradients.
- **Offline Ready:** All libraries are bundled locally. No internet connection required.
- **Data Portability:** Export your boards to JSON for backup or import them on a different device.
- **PDF Export:** High-quality, print-friendly PDF generation for your boards.
- **Privacy:** Your data never leaves your computer.

---

## ⌨️ Keyboard Shortcuts

Speed is at the core of the experience. Master these shortcuts to stay in the flow:

### General
- <kbd>N</kbd> — Create a **New Task**
- <kbd>B</kbd> — Create a **New Board**
- <kbd>M</kbd> — **Toggle View** (Switch between Kanban and Matrix)
- <kbd>T</kbd> — **Toggle Theme** (Dark/Light mode)
- <kbd>S</kbd> — Open **Settings**
- <kbd>?</kbd> or <kbd>/</kbd> — Show **Help & Shortcuts**
- <kbd>Esc</kbd> — Close any modal or cancel input

### Navigation & Management
- <kbd>~</kbd> or <kbd>`</kbd> — **Switch Boards** (Cycles through your tabs)
- <kbd>Tab</kbd> — Select/Focus tasks on the board
- <kbd>Ctrl</kbd> + <kbd>Z</kbd> — **Undo** (Last 30 actions)
- <kbd>I</kbd> — **Import** data (JSON)
- <kbd>O</kbd> — **Export** data (JSON)
- <kbd>P</kbd> — **Export PDF**
- <kbd>Ctrl</kbd> + <kbd>P</kbd> — Standard Browser Print

### Task Interaction
- <kbd>Double Click</kbd> — Add or Edit a task or Rename a board tab
- <kbd>Enter</kbd> — Save Task (while editing) or Add Subtask (in subtask field)
- <kbd>Ctrl</kbd> + <kbd>Enter</kbd> — Save & Close (from the subtask field)
- <kbd>Delete</kbd> or <kbd>Backspace</kbd> — Delete focused task

---

## 🛠️ Built With
- Vanilla HTML5 & CSS3
- Modern ES6+ JavaScript
- [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) — Locally bundled for PDF generation.
- [Inter Font](https://fonts.google.com/specimen/Inter) — Clean, legible typography.

