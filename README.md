# Microsoft Fabric Interactive Guided Onboarding Engine

An interactive, declarative, in-portal guided learning browser extension (Manifest V3) and offline sandbox for **Microsoft Fabric** (`app.fabric.microsoft.com`).

## Key Capabilities

- **In-Portal Spotlight & Contextual Coaching:** Highlights real Microsoft Fabric buttons and cards across both the top-level shell and nested workload `<iframe>` canvases (Lakehouse Explorer, Eventhouse KQL Database, Fabric IQ Ontology).
- **Click-Once Auto-Dismiss Highlight:** Automatically dismisses the highlight ring as soon as you click the target control so it never blocks your canvas while you work.
- **Top-Layer Modal Awareness (`#top-layer` Popover API):** Stays above native Fabric modal dialogs (`New Lakehouse`, `New Ontology`) and automatically shifts aside to avoid covering centered dialogs.
- **Zero-Context-Switching Lab Accelerators:**
  - **One-Click Copy Chips (`copyChips`)** for exact artifact, table, entity, and relationship names.
  - **In-Panel Reference Tables (`referenceTable`)** for multi-property schemas and mappings.
  - **Direct Sample Data Download Links (`downloadLinks`)** right inside the guided panel.
  - **Multi-Action Step Locking (`manualAdvanceOnly`)** so repetitive steps (e.g., creating 5 entities or converting 5 CSVs) never skip ahead prematurely.
- **Two-File Decoupled Architecture + Copilot Instructions:**
  - `lessons.js` — Declarative JSON lesson playbook (includes Quick Start Lakehouse + full 3-part **MS Learn Lab 23: Create an Ontology with Fabric IQ**).
  - `content.js` — Universal spotlight, state, and Shadow DOM rendering engine.
  - `.github/copilot-instructions.md` — Codified rules enabling GitHub Copilot to turn any Microsoft Learn lab into a new guided journey in minutes.

## Quick Start (Load in Microsoft Edge or Google Chrome)

1. Open `edge://extensions` (or `chrome://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this `fabric-guided-learning-ext` folder.
4. Open [https://app.fabric.microsoft.com](https://app.fabric.microsoft.com) (or open `demo/mock-fabric-portal.html` locally to test in the offline sandbox).
