# Project: Breathing Trainer PWA (TypeScript + Vanilla JS, Deno)

## 1. Core Technical Stack
- **Language:** TypeScript (strict)
- **Frontend Framework:** Vanilla JavaScript (no framework)
- **Runtime/Tooling:** Deno (no Node/NPM)
- **Target:** Web (PWA)
- **Build Tool:** Deno tooling (tasks, bundling as needed)
- **PWA Requirements:** Service Worker for offline support, Manifest.json, and Icons.
- **Security Policy:** - Avoid NPM/Node.js ecosystem entirely.
    - Use Deno-native modules or URL imports.
    - Focus on strict typing and minimal dependencies.

## 2. Functional Logic (Wim Hof Method)
The application must manage 3 distinct phases in a loop:
1. **Power Breathing:** A counter for 30-40 deep breaths (visual feedback required).
2. **Retention:** A stopwatch starting after the last exhale, stopping on user input.
3. **Recovery:** A 15-second countdown timer triggered after retention.

## 3. Data Persistence
- **Storage:** LocalStorage or IndexedDB.
- **Preferred Library:** Web APIs directly (no framework).
- **Goal:** Store session history (date, number of rounds, max retention time).

## 4. UI/UX Requirements
- **Design:** Minimalist, calm, mobile-first (PWA).
- **Styling:** Tailwind CSS (Deno-compatible build pipeline) or plain CSS.
- **Components to implement:**
    - `BreathCircle`: Animated visual for inhale/exhale.
    - `PhaseController`: State machine managing the 3 phases.
    - `HistoryLog`: View for past sessions from IndexedDB.

## 5. Coding Agent Instructions
- Use **TypeScript** for all logic (strict typing).
- Ensure all code runs in modern browsers and is compatible with Deno tooling.
- Provide instructions for Deno tasks and any build steps needed to handle PWA assets.
- When generating code, include comments explaining TypeScript-specific concepts where they apply to the UI logic.
