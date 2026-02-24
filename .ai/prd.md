Product Requirements Document (PRD)
Project Name: breathwork-trainer

Version: 1.0

Stack: TypeScript (strict), Vanilla JavaScript, Deno, PWA, Tailwind CSS.

Follow the SFC (Single File Component) pattern for Web Components. Keep the HTML template, CSS, and TypeScript logic for each component inside its respective file in src/components/ to maintain high modularity.

Core Philosophy: Minimalism, High Performance, Privacy (Local-first), Security (No NPM/Node).

1. User Experience Flow
Preparation Phase: User clicks "GO". A countdown (default 10s, customizable) prepares the user.

Power Breathing Phase: * Visual: An expanding/shrinking circle with visible min/max borders.

Text: "IN" during expansion, "OUT" during contraction.

Audio: Synced background music (cached offline).

Trigger: Round ends automatically at a set breath count (default 30) OR immediately via "Double Tap" on the "EXHALATION MODE" button.

Exhalation & Hold (Retention): * User exhales and holds. A stopwatch tracks the duration.

Action: User clicks a button to move to the next phase when they need to inhale.

Recovery Phase: * Inhale and hold for 15s.

Visual: Countdown with alerts/indicators at 10s, 5s, and 0s.

Transition/Finish: * After recovery, user can "Finish" (Save to DB) or wait 5s to start the next round automatically.

2. Technical Requirements
Performance: 60fps animations for the BreathCircle using efficient DOM updates and requestAnimationFrame.

Offline First: PWA Manifest and Service Worker must cache the logic and audio assets.

Storage: Implement a Repository Pattern in TypeScript. The UI interacts with an interface, while the implementation uses Web APIs for IndexedDB/LocalStorage. This allows for easy migration to a backend (PostgreSQL/Cloud) later.
