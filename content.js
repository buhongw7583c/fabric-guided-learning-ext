/**
 * Microsoft Fabric Guided Learning Overlay — Content Script
 *
 * Features:
 * 1. Isolated Shadow DOM Learning Panel (immune to Fabric CSS collisions & Fluent UI z-index issues)
 * 2. Multi-Strategy Target Resolver (data-testid -> aria-label -> role+text -> recovery fallback)
 * 3. Spotlight Highlighter + Animated Callout Popover (Driver.js-style built-in, zero external dependencies)
 * 4. Reactive Progress Engine (MutationObserver + click listeners + route tracking)
 * 5. Local Storage Persistence + Optional Web Speech API Narration
 */
(function () {
  if (window.__FABRIC_GUIDED_LEARNING_LOADED__) return;
  window.__FABRIC_GUIDED_LEARNING_LOADED__ = true;

  const STORAGE_KEY = "fabric_guided_learning_state_v1";
  const lessons = window.FABRIC_GUIDED_LESSONS || [];
  const defaultLesson = lessons[0];

  let state = {
    isDismissed: false,
    isOpen: true,
    isCompact: false,
    isActive: false,
    lessonId: defaultLesson ? defaultLesson.id : "",
    stepIndex: 0,
    completedSteps: {},
    narrationEnabled: false,
    showHint: false,
    showStepList: false,
    showLessonMenu: false,
    spotlightMutedForStep: null,
    targetStatus: "idle", // "idle" | "found" | "missing" | "completed"
    simulatingMissingTarget: false,
    panelPos: null, // { left: number, top: number }
    customTargets: {}, // { [stepId]: { selector: string, label: string } }
    pickingTargetForStep: null
  };

  // Load saved state from chrome.storage.local or localStorage fallback
  function loadState(cb) {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([STORAGE_KEY], (res) => {
          if (res && res[STORAGE_KEY]) {
            state = { ...state, ...res[STORAGE_KEY] };
          }
          cb();
        });
      } else {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) state = { ...state, ...JSON.parse(raw) };
        cb();
      }
    } catch (e) {
      cb();
    }
  }

  function saveState() {
    const toSave = {
      isDismissed: state.isDismissed,
      isOpen: state.isOpen,
      isCompact: state.isCompact,
      isActive: state.isActive,
      lessonId: state.lessonId,
      stepIndex: state.stepIndex,
      completedSteps: state.completedSteps,
      narrationEnabled: state.narrationEnabled,
      panelPos: state.panelPos,
      customTargets: state.customTargets,
      spotlightMutedForStep: state.spotlightMutedForStep
    };
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [STORAGE_KEY]: toSave });
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      }
    } catch (e) {
      // ignore storage errors on restricted pages
    }
  }

  function getCurrentLesson() {
    return lessons.find((l) => l.id === state.lessonId) || defaultLesson;
  }

  function getCurrentStep() {
    const lesson = getCurrentLesson();
    if (!lesson) return null;
    return lesson.steps[state.stepIndex] || null;
  }

  // ---------------------------------------------------------------------------
  // Multi-Strategy Target Resolver (Top Document + Shadow DOM + Iframes)
  // ---------------------------------------------------------------------------
  function getAllSearchRoots() {
    const roots = [];

    function collectRootsFromDoc(doc, frameEl) {
      if (!doc || !doc.body) return;
      roots.push({ root: doc, frameEl });

      // Also traverse open Shadow DOMs inside Fabric components
      const allEls = doc.querySelectorAll("*");
      for (const el of allEls) {
        if (el.id === "fabric-guided-learning-host") continue;
        if (el.shadowRoot) {
          roots.push({ root: el.shadowRoot, frameEl });
        }
      }
    }

    collectRootsFromDoc(document, null);

    const iframes = document.querySelectorAll("iframe");
    for (const frame of iframes) {
      try {
        if (frame.contentDocument && frame.contentDocument.body) {
          collectRootsFromDoc(frame.contentDocument, frame);
        }
      } catch (e) {
        // Cross-origin iframe; handled by child frame content script below
      }
    }
    return roots;
  }

  function getViewportRect(el, frameEl) {
    const rect = el.getBoundingClientRect();
    if (!frameEl) return rect;
    const frameRect = frameEl.getBoundingClientRect();
    return {
      top: rect.top + frameRect.top,
      left: rect.left + frameRect.left,
      bottom: rect.bottom + frameRect.top,
      right: rect.right + frameRect.left,
      width: rect.width,
      height: rect.height
    };
  }

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const rect = el.getBoundingClientRect();
    const win = (el.ownerDocument && el.ownerDocument.defaultView) || window;
    const style = win.getComputedStyle(el);
    return (
      rect.width > 8 &&
      rect.height > 8 &&
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      style.opacity !== "0"
    );
  }

  // Climbs up from a text leaf (e.g. <span>Start with sample data</span>) to the clickable card/tile/button
  function buildBestActionTarget(el) {
    if (!el) return el;
    const interactive = el.closest(
      "button, a, [role='button'], [role='menuitem'], [role='gridcell'], [role='tab'], [role='option'], [role='listitem'], [tabindex='0'], .item-card, .sample-tile"
    );
    if (interactive && isVisible(interactive)) {
      const r = interactive.getBoundingClientRect();
      if (r.width < 460 && r.height < 360) return interactive;
    }

    // In Fabric Lakehouse Explorer, tiles like "Start with sample data" are often styled <div> cards with cursor: pointer
    let cur = el;
    let bestCard = el;
    for (let depth = 0; depth < 5 && cur && cur !== document.body; depth++) {
      const r = cur.getBoundingClientRect();
      if (r.width > 420 || r.height > 340) break;
      const win = (cur.ownerDocument && cur.ownerDocument.defaultView) || window;
      const style = win.getComputedStyle(cur);
      if (
        style.cursor === "pointer" ||
        (r.width >= 90 && r.width <= 340 && r.height >= 80 && r.height <= 280)
      ) {
        bestCard = cur;
      }
      cur = cur.parentElement;
    }
    return bestCard;
  }

  function resolveTargetElement(step) {
    if (!step || !step.target || state.simulatingMissingTarget) return null;

    const searchRoots = getAllSearchRoots();

    // Strategy 0: User-picked custom target override for this step
    const custom = state.customTargets && state.customTargets[step.id];
    if (custom && custom.selector) {
      for (const { root, frameEl } of searchRoots) {
        try {
          const el = root.querySelector(custom.selector);
          if (el && isVisible(el)) {
            return {
              element: el,
              frameEl,
              strategy: `custom-pinned (${custom.label || custom.selector})`
            };
          }
        } catch (e) {}
      }
    }

    // Strategy 1: Explicit CSS / data-testid / aria-label selectors
    if (Array.isArray(step.target.selectors)) {
      for (const sel of step.target.selectors) {
        for (const { root, frameEl } of searchRoots) {
          try {
            const matches = root.querySelectorAll(sel);
            for (const el of matches) {
              if (isVisible(el)) {
                return { element: buildBestActionTarget(el), frameEl, strategy: `selector (${sel})` };
              }
            }
          } catch (e) {
            // ignore invalid selector
          }
        }
      }
    }

    // Strategy 2: Universal Text / Aria-Label / Leaf-Node Scanner
    // Handles Fabric custom cards/divs (like "Start with sample data" tile) even when they have no role="button" or data-testid
    if (Array.isArray(step.target.roleAndText)) {
      for (const rule of step.target.roleAndText) {
        const needle = (rule.text || "").toLowerCase().trim();
        if (!needle) continue;

        for (const { root, frameEl } of searchRoots) {
          // Pass A: Check standard interactive elements first
          const interactiveCandidates = root.querySelectorAll(
            "button, a, [role='button'], [role='menuitem'], [role='tab'], [role='gridcell'], [role='listitem'], [role='option'], [tabindex='0']"
          );
          let bestMatch = null;
          let bestScore = Infinity;

          for (const rawEl of interactiveCandidates) {
            if (!isVisible(rawEl)) continue;
            const text = (rawEl.innerText || rawEl.textContent || "").toLowerCase().replace(/\s+/g, " ").trim();
            const aria = (rawEl.getAttribute("aria-label") || "").toLowerCase().trim();
            const title = (rawEl.getAttribute("title") || "").toLowerCase().trim();

            if (text === needle || aria === needle || title === needle || text.includes(needle) || aria.includes(needle)) {
              const target = buildBestActionTarget(rawEl);
              const r = target.getBoundingClientRect();
              if (r.width < 460 && r.height < 340) {
                const exactBonus = text === needle || aria === needle ? 0.2 : 1;
                const score = r.width * r.height * exactBonus;
                if (score < bestScore) {
                  bestMatch = target;
                  bestScore = score;
                }
              }
            }
          }

          if (bestMatch) {
            return {
              element: bestMatch,
              frameEl,
              strategy: `accessible-text ("${rule.text}")`
            };
          }

          // Pass B: Deep scan ANY visible element (div, span, h3, h4, p) whose own text matches `needle`
          // This catches Fabric Lakehouse cards ("Start with sample data") built from plain <div>/<span> elements
          const allNodes = root.querySelectorAll("div, span, p, h1, h2, h3, h4, h5, label, li");
          for (const node of allNodes) {
            if (!isVisible(node)) continue;
            const rawText = (node.innerText || node.textContent || "").toLowerCase().replace(/\s+/g, " ").trim();
            if (!rawText) continue;

            if (rawText === needle || (rawText.startsWith(needle) && rawText.length < needle.length + 90)) {
              const cardTarget = buildBestActionTarget(node);
              const r = cardTarget.getBoundingClientRect();
              if (r.width >= 30 && r.width < 440 && r.height >= 24 && r.height < 340) {
                return {
                  element: cardTarget,
                  frameEl,
                  strategy: `card-text ("${rule.text}")`
                };
              }
            }
          }
        }
      }
    }

    return null;
  }

  // Auto-detect if user already performed the action or screen already advanced
  function checkAutoAdvanceByDOM() {
    if (!state.isActive) return;
    const lesson = getCurrentLesson();
    if (!lesson) return;

    const currentStep = getCurrentStep();
    if (currentStep && currentStep.advanceWhenVisible) {
      for (const { root } of getAllSearchRoots()) {
        try {
          const nextEl = root.querySelector(currentStep.advanceWhenVisible);
          if (nextEl && isVisible(nextEl)) {
            advanceStep("dom-state-detected");
            return;
          }
        } catch (e) {}
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Narration (Web Speech API)
  // ---------------------------------------------------------------------------
  function speakStep(step) {
    if (!state.narrationEnabled || !step || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const text = step.narration || `${step.title}. ${step.instruction}`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.02;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      // ignore speech errors
    }
  }

  // ---------------------------------------------------------------------------
  // UI Construction (Top-Layer Popover + Shadow DOM + Spotlight Overlay)
  // ---------------------------------------------------------------------------
  const host = document.createElement("div");
  host.id = "fabric-guided-learning-host";
  // Use HTML5 `popover="manual"` so the browser promotes this host into the native #top-layer!
  // In the browser rendering engine, #top-layer sits ABOVE all z-index: 2147483647 dialogs,
  // Fluent UI modals, and inert/aria-hidden focus traps.
  try {
    host.setAttribute("popover", "manual");
  } catch (e) {}
  host.style.cssText =
    "position: fixed !important; inset: 0 !important; width: 0 !important; height: 0 !important; margin: 0 !important; padding: 0 !important; border: none !important; background: transparent !important; overflow: visible !important; z-index: 2147483647 !important; pointer-events: none !important; display: block !important;";
  (document.body || document.documentElement).appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  // Keep host in the browser's #top-layer (above any newly opened Fabric modal or dialog)
  // and strip `inert` if Fabric's modal FocusTrap sets `inert` on body siblings!
  function ensureHostOnTop() {
    const parent = document.body || document.documentElement;
    if (parent && host.parentElement !== parent) {
      parent.appendChild(host);
    }
    if (host.hasAttribute("inert")) {
      host.removeAttribute("inert");
    }
    if (host.getAttribute("aria-hidden") === "true") {
      host.removeAttribute("aria-hidden");
    }
    if (typeof host.showPopover === "function") {
      try {
        // Re-calling hidePopover + showPopover promotes our host to the very top of the #top-layer stack
        // whenever Fabric opens a new <dialog> or Fluent popover
        if (!host.matches(":popover-open")) {
          host.showPopover();
        }
      } catch (e) {}
    }
  }

  function promoteHostToTopOfTopLayer() {
    ensureHostOnTop();
    if (typeof host.hidePopover === "function" && typeof host.showPopover === "function") {
      try {
        host.hidePopover();
        host.showPopover();
      } catch (e) {}
    }
  }

  const styleEl = document.createElement("style");
  styleEl.textContent = `
    :host {
      all: initial;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 0 !important;
      height: 0 !important;
      overflow: visible !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
      font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
      color: #1f2328;
    }
    * {
      box-sizing: border-box;
    }

    /* Spotlight ring & callout anchored to target control (clean ring, no screen-dimming backdrop!) */
    .fgl-spotlight-ring {
      position: fixed;
      pointer-events: none;
      z-index: 2147483644;
      border: 2.5px solid #0f78d4;
      border-radius: 8px;
      box-shadow: 0 0 0 4px rgba(15, 120, 212, 0.22);
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      animation: fgl-pulse 2s infinite;
    }
    @keyframes fgl-pulse {
      0%, 100% { box-shadow: 0 0 0 4px rgba(15, 120, 212, 0.28); }
      50% { box-shadow: 0 0 0 8px rgba(15, 120, 212, 0.08); }
    }

    .fgl-callout {
      position: fixed;
      z-index: 2147483645;
      width: 260px;
      pointer-events: none;
      background: #0f172a;
      color: #f8fafc;
      border-radius: 8px;
      padding: 9px 11px;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.32);
      border: 1px solid rgba(56, 189, 248, 0.45);
      transition: top 0.18s ease, left 0.18s ease;
    }
    .fgl-callout-badge {
      display: inline-block;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #38bdf8;
      margin-bottom: 2px;
    }
    .fgl-callout-title {
      font-size: 12.5px;
      font-weight: 600;
      margin-bottom: 3px;
      color: #ffffff;
    }
    .fgl-callout-desc {
      font-size: 11.5px;
      line-height: 1.4;
      color: #cbd5e1;
    }
    .fgl-callout-meta {
      margin-top: 6px;
      padding-top: 5px;
      border-top: 1px solid rgba(255,255,255,0.1);
      font-size: 10px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Floating Launcher Pill (when minimized) */
    .fgl-launcher {
      position: fixed;
      bottom: 16px;
      left: 84px;
      z-index: 2147483646;
      background: linear-gradient(135deg, #0b6a0b 0%, #107c41 50%, #0f78d4 100%);
      color: #fff;
      border: none;
      border-radius: 999px;
      padding: 9px 15px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      pointer-events: auto !important;
      box-shadow: 0 8px 24px rgba(16, 124, 65, 0.4);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .fgl-launcher:hover {
      transform: translateY(-1px);
    }

    /* Main Guided Learning Docked & Draggable Panel */
    .fgl-panel {
      position: fixed;
      bottom: 16px;
      left: 84px;
      width: 295px;
      max-height: calc(100vh - 32px);
      overflow-y: auto;
      z-index: 2147483647;
      pointer-events: auto !important;
      background: #ffffff;
      border-radius: 10px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.24), 0 0 0 1px rgba(15, 23, 42, 0.1);
      display: flex;
      flex-direction: column;
      user-select: none;
    }

    .fgl-header {
      background: linear-gradient(135deg, #117865 0%, #0f6cbd 100%);
      color: #ffffff;
      padding: 9px 12px;
      border-radius: 10px 10px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: grab;
      gap: 8px;
    }
    .fgl-header:active {
      cursor: grabbing;
    }
    .fgl-brand {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 9.5px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.92;
      margin-bottom: 1px;
    }
    .fgl-lesson-title {
      font-size: 12.5px;
      font-weight: 700;
      line-height: 1.25;
    }
    .fgl-lesson-select-btn {
      margin-top: 3px;
      width: 100%;
      background: rgba(255, 255, 255, 0.18);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: 5px;
      padding: 4px 8px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      text-align: left;
      gap: 6px;
    }
    .fgl-lesson-select-btn:hover {
      background: rgba(255, 255, 255, 0.28);
    }
    .fgl-lesson-menu {
      background: #0f172a;
      border-bottom: 1px solid #334155;
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .fgl-lesson-option {
      background: transparent;
      border: none;
      color: #e2e8f0;
      text-align: left;
      padding: 6px 8px;
      border-radius: 5px;
      font-size: 11.5px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .fgl-lesson-option:hover {
      background: rgba(255, 255, 255, 0.12);
    }
    .fgl-lesson-option.active {
      background: #0f6cbd;
      color: #ffffff;
      font-weight: 700;
    }
    .fgl-header-actions {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }
    .fgl-icon-btn {
      background: rgba(255, 255, 255, 0.16);
      border: none;
      color: #fff;
      width: 24px;
      height: 24px;
      border-radius: 5px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11.5px;
    }
    .fgl-icon-btn:hover {
      background: rgba(255, 255, 255, 0.28);
    }
    .fgl-icon-btn.active {
      background: #ffffff;
      color: #0f6cbd;
    }

    .fgl-progress-bar-wrap {
      background: #f1f5f9;
      padding: 6px 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    .fgl-progress-meta {
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 4px;
    }
    .fgl-progress-track {
      height: 5px;
      background: #cbd5e1;
      border-radius: 99px;
      overflow: hidden;
    }
    .fgl-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #107c41, #0f6cbd);
      transition: width 0.3s ease;
    }

    .fgl-body {
      padding: 11px 12px;
    }

    .fgl-step-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px 8px;
      border-radius: 99px;
      font-size: 10px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .fgl-step-pill.found {
      background: #dcfce7;
      color: #166534;
    }
    .fgl-step-pill.missing {
      background: #fef3c7;
      color: #92400e;
    }
    .fgl-step-pill.idle {
      background: #e0f2fe;
      color: #075985;
    }

    .fgl-step-title {
      font-size: 13.5px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 4px 0;
    }
    .fgl-explain {
      font-size: 11.5px;
      line-height: 1.4;
      color: #475569;
      margin: 0 0 8px 0;
    }
    .fgl-action-box {
      background: #f8fafc;
      border-left: 3px solid #0f6cbd;
      padding: 7px 10px;
      border-radius: 0 6px 6px 0;
      font-size: 11.5px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 8px;
    }

    .fgl-chips-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 8px;
    }
    .fgl-copy-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1d4ed8;
      border-radius: 5px;
      padding: 3px 7px;
      font-size: 10.5px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-weight: 600;
      cursor: pointer;
    }
    .fgl-copy-chip:hover {
      background: #dbeafe;
    }
    .fgl-copy-chip.copied {
      background: #dcfce7;
      border-color: #86efac;
      color: #15803d;
    }

    .fgl-download-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      background: #ecfdf5;
      border: 1px solid #6ee7b7;
      color: #047857;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 11.5px;
      font-weight: 700;
      text-decoration: none;
      margin-bottom: 8px;
    }
    .fgl-download-btn:hover {
      background: #d1fae5;
    }

    .fgl-ref-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      margin-bottom: 8px;
      background: #f8fafc;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    .fgl-ref-table th {
      background: #e2e8f0;
      color: #334155;
      text-align: left;
      padding: 4px 6px;
      font-weight: 700;
    }
    .fgl-ref-table td {
      padding: 4px 6px;
      border-top: 1px solid #e2e8f0;
      color: #1e293b;
      vertical-align: top;
    }

    .fgl-recovery-box {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: 8px 10px;
      margin-bottom: 8px;
      font-size: 11px;
      color: #92400e;
      line-height: 1.4;
    }
    .fgl-recovery-title {
      font-weight: 700;
      margin-bottom: 3px;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .fgl-hint-box {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 6px;
      padding: 8px 10px;
      margin-bottom: 8px;
      font-size: 11px;
      color: #0369a1;
      line-height: 1.4;
    }

    /* Stepper mini list */
    .fgl-step-list {
      margin-top: 6px;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .fgl-step-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      padding: 4px 6px;
      border-radius: 5px;
      cursor: pointer;
      color: #64748b;
    }
    .fgl-step-item:hover {
      background: #f1f5f9;
    }
    .fgl-step-item.current {
      background: #eff6ff;
      color: #1d4ed8;
      font-weight: 600;
    }
    .fgl-step-item.done {
      color: #15803d;
    }

    .fgl-footer {
      padding: 8px 12px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      border-radius: 0 0 10px 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
    }
    .fgl-btn {
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #334155;
      font-size: 11px;
      font-weight: 600;
      padding: 5px 9px;
      border-radius: 5px;
      cursor: pointer;
    }
    .fgl-btn:hover {
      background: #f1f5f9;
    }
    .fgl-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .fgl-btn-primary {
      background: #0f6cbd;
      border-color: #0f6cbd;
      color: #ffffff;
    }
    .fgl-btn-primary:hover {
      background: #115ea3;
    }
    .fgl-btn-success {
      background: #107c41;
      border-color: #107c41;
      color: #ffffff;
    }
  `;
  shadow.appendChild(styleEl);

  const rootWrap = document.createElement("div");
  shadow.appendChild(rootWrap);

  let currentHighlightedEl = null;
  let boundClickHandler = null;

  function detachTargetListener() {
    if (currentHighlightedEl && boundClickHandler) {
      currentHighlightedEl.removeEventListener("click", boundClickHandler, true);
    }
    currentHighlightedEl = null;
    boundClickHandler = null;
  }

  let lastStepAdvanceTime = 0;

  function advanceStep(reason) {
    const now = Date.now();
    // Prevent double-advancing from both click listener and DOM observer firing together
    if (reason !== "manual-next" && now - lastStepAdvanceTime < 450) {
      return;
    }
    lastStepAdvanceTime = now;

    const lesson = getCurrentLesson();
    const step = getCurrentStep();
    if (!lesson || !step) return;

    state.completedSteps[step.id] = true;
    state.showHint = false;
    state.spotlightMutedForStep = null;

    if (state.stepIndex < lesson.steps.length - 1) {
      state.stepIndex += 1;
      saveState();
      render();
      speakStep(getCurrentStep());
    } else {
      // Completed all steps!
      state.targetStatus = "completed";
      saveState();
      render();
    }
  }

  function computeSafePanelPosition(panelWidth, panelHeight) {
    // Default position: top-right area (below Fabric header) or user's dragged position
    let left = state.panelPos && typeof state.panelPos.left === "number" ? state.panelPos.left : 84;
    let top =
      state.panelPos && typeof state.panelPos.top === "number"
        ? state.panelPos.top
        : Math.max(60, window.innerHeight - panelHeight - 24);

    // Clamp to current viewport
    left = Math.min(Math.max(12, left), Math.max(12, window.innerWidth - panelWidth - 16));
    top = Math.min(Math.max(12, top), Math.max(12, window.innerHeight - 100));

    // If user hasn't actively dragged right now, check if a center Fabric modal dialog is open and overlapping!
    if (!isDragging) {
      const openDialogs = document.querySelectorAll(
        "[role='dialog'], dialog[open], .ms-Dialog-main, .fui-DialogSurface, mat-dialog-container"
      );
      for (const dlg of openDialogs) {
        if (!isVisible(dlg)) continue;
        const dr = dlg.getBoundingClientRect();
        if (dr.width < 120 || dr.height < 80) continue;

        const panelRight = left + panelWidth;
        const panelBottom = top + panelHeight;
        const overlapsX = left < dr.right + 12 && panelRight > dr.left - 12;
        const overlapsY = top < dr.bottom + 12 && panelBottom > dr.top - 12;

        if (overlapsX && overlapsY) {
          // Move panel cleanly to the right of the modal (or far-left if modal is on the right)
          if (window.innerWidth - dr.right >= panelWidth + 24) {
            left = dr.right + 16;
          } else if (dr.left >= panelWidth + 24) {
            left = Math.max(12, dr.left - panelWidth - 16);
          } else {
            left = Math.max(12, window.innerWidth - panelWidth - 16);
          }
          break;
        }
      }
    }

      return { left, top };
  }

  function computeCalloutPosition(rect) {
    const calloutWidth = 260;
    const calloutHeight = 110;
    const margin = 12;

    let top = rect.bottom + margin;
    let left = rect.left;

    // If target is inside a right-side drawer (e.g., rect.left > window.innerWidth - 480),
    // place the callout to the LEFT of the target so it never covers the drawer items
    if (rect.left > window.innerWidth - 480 && rect.left - calloutWidth - margin > 12) {
      left = rect.left - calloutWidth - margin;
      top = Math.max(16, rect.top);
      return { top, left };
    }

    // If too low, place above target
    if (top + calloutHeight > window.innerHeight - 20) {
      top = Math.max(16, rect.top - calloutHeight - margin);
    }
    // If too far right, clamp left
    if (left + calloutWidth > window.innerWidth - 20) {
      left = Math.max(16, window.innerWidth - calloutWidth - 20);
    }
    return { top, left };
  }

  // Dragging state (uses capture: true + pointerevents so Fabric modal FocusTrapZones cannot swallow drag events)
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  function onPointerMove(e) {
    if (!isDragging) return;
    const panelEl = shadow.querySelector(".fgl-panel");
    if (!panelEl) return;
    const maxLeft = Math.max(10, window.innerWidth - panelEl.offsetWidth - 10);
    const maxTop = Math.max(10, window.innerHeight - panelEl.offsetHeight - 10);
    const nextLeft = Math.min(maxLeft, Math.max(10, e.clientX - dragOffsetX));
    const nextTop = Math.min(maxTop, Math.max(10, e.clientY - dragOffsetY));

    state.panelPos = { left: nextLeft, top: nextTop };
    panelEl.style.left = `${nextLeft}px`;
    panelEl.style.top = `${nextTop}px`;
    panelEl.style.right = "auto";
    panelEl.style.bottom = "auto";
  }

  function onPointerUp() {
    if (isDragging) {
      isDragging = false;
      saveState();
    }
  }

  window.addEventListener("pointermove", onPointerMove, true);
  window.addEventListener("mousemove", onPointerMove, true);
  window.addEventListener("pointerup", onPointerUp, true);
  window.addEventListener("mouseup", onPointerUp, true);

  function render() {
    ensureHostOnTop();
    const lesson = getCurrentLesson();
    const step = getCurrentStep();
    const totalSteps = lesson ? lesson.steps.length : 0;
    const completedCount = lesson
      ? lesson.steps.filter((s) => state.completedSteps[s.id]).length
      : 0;
    const progressPct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

    detachTargetListener();
    rootWrap.innerHTML = "";

    // Completely dismissed / cleaned up state — zero UI on screen
    if (state.isDismissed) {
      return;
    }

    // Minimized pill view (with a quick ✕ button to remove it completely)
    if (!state.isOpen) {
      const pill = document.createElement("div");
      pill.className = "fgl-launcher";
      pill.innerHTML = `
        <span id="fgl-pill-open" style="cursor:pointer;">🎯 Guided Learning (${completedCount}/${totalSteps})</span>
        <span id="fgl-pill-close" title="Remove guiding box completely" style="cursor:pointer; margin-left:6px; opacity:0.8; font-size:13px; padding:0 4px;">✕</span>
      `;
      pill.querySelector("#fgl-pill-open").addEventListener("click", () => {
        state.isOpen = true;
        saveState();
        render();
      });
      pill.querySelector("#fgl-pill-close").addEventListener("click", (e) => {
        e.stopPropagation();
        state.isActive = false;
        state.isDismissed = true;
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
        saveState();
        render();
      });
      rootWrap.appendChild(pill);
      return;
    }

    // Resolve target on page if tour is active
    let resolved = null;
    if (state.isActive && step && state.targetStatus !== "completed") {
      resolved = resolveTargetElement(step);
      if (resolved) {
        state.targetStatus = "found";
      } else if (state.iframeFoundStep === step.id) {
        state.targetStatus = "found";
      } else {
        state.targetStatus = "missing";
      }
    }

    // 1. Render Spotlight + Callout if target element is visible on screen
    // AND the user hasn't already clicked it / started working on this step!
    const isSpotlightMuted = state.spotlightMutedForStep === (step && step.id);

    if (state.isActive && resolved && resolved.element && !isSpotlightMuted) {
      const el = resolved.element;
      const rect = getViewportRect(el, resolved.frameEl);

      const ring = document.createElement("div");
      ring.className = "fgl-spotlight-ring";
      ring.style.top = `${rect.top - 5}px`;
      ring.style.left = `${rect.left - 5}px`;
      ring.style.width = `${rect.width + 10}px`;
      ring.style.height = `${rect.height + 10}px`;
      rootWrap.appendChild(ring);

      const pos = computeCalloutPosition(rect);
      const callout = document.createElement("div");
      callout.className = "fgl-callout";
      callout.style.top = `${pos.top}px`;
      callout.style.left = `${pos.left}px`;
      callout.innerHTML = `
        <div class="fgl-callout-badge">Step ${state.stepIndex + 1} of ${totalSteps}</div>
        <div class="fgl-callout-title">${step.title}</div>
        <div class="fgl-callout-desc">${step.instruction}</div>
        <div class="fgl-callout-meta">
          <span>Matched via: ${resolved.strategy}</span>
          <span>Click control to dismiss highlight</span>
        </div>
      `;
      rootWrap.appendChild(callout);

      // Attach click listener to target control:
      // - As soon as the user clicks the highlighted button, immediately dismiss the spotlight ring & callout
      //   so it NEVER stays in the way while they work!
      // - If the step is NOT manualAdvanceOnly, also advance to the next step.
      currentHighlightedEl = el;
      boundClickHandler = () => {
        state.spotlightMutedForStep = step.id;
        saveState();
        // Immediately hide ring & callout in DOM so user can work undisturbed
        shadow.querySelector(".fgl-spotlight-ring")?.remove();
        shadow.querySelector(".fgl-callout")?.remove();

        const tag = (el.tagName || "").toLowerCase();
        if (step.manualAdvanceOnly || tag === "input" || tag === "textarea") {
          render();
          return;
        }
        setTimeout(() => {
          advanceStep("target-clicked");
        }, 350);
      };
      el.addEventListener("click", boundClickHandler, true);
    }

    // 2. Render Docked & Movable Learning Panel
    const panel = document.createElement("div");
    panel.className = "fgl-panel";

    const safePos = computeSafePanelPosition(295, 380);
    panel.style.left = `${safePos.left}px`;
    panel.style.top = `${safePos.top}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";

    promoteHostToTopOfTopLayer();

    const isAllDone = completedCount === totalSteps && totalSteps > 0;
    const nextLessonIdx = lessons.findIndex((l) => l.id === lesson.id) + 1;
    const nextLesson = lessons[nextLessonIdx] || null;

    panel.innerHTML = `
      <div class="fgl-header" id="fgl-drag-handle" title="Drag to move panel anywhere">
        <div style="flex:1; min-width:0;">
          <div class="fgl-brand">⠿ ✨ Guided Learning (Drag to move)</div>
          <button type="button" class="fgl-lesson-select-btn" id="fgl-lesson-menu-btn" title="Click to switch tutorial module">
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${lesson ? lesson.title : "Select Tutorial"}</span>
            <span>${state.showLessonMenu ? "▴" : "▾"}</span>
          </button>
        </div>
        <div class="fgl-header-actions">
          <button class="fgl-icon-btn ${state.narrationEnabled ? "active" : ""}" id="fgl-btn-audio" title="Toggle Voice Narration">
            🔊
          </button>
          <button class="fgl-icon-btn" id="fgl-btn-compact" title="${state.isCompact ? "Expand Details" : "Compact Mode"}">
            ${state.isCompact ? "▾" : "▴"}
          </button>
          <button class="fgl-icon-btn" id="fgl-btn-minimize" title="Minimize to Pill">
            —
          </button>
          <button class="fgl-icon-btn" id="fgl-btn-dismiss" title="Exit & Remove Guiding Box">
            ✕
          </button>
        </div>
      </div>

      ${
        state.showLessonMenu
          ? `
        <div class="fgl-lesson-menu">
          ${lessons
            .map(
              (l) => `
            <button type="button" class="fgl-lesson-option ${l.id === lesson.id ? "active" : ""}" data-lesson-id="${l.id}">
              <span>${l.title}</span>
              <span>${l.id === lesson.id ? "✓" : ""}</span>
            </button>
          `
            )
            .join("")}
        </div>
      `
          : ""
      }

      <div class="fgl-progress-bar-wrap">
        <div class="fgl-progress-meta">
          <span>Step ${Math.min(state.stepIndex + 1, totalSteps)}/${totalSteps} (${completedCount} done)</span>
          <span>${progressPct}%</span>
        </div>
        <div class="fgl-progress-track">
          <div class="fgl-progress-fill" style="width: ${progressPct}%"></div>
        </div>
      </div>

      <div class="fgl-body">
        ${
          !state.isActive
            ? `
          <div class="fgl-step-pill idle">Ready to start</div>
          <h3 class="fgl-step-title">Interactive Fabric Walkthrough</h3>
          ${!state.isCompact ? `<p class="fgl-explain">We'll highlight real controls step-by-step and advance automatically as you complete each action.</p>` : ""}
          <button class="fgl-btn fgl-btn-success" id="fgl-btn-start" style="width:100%; padding: 8px; font-size: 12px;">
            ▶ Start Guided Learning
          </button>
        `
            : isAllDone
            ? `
          <div class="fgl-step-pill found">🎉 Module Completed</div>
          <h3 class="fgl-step-title">Module Completed!</h3>
          <p class="fgl-explain">
            Completed all ${totalSteps} steps in <strong>${lesson.title}</strong>.
          </p>
          ${
            nextLesson
              ? `<button class="fgl-btn fgl-btn-success" id="fgl-btn-next-module" style="width:100%; padding: 8px; margin-bottom: 6px;">
                  ▶ Continue to ${nextLesson.title}
                </button>`
              : ""
          }
          <button class="fgl-btn fgl-btn-primary" id="fgl-btn-restart" style="width:100%; padding: 7px;">
            ↺ Restart Current Module
          </button>
        `
            : `
          <div class="fgl-step-pill ${state.targetStatus}">
            ${
              state.targetStatus === "found"
                ? "● Control Located"
                : "⚠ Waiting for Control"
            }
          </div>
          <h3 class="fgl-step-title">Step ${state.stepIndex + 1}: ${step.title}</h3>
          ${!state.isCompact ? `<p class="fgl-explain">${step.explain}</p>` : ""}
          <div class="fgl-action-box">
            👉 ${step.instruction}
          </div>

          ${
            Array.isArray(step.downloadLinks) && step.downloadLinks.length > 0
              ? step.downloadLinks
                  .map(
                    (dl) => `
              <a class="fgl-download-btn" href="${dl.url}" target="_blank" rel="noopener noreferrer">
                ${dl.label}
              </a>
            `
                  )
                  .join("")
              : ""
          }

          ${
            Array.isArray(step.copyChips) && step.copyChips.length > 0
              ? `
            <div class="fgl-chips-wrap">
              ${step.copyChips
                .map(
                  (txt) => `
                <button class="fgl-copy-chip" data-copy-text="${txt}" title="Click to copy '${txt}' to clipboard">
                  📋 ${txt}
                </button>
              `
                )
                .join("")}
            </div>
          `
              : ""
          }

          ${
            !state.isCompact && step.referenceTable && Array.isArray(step.referenceTable.rows)
              ? `
            <table class="fgl-ref-table">
              <thead>
                <tr>
                  ${step.referenceTable.headers.map((h) => `<th>${h}</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${step.referenceTable.rows
                  .map(
                    (row) => `
                  <tr>
                    ${row.map((cell) => `<td>${cell}</td>`).join("")}
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          `
              : ""
          }

          ${
            state.targetStatus === "missing"
              ? `
            <div class="fgl-recovery-box">
              <div class="fgl-recovery-title">🧭 Target control not visible yet</div>
              <div>${step.hint}</div>
            </div>
          `
              : ""
          }

          ${
            state.showHint && state.targetStatus !== "missing"
              ? `
            <div class="fgl-hint-box">
              <strong>💡 Hint:</strong> ${step.hint}
            </div>
          `
              : ""
          }

          ${
            !state.isCompact
              ? `
          <div style="display:flex; gap:5px; margin-bottom:4px; flex-wrap:wrap;">
            <button class="fgl-btn" id="fgl-btn-hint" style="flex:1;">
              ${state.showHint ? "Hide Hint" : "💡 Hint"}
            </button>
            <button class="fgl-btn" id="fgl-btn-toggle-spotlight" title="Show or hide the blue highlight ring on the page">
              ${isSpotlightMuted ? "🔦 Show Highlight" : "🙈 Hide Highlight"}
            </button>
            <button class="fgl-btn" id="fgl-btn-pick-target" title="Click any button on the page to bind it to this step">
              ${state.pickingTargetForStep === step.id ? "🎯 Click..." : "🎯 Pick"}
            </button>
            <button class="fgl-btn" id="fgl-btn-toggle-steps" title="Show/Hide all steps">
              ${state.showStepList ? "Hide Steps" : "Steps ▾"}
            </button>
          </div>
          `
              : ""
          }
        `
        }

        ${
          state.showStepList && !state.isCompact
            ? `
        <div class="fgl-step-list">
          ${lesson.steps
            .map((s, idx) => {
              const isDone = !!state.completedSteps[s.id];
              const isCurrent = state.isActive && idx === state.stepIndex && !isAllDone;
              return `
                <div class="fgl-step-item ${isCurrent ? "current" : ""} ${isDone ? "done" : ""}" data-step-idx="${idx}">
                  <span>${isDone ? "✅" : isCurrent ? "🔵" : "⚪"}</span>
                  <span>${idx + 1}. ${s.title}</span>
                </div>
              `;
            })
            .join("")}
        </div>
        `
            : ""
        }
      </div>

      <div class="fgl-footer">
        <button class="fgl-btn" id="fgl-btn-prev" ${!state.isActive || state.stepIndex === 0 ? "disabled" : ""}>
          ← Back
        </button>
        <button class="fgl-btn" id="fgl-btn-reset" title="Reset progress">
          Reset
        </button>
        <button class="fgl-btn" id="fgl-btn-cleanup" title="Remove guiding box and highlights from screen" style="color:#b91c1c; border-color:#fecaca; background:#fef2f2;">
          ✕ Exit Guide
        </button>
        <button class="fgl-btn fgl-btn-primary" id="fgl-btn-next" ${!state.isActive || isAllDone ? "disabled" : ""}>
          Next →
        </button>
      </div>
    `;

    rootWrap.appendChild(panel);

    // Wire up drag handle on header (both pointerdown and mousedown)
    const dragHandle = panel.querySelector("#fgl-drag-handle");
    if (dragHandle) {
      const startDrag = (e) => {
        if (e.target.closest("button") || e.target.closest("select")) return;
        e.stopPropagation();
        ensureHostOnTop();
        const rect = panel.getBoundingClientRect();
        isDragging = true;
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
      };
      dragHandle.addEventListener("pointerdown", startDrag, true);
      dragHandle.addEventListener("mousedown", startDrag, true);
    }

    const lessonMenuBtn = panel.querySelector("#fgl-lesson-menu-btn");
    if (lessonMenuBtn) {
      lessonMenuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        state.showLessonMenu = !state.showLessonMenu;
        render();
      });
    }

    panel.querySelectorAll(".fgl-lesson-option").forEach((optBtn) => {
      optBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const nextLessonId = optBtn.getAttribute("data-lesson-id");
        if (nextLessonId) {
          state.lessonId = nextLessonId;
          state.stepIndex = 0;
          state.completedSteps = {};
          state.isActive = true;
          state.targetStatus = "idle";
          state.showHint = false;
          state.showLessonMenu = false;
          window.dispatchEvent(new CustomEvent("fgl-lesson-changed", { detail: { lessonId: nextLessonId } }));
          saveState();
          render();
        }
      });
    });

    const btnCompact = panel.querySelector("#fgl-btn-compact");
    if (btnCompact) {
      btnCompact.addEventListener("click", () => {
        state.isCompact = !state.isCompact;
        saveState();
        render();
      });
    }

    const btnToggleSteps = panel.querySelector("#fgl-btn-toggle-steps");
    if (btnToggleSteps) {
      btnToggleSteps.addEventListener("click", () => {
        state.showStepList = !state.showStepList;
        render();
      });
    }

    // Wire up panel events
    function cleanupAndDismissGuide() {
      state.isActive = false;
      state.isDismissed = true;
      state.pickingTargetForStep = null;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      saveState();
      render();
    }

    const btnDismiss = panel.querySelector("#fgl-btn-dismiss");
    if (btnDismiss) {
      btnDismiss.addEventListener("click", cleanupAndDismissGuide);
    }

    const btnCleanup = panel.querySelector("#fgl-btn-cleanup");
    if (btnCleanup) {
      btnCleanup.addEventListener("click", cleanupAndDismissGuide);
    }

    const btnMinimize = panel.querySelector("#fgl-btn-minimize");
    if (btnMinimize) {
      btnMinimize.addEventListener("click", () => {
        state.isOpen = false;
        saveState();
        render();
      });
    }

    const btnAudio = panel.querySelector("#fgl-btn-audio");
    if (btnAudio) {
      btnAudio.addEventListener("click", () => {
        state.narrationEnabled = !state.narrationEnabled;
        saveState();
        render();
        if (state.narrationEnabled && state.isActive) {
          speakStep(getCurrentStep());
        }
      });
    }

    const btnStart = panel.querySelector("#fgl-btn-start");
    if (btnStart) {
      btnStart.addEventListener("click", () => {
        state.isActive = true;
        state.targetStatus = "idle";
        saveState();
        render();
        speakStep(getCurrentStep());
      });
    }

    const btnRestart = panel.querySelector("#fgl-btn-restart");
    if (btnRestart) {
      btnRestart.addEventListener("click", () => {
        state.completedSteps = {};
        state.stepIndex = 0;
        state.isActive = true;
        state.targetStatus = "idle";
        window.dispatchEvent(new CustomEvent("fgl-reset-sandbox"));
        saveState();
        render();
      });
    }

    const btnNextModule = panel.querySelector("#fgl-btn-next-module");
    if (btnNextModule && nextLesson) {
      btnNextModule.addEventListener("click", () => {
        state.lessonId = nextLesson.id;
        state.stepIndex = 0;
        state.completedSteps = {};
        state.isActive = true;
        state.targetStatus = "idle";
        state.showHint = false;
        saveState();
        render();
        speakStep(getCurrentStep());
      });
    }

    // One-click clipboard copy chips (e.g., LamnaHealthcareLH, HospitalId, etc.)
    panel.querySelectorAll(".fgl-copy-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const txt = chip.getAttribute("data-copy-text");
        if (!txt) return;
        navigator.clipboard?.writeText(txt).catch(() => {});
        const orig = chip.textContent;
        chip.classList.add("copied");
        chip.textContent = `✓ Copied: ${txt}`;
        setTimeout(() => {
          chip.classList.remove("copied");
          chip.textContent = orig;
        }, 1200);
      });
    });

    const btnHint = panel.querySelector("#fgl-btn-hint");
    if (btnHint) {
      btnHint.addEventListener("click", () => {
        state.showHint = !state.showHint;
        render();
      });
    }

    const btnToggleSpotlight = panel.querySelector("#fgl-btn-toggle-spotlight");
    if (btnToggleSpotlight) {
      btnToggleSpotlight.addEventListener("click", () => {
        if (state.spotlightMutedForStep === step.id) {
          state.spotlightMutedForStep = null;
        } else {
          state.spotlightMutedForStep = step.id;
        }
        saveState();
        render();
      });
    }

    const btnPickTarget = panel.querySelector("#fgl-btn-pick-target");
    if (btnPickTarget) {
      btnPickTarget.addEventListener("click", () => {
        if (state.pickingTargetForStep === step.id) {
          state.pickingTargetForStep = null;
        } else {
          state.pickingTargetForStep = step.id;
        }
        render();
      });
    }

    const btnPrev = panel.querySelector("#fgl-btn-prev");
    if (btnPrev) {
      btnPrev.addEventListener("click", () => {
        if (state.stepIndex > 0) {
          state.stepIndex -= 1;
          state.showHint = false;
          saveState();
          render();
        }
      });
    }

    const btnNext = panel.querySelector("#fgl-btn-next");
    if (btnNext) {
      btnNext.addEventListener("click", () => {
        advanceStep("manual-next");
      });
    }

    const btnReset = panel.querySelector("#fgl-btn-reset");
    if (btnReset) {
      btnReset.addEventListener("click", () => {
        state.completedSteps = {};
        state.stepIndex = 0;
        state.isActive = false;
        state.simulatingMissingTarget = false;
        state.targetStatus = "idle";
        window.dispatchEvent(new CustomEvent("fgl-reset-sandbox"));
        saveState();
        render();
      });
    }

    panel.querySelectorAll(".fgl-step-item").forEach((item) => {
      item.addEventListener("click", () => {
        const idx = parseInt(item.getAttribute("data-step-idx"), 10);
        if (!isNaN(idx)) {
          state.isActive = true;
          state.stepIndex = idx;
          state.targetStatus = "idle";
          saveState();
          render();
        }
      });
    });
  }

  // Generate a stable CSS selector when user uses "🎯 Pick Button"
  function computeUniqueSelector(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.getAttribute("data-testid")) {
      return `[data-testid="${el.getAttribute("data-testid")}"]`;
    }
    if (el.getAttribute("data-automation-id")) {
      return `[data-automation-id="${el.getAttribute("data-automation-id")}"]`;
    }
    if (el.id) {
      return `#${CSS.escape(el.id)}`;
    }
    if (el.getAttribute("aria-label")) {
      return `${el.tagName.toLowerCase()}[aria-label="${el.getAttribute("aria-label")}"]`;
    }
    // Build short path
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.body && parts.length < 4) {
      let part = cur.tagName.toLowerCase();
      if (cur.id) {
        part = `#${CSS.escape(cur.id)}`;
        parts.unshift(part);
        break;
      }
      const parent = cur.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === cur.tagName);
        if (siblings.length > 1) {
          const idx = siblings.indexOf(cur) + 1;
          part += `:nth-of-type(${idx})`;
        }
      }
      parts.unshift(part);
      cur = parent;
    }
    return parts.join(" > ");
  }

  // Global click capture for "🎯 Pick Button" mode
  document.addEventListener(
    "click",
    (e) => {
      if (!state.pickingTargetForStep) return;
      if (e.target === host || host.contains(e.target)) return;
      e.preventDefault();
      e.stopPropagation();

      const targetEl = buildBestActionTarget(e.target);
      const selector = computeUniqueSelector(targetEl);
      const label = (targetEl.innerText || targetEl.getAttribute("aria-label") || targetEl.tagName || "")
        .trim()
        .slice(0, 28);

      if (selector) {
        state.customTargets = state.customTargets || {};
        state.customTargets[state.pickingTargetForStep] = { selector, label };
        state.pickingTargetForStep = null;
        saveState();
        render();
      }
    },
    true
  );

  // ---------------------------------------------------------------------------
  // Reactive Progress Engine: Observe DOM mutations & resize/scroll
  // ---------------------------------------------------------------------------
  let lastDialogCount = 0;

  // Only update spotlight/status on background ticks without wiping interactive panel DOM (menus, copy chips, etc.)
  function syncTargetAndSpotlight() {
    ensureHostOnTop();

    // Detect if Fabric just opened a modal dialog (e.g., "New Ontology" or "New Lakehouse")
    const openDialogs = document.querySelectorAll(
      "[role='dialog'], dialog[open], .ms-Dialog-main, .fui-DialogSurface, mat-dialog-container"
    );
    let visibleDialogCount = 0;
    for (const d of openDialogs) {
      if (isVisible(d)) visibleDialogCount++;
    }
    if (visibleDialogCount > lastDialogCount) {
      // A new Fabric dialog just opened! Promote our popover to the top of #top-layer and nudge panel out of the way
      promoteHostToTopOfTopLayer();
      const panelEl = shadow.querySelector(".fgl-panel");
      if (panelEl && !isDragging) {
        const safePos = computeSafePanelPosition(panelEl.offsetWidth || 295, panelEl.offsetHeight || 380);
        panelEl.style.left = `${safePos.left}px`;
        panelEl.style.top = `${safePos.top}px`;
      }
    }
    lastDialogCount = visibleDialogCount;

    if (!state.isActive || !state.isOpen || state.isDismissed) return;
    checkAutoAdvanceByDOM();
    const step = getCurrentStep();
    if (!step) return;
    const resolved = resolveTargetElement(step);
    const nextStatus = resolved ? "found" : state.iframeFoundStep === step.id ? "found" : "missing";
    const prevEl = currentHighlightedEl;
    const nextEl = resolved ? resolved.element : null;

    // Re-render full panel only when target status or target element actually changed
    if (nextStatus !== state.targetStatus || prevEl !== nextEl) {
      render();
      return;
    }

    // Otherwise just update spotlight ring & callout coordinates in place!
    if (resolved && resolved.element) {
      const rect = getViewportRect(resolved.element, resolved.frameEl);
      const ring = shadow.querySelector(".fgl-spotlight-ring");
      if (ring) {
        ring.style.top = `${rect.top - 5}px`;
        ring.style.left = `${rect.left - 5}px`;
        ring.style.width = `${rect.width + 10}px`;
        ring.style.height = `${rect.height + 10}px`;
      }
      const callout = shadow.querySelector(".fgl-callout");
      if (callout) {
        const pos = computeCalloutPosition(rect);
        callout.style.top = `${pos.top}px`;
        callout.style.left = `${pos.left}px`;
      }
    }
  }

  let rafId = null;
  function scheduleRefresh() {
    if (!state.isActive || !state.isOpen) return;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      syncTargetAndSpotlight();
    });
  }

  const observer = new MutationObserver(() => {
    scheduleRefresh();
  });

  // Listen for storage updates across tabs/popup/iframes so popup can re-open or clean up the guide anytime
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(() => {
      loadState(() => {
        render();
      });
    });
  }

  // Mount UI in the top-level window, AND if running inside a cross-origin Fabric workload iframe,
  // render the spotlight ring directly inside the child iframe when the target lives in this iframe!
  if (window === window.top) {
    loadState(() => {
      render();
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style", "aria-expanded", "hidden"]
      });
      window.addEventListener("resize", scheduleRefresh, { passive: true });
      window.addEventListener("scroll", scheduleRefresh, { passive: true });
      setInterval(() => {
        if (state.isActive && state.isOpen) {
          syncTargetAndSpotlight();
        }
      }, 900);
    });
  } else {
    // Child iframe worker (e.g., Lakehouse / Ontology Explorer iframe in live Fabric):
    // Sync state from chrome.storage.local and render ONLY the spotlight + callout if the target is inside this iframe!
    function renderIframeSpotlightOnly() {
      loadState(() => {
        detachTargetListener();
        rootWrap.innerHTML = "";
        if (!state.isActive || state.isDismissed || !state.isOpen) return;
        const lesson = getCurrentLesson();
        const step = getCurrentStep();
        if (!lesson || !step) return;

        // If user clicked "Hide Highlight" or already clicked the button once, do NOT draw spotlight in child iframe!
        if (state.spotlightMutedForStep === step.id) {
          return;
        }

        const resolved = resolveTargetElement(step);
        if (resolved && resolved.element) {
          // Notify top frame via storage that a child iframe found and highlighted the control
          if (state.iframeFoundStep !== step.id && typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get([STORAGE_KEY], (res) => {
              const cur = (res && res[STORAGE_KEY]) || {};
              chrome.storage.local.set({
                [STORAGE_KEY]: { ...cur, iframeFoundStep: step.id }
              });
            });
          }

          const el = resolved.element;
          const rect = el.getBoundingClientRect();
          const ring = document.createElement("div");
          ring.className = "fgl-spotlight-ring";
          ring.style.top = `${rect.top - 5}px`;
          ring.style.left = `${rect.left - 5}px`;
          ring.style.width = `${rect.width + 10}px`;
          ring.style.height = `${rect.height + 10}px`;
          rootWrap.appendChild(ring);

          const pos = computeCalloutPosition(rect);
          const callout = document.createElement("div");
          callout.className = "fgl-callout";
          callout.style.top = `${pos.top}px`;
          callout.style.left = `${pos.left}px`;
          callout.innerHTML = `
            <div class="fgl-callout-badge">Step ${state.stepIndex + 1} of ${lesson.steps.length}</div>
            <div class="fgl-callout-title">${step.title}</div>
            <div class="fgl-callout-desc">${step.instruction}</div>
            <div class="fgl-callout-meta">
              <span>Matched via: ${resolved.strategy}</span>
              <span>Click control to dismiss highlight</span>
            </div>
          `;
          rootWrap.appendChild(callout);

          currentHighlightedEl = el;
          boundClickHandler = () => {
            state.spotlightMutedForStep = step.id;
            saveState();
            rootWrap.innerHTML = "";
            if (!step.manualAdvanceOnly) {
              setTimeout(() => {
                advanceStep("iframe-target-clicked");
              }, 350);
            }
          };
          el.addEventListener("click", boundClickHandler, true);
        }
      });
    }

    setInterval(renderIframeSpotlightOnly, 800);
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(renderIframeSpotlightOnly);
    }
  }
})();
