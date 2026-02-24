MVP Scope (Minimum Viable Product)
Goal: Provide a functional, minimalist Wim Hof style trainer that tracks progress locally.

Phase 1: Core Engine (Must-Haves)
State Management: An AppStateMachine enum (Prepare, Breathe, Hold, Recovery, Summary).

The Circle: A reactive SVG component that scales based on a Lerp (Linear Interpolation) function driven by the "Speed" setting.

Timer Logic: A precise Rust-based timer for Retention and Recovery.

Local Persistence: Save Session objects containing:

Date/Time.

Array of rounds (duration of each hold).

Settings used (Speed, Breath count).

Phase 2: User Settings & UI
Settings Menu:

Prepare time (Seconds).

Breathing Speed (Slow, Normal, Fast).

Default breath count.

Session Summary: A screen appearing after "Finish" showing total time and best retention hold.

Phase 3: Analytics & Aesthetics
History View: A simple list of past sessions.

Calendar Heatmap: A visual indicator of days with completed exercises.

Basic Chart: A line chart showing retention time trends across rounds.
