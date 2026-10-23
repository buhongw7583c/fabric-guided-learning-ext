# Copilot Instructions — Microsoft Fabric Guided Learning Extension

This repository contains the **Microsoft Fabric Guided Learning** browser extension (`manifest.json`, `lessons.js`, `content.js`, `popup.html`, `popup.js`) and local interactive sandbox (`demo/mock-fabric-portal.html`).

When adding new tutorials/labs or modifying the overlay engine, **strictly follow the architectural rules below** to avoid common SPA, Shadow DOM, and cross-iframe bugs in Microsoft Fabric (`app.fabric.microsoft.com`).

---

## 1. Two-File Decoupled Architecture

- **`lessons.js` (Declarative Playbook):** Contains `window.FABRIC_GUIDED_LESSONS`. Adding a new tutorial or MS Learn lab should only require adding/editing JSON-like lesson objects in `lessons.js`.
- **`content.js` (Universal Engine):** Handles Shadow DOM rendering, `#top-layer` popover management, multi-strategy element resolution, cross-iframe spotlight synchronization, and local storage persistence.

---

## 2. Rules for Authoring New Tutorials in `lessons.js`

1. **Choose 100% Browser-Native Flows:**
   - Prioritize workflows that happen inside the Microsoft Fabric web portal (`app.fabric.microsoft.com`). Avoid steps that require switching to an external OS terminal or local Docker CLI unless strictly necessary.

2. **Strict "One Action = One Step" Granularity (Prevent Premature Step Skipping):**
   - Never combine opening a menu, choosing an item card, and submitting a naming modal into a single step.
   - Always split creation flows into 3 distinct steps:
     - **Step A:** Click `+ New item` in the workspace toolbar.
     - **Step B:** Click the artifact card (e.g., `Lakehouse`, `Eventhouse`, `Ontology (preview)`) in the drawer.
     - **Step C:** Paste the artifact name in the modal dialog and click `Create`.

3. **Lock Multi-Action / Repetitive Steps with `manualAdvanceOnly: true`:**
   - Whenever a step requires the user to perform multiple clicks or repeat an action several times on the same screen (e.g., uploading 5 CSV files, converting 5 files to tables, creating 5 Entity Types, or adding 5 Relationships):
     - **MUST set `manualAdvanceOnly: true`** on that step object.
     - This prevents the engine from auto-advancing on the first click, keeping the reference table and copy chips on screen until the user clicks `Next →`.

4. **Eliminate Context-Switching (Use `copyChips`, `referenceTable`, and `downloadLinks`):**
   - **`copyChips: ["LamnaHealthcareLH", ...]`:** Provide one-click clipboard chips for every exact artifact name, table name, entity name, key name, or relationship name the user needs to type.
   - **`referenceTable: { headers: [...], rows: [[...]] }`:** Embed compact cheat-sheet tables directly in the step definition whenever the user needs to configure multiple properties, types, or mappings.
   - **`downloadLinks: [{ label: "📥 Download ...", url: "https://..." }]`:** Provide direct download buttons for lab sample datasets.

5. **Always Provide Dual Target Selectors (`selectors` + `roleAndText`):**
   - In `target`, include both attribute selectors (`[data-testid*='...']`, `button[aria-label*='...']`) and `roleAndText` fallbacks (`{ role: "button", text: "..." }`).

---

## 3. Rules for Modifying the Engine in `content.js`

1. **Cross-Iframe State Synchronization (`saveState()` is Mandatory):**
   - In live Microsoft Fabric, the main shell runs in `window.top`, while workload canvases (Lakehouse Explorer, Ontology Editor, KQL Database) often run inside child `<iframe>` elements.
   - Any state change that affects spotlight visibility (such as `spotlightMutedForStep`, `stepIndex`, `isDismissed`, `isActive`, or `customTargets`) **MUST immediately call `saveState()`** so `chrome.storage.local` notifies child iframes via `chrome.storage.onChanged`.

2. **Dismiss Spotlight Immediately Once User Starts Acting (`spotlightMutedForStep`):**
   - The spotlight ring and dark callout are for *locating* the control—they must never annoy or block the user once they start working.
   - As soon as the user clicks the highlighted target control (whether in `window.top` or in a child `<iframe>`), set `state.spotlightMutedForStep = step.id` and call `saveState()` to immediately remove the highlight ring and callout.
   - Do not use full-screen dimming shadows (`0 0 0 9999px`) on `.fgl-spotlight-ring`.

3. **Never Call Full `render()` on Background Polls or `MutationObserver` Ticks:**
   - Live Fabric triggers dozens of DOM mutations per second. Calling `render()` (`rootWrap.innerHTML = ""`) on every mutation destroys open dropdown menus and interrupts user clicks.
   - Background intervals and `MutationObserver` callbacks must call `syncTargetAndSpotlight()`, which updates `.fgl-spotlight-ring` and `.fgl-callout` coordinates in place and only calls `render()` when `targetStatus` or the resolved element reference actually changes.
   - Use custom in-panel menus (`.fgl-lesson-menu`) instead of native `<select>` elements inside the Shadow DOM.

4. **Stay in the Browser `#top-layer` (`popover="manual"`) & Auto-Dodge Modals:**
   - Fabric modal dialogs (e.g., `New Ontology`, `New Lakehouse`) use the browser's top layer and set `inert` on background siblings.
   - Keep `host.setAttribute("popover", "manual")` and use `promoteHostToTopOfTopLayer()` + `computeSafePanelPosition()` when dialogs open so the Guided Learning panel always remains above modal backdrops, strips any `inert` attribute, and automatically shifts aside to avoid covering centered dialogs.
