# CSS Refactor (styles.css split) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the single 3197-line `styles.css` into focused per-feature files under `css/`, delete confirmed dead CSS, and merge the three scattered `@media` blocks into one — so future edits touch a ~150-400 line file instead of scrolling a 3200-line one, and so an agent reading "fix the flashcard card" only needs to load `css/flashcard.css` instead of the whole stylesheet.

**Architecture:** This is a static site with no build step (plain `<link>` tags, no bundler). The split therefore happens at the `<link rel="stylesheet">` level in `index.html` — multiple small CSS files loaded in a fixed cascade order, functionally identical to today's single file. No CSS-in-JS, no preprocessor, no new tooling.

**Tech Stack:** Plain HTML/CSS/JS, no build tooling. Verification is manual (open in browser) + `grep`/`wc` structural checks, since the project has no test runner.

## Global Constraints

- Zero visual/behavioral change. This is a reorganization, not a redesign — every selector's rules must survive byte-identical (except the two cleanup tasks, which are explicitly allowed to delete confirmed-dead rules).
- Every task must leave the app in a working, visually-verified state. Never leave `index.html` pointing at a mix of old+new files that duplicates or drops a selector.
- Section boundaries are identified by the existing `/* Comment */` markers already in `styles.css` — use the comment text as the cut anchor, not raw line numbers (line numbers shift after every edit).
- Commit after every task.

## Verification Method (applies to every split task, referenced as "Standard Split Verification")

1. `grep -c "{" css/<new-file>.css` and confirm it's > 0 (rules actually landed there).
2. `grep -n "<selector-you-moved>" styles.css` returns nothing (no duplicate left behind).
3. Reload the app at `http://127.0.0.1:356/index.html` with **Ctrl+F5** (hard refresh, bypasses the service worker/cache from the earlier PWA work) and visually check the specific screen that file covers — compare against current behavior, which the user has already validated in this session.
4. `node --check` doesn't apply to CSS; instead run `npx --yes csso-cli --version >/dev/null 2>&1 || true` is unnecessary — skip. Just confirm the page has zero console errors in DevTools (missing-file 404s show up immediately if a `<link>` path is wrong).

---

## File Structure

Create a `css/` directory. Files, in cascade/load order (order matters: later files' selectors of equal specificity win, so keep base → layout → feature files → responsive last):

| # | File | Section markers it contains (from current `styles.css`) |
|---|------|------------------------------------------------------------|
| 1 | `css/base.css` | `CSS Reset & Variables`, `Dark Theme (Default)`, `Light Theme`, `Base Styles`, `Custom Scrollbar` |
| 2 | `css/layout.css` | `App Container Layout`, `Sidebar & Navigation Styles`, `Main Content Area`, `Tab Content Visibility` |
| 3 | `css/home.css` | `Welcome Banner`, `Dashboard Grid Layout`, `Info Banner for FSRS` |
| 4 | `css/topics.css` | `Search Bar`, `Loading State styles`, `Topics Grid Layout` (incl. `.topic-card*`), `Topic Detail View Overlay Styles` |
| 5 | `css/flashcard.css` | `Flashcard Container styling`, `3D Flashcard Structure`, `Sleek Webkit Custom Scrollbar for Card Back`, `Front Card Content`, `Back Card Content Spacing & Typography Optimization`, `Flashcard Stage and Action Bar`, the 4 FSRS rating-button color blocks (`Red for Again` / `Orange for Hard` / `Green for Good` / `Blue for Easy`) |
| 6 | `css/quiz.css` | `Quiz UI Mode Styles`, `Quiz Feedback Box` |
| 7 | `css/review.css` | `Review Tab Styling`, `Review Session Full Overlay Panel` |
| 8 | `css/notebook.css` | `Global Fullscreen Focused Study Mode`, `Review Header Row Layout`, `Notebook Action Button inside header`, `Notebook View Styles (Fullscreen Screen)`, `Filters Row`, `Topics Grid & Screen 1 Styles`, `Topic Details Screen 2 Header Styles`, `Word cards`, `Timeline schedule groups` |
| 9 | `css/settings.css` | Everything from `Settings View Styles` through `Action row for settings` |
| 10 | `css/components.css` | `Toast Notifications Container`, `Animation Keyframes`, `Shake Animation for Incorrect Answers` |
| 11 | `css/responsive.css` | All 3 existing `@media (max-width: 768px)` blocks, merged & deduped |

`styles.css` itself is deleted once every section has moved out and `index.html` links the new files directly — no leftover shim file.

---

### Task 1: Delete confirmed dead CSS from `styles.css`

Two rule blocks in `styles.css` are unused (verified with `grep -c "<selector>" index.html app.js` = 0 for all their classes):

1. The **entire "Vocabulary Manager Library" + "Badges and tags in table" block** — `.vocab-manager`, `.vocab-manager-header`, `.tag-pos`, `.badge-status`, `.btn-icon-table`, and everything between them. This was superseded by the `.notebook-*` system and is 100% dead. It sits between the comment `/* Vocabulary Manager Library */` and the comment `/* Review Session Full Overlay Panel */` (do not delete that second comment or anything after it).
2. The single dead rule `.settings-container > h3 { ... }` (a leftover from before Settings was redesigned to a card grid — no `<h3>` is ever a direct child of `.settings-container` in `index.html` anymore).

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Confirm both blocks are still dead**

```bash
cd "c:/Users/PC/Downloads/data-toiec"
grep -c "vocab-manager\|tag-pos\|badge-status\|btn-icon-table" index.html app.js
```
Expected: `index.html:0` and `app.js:0` for every term (all zero hits).

```bash
grep -n "settings-container > h3" index.html app.js
```
Expected: no output.

- [ ] **Step 2: Delete the vocab-manager block**

Open `styles.css`, find the comment `/* Vocabulary Manager Library */`. Delete from that line through the line immediately before `/* Review Session Full Overlay Panel */` (inclusive of the `/* Badges and tags in table */` sub-section — it's part of the same dead feature).

- [ ] **Step 3: Delete the dead `.settings-container > h3` rule**

Find and delete:
```css
.settings-container > h3 {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 24px;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 12px;
}
```

- [ ] **Step 4: Verify**

```bash
grep -c "vocab-manager\|settings-container > h3" styles.css
```
Expected: `0`.

Hard-refresh the app, click through Home → Topics → a topic's flashcards → Quiz → Review → Settings → the notebook/library view from Review. Nothing should look different (these rules were never rendered).

- [ ] **Step 5: Commit**

```bash
git add styles.css
git commit -m "chore: remove dead vocab-manager and settings-container CSS"
```

---

### Task 2: Merge the 3 scattered `@media (max-width: 768px)` blocks into one

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Locate all three blocks**

```bash
grep -n "^@media" styles.css
```
Expected: three lines, all `@media (max-width: 768px) {`.

- [ ] **Step 2: Cut the 2nd and 3rd blocks' contents and append into the 1st block**

Keep the first `@media (max-width: 768px) { ... }` block where it is. For the 2nd and 3rd blocks: move every rule inside them into the end of the first block (just before its closing `}`), then delete the now-empty 2nd/3rd `@media { }` wrapper. If the same selector appears in more than one of the three blocks, keep only the last-defined version (later declarations were already winning under cascade order, so this preserves current behavior) and delete the earlier duplicate.

- [ ] **Step 3: Verify only one block remains**

```bash
grep -c "^@media" styles.css
```
Expected: `1`.

Hard-refresh the app, shrink the browser window (or DevTools device toolbar) to under 768px width, and check Home, Topics, and the flashcard nav-arrow mobile positioning still look correct.

- [ ] **Step 4: Commit**

```bash
git add styles.css
git commit -m "chore: merge scattered mobile media queries into a single block"
```

---

### Task 3: Create `css/base.css` (reset, theme variables, base body/scrollbar)

**Files:**
- Create: `css/base.css`
- Modify: `styles.css`

**Produces:** All `:root` CSS custom properties (`--primary`, `--bg-card`, `--radius-md`, etc.), `body.dark-theme` / `body.light-theme` variable overrides, the universal `*` reset, and the default scrollbar rules. Every later file depends on these custom properties existing.

- [ ] **Step 1: Cut the sections into the new file**

```bash
mkdir -p "c:/Users/PC/Downloads/data-toiec/css"
```

Move the content between (and including) the comments `/* CSS Reset & Variables */` through `/* Custom Scrollbar */` (i.e. up to, but not including, `/* App Container Layout */`) out of `styles.css` and into a new `css/base.css`, prefixed with:

```css
/* TOEIC Vocab Spark - Base: reset, theme variables, global scrollbar */
```

- [ ] **Step 2: Verify (Standard Split Verification)**

```bash
grep -c "{" css/base.css
grep -n ":root {" styles.css
```
Expected: first command > 0; second command returns nothing (moved out).

- [ ] **Step 3: Commit**

```bash
git add css/base.css styles.css
git commit -m "refactor: extract base reset/theme variables into css/base.css"
```

---

### Task 4: Create `css/layout.css` (app shell, sidebar/nav, tab switching)

**Files:**
- Create: `css/layout.css`
- Modify: `styles.css`

**Consumes:** custom properties from `css/base.css` (e.g. `var(--bg-sidebar)`, `var(--primary-gradient)`).
**Produces:** `.app-container`, `.app-sidebar`, `.app-nav`, `.nav-btn`, `.logo-area`, `.app-main`, `.tab-content` (visibility switching).

- [ ] **Step 1: Cut the sections**

Move `/* App Container Layout */` through the end of `/* Tab Content Visibility */` (up to, not including, `/* Welcome Banner */`) into `css/layout.css`.

- [ ] **Step 2: Verify (Standard Split Verification)**

```bash
grep -c "{" css/layout.css
grep -n "\.app-sidebar {" styles.css
```
Expected: first > 0, second empty.

Hard-refresh, confirm sidebar nav still highlights the active tab and switches Home/Topics/Review/Settings correctly.

- [ ] **Step 3: Commit**

```bash
git add css/layout.css styles.css
git commit -m "refactor: extract app shell/sidebar/nav into css/layout.css"
```

---

### Task 5: Create `css/home.css` (Home tab)

**Files:**
- Create: `css/home.css`
- Modify: `styles.css`

**Produces:** `.welcome-banner`, `.global-stats-summary`, `.dashboard-grid`, `.dashboard-card` (+ `.study-card`/`.review-card` variants, `.d-card-*`), `.info-banner-fsrs`.

- [ ] **Step 1: Cut the sections**

Move `/* Welcome Banner */` (stop before `/* Search Bar */`), plus later in the file `/* Dashboard Grid Layout */` and `/* Info Banner for FSRS */` (stop before the second `/* Media Queries */` comment), into `css/home.css`.

- [ ] **Step 2: Verify (Standard Split Verification)**

```bash
grep -c "{" css/home.css
grep -n "\.dashboard-card {" styles.css
```
Expected: first > 0, second empty.

Hard-refresh, check the Home tab: welcome banner, the two dashboard cards, and the FSRS info banner all still render and hover correctly.

- [ ] **Step 3: Commit**

```bash
git add css/home.css styles.css
git commit -m "refactor: extract Home tab styles into css/home.css"
```

---

### Task 6: Create `css/topics.css` (Topics tab: grid, cards, search, detail view)

**Files:**
- Create: `css/topics.css`
- Modify: `styles.css`

**Produces:** `.search-filter-bar`, `.search-box`, `.loading-state`, `.topics-grid`, `.topic-card` (+ `.topic-card-header`, `.topic-icon`, `.topic-card-title-group`, `.topic-meta`, `.topic-progress-*`, `.progress-track`, `.progress-fill`), `.topic-detail-view`, `.view-header`, `.back-btn`, `.study-mode-selector`, `.mode-btn`.

- [ ] **Step 1: Cut the sections**

Move `/* Search Bar */` through the end of `/* Topic Detail View Overlay Styles */` (stop before `/* Flashcard Container styling */`) into `css/topics.css`.

- [ ] **Step 2: Verify (Standard Split Verification)**

```bash
grep -c "{" css/topics.css
grep -n "\.topic-card {" styles.css
```
Expected: first > 0, second empty.

Hard-refresh, check Topics tab: search box, the topic card grid (icon+title alignment from earlier in this session), and clicking into a topic's detail header/mode selector.

- [ ] **Step 3: Commit**

```bash
git add css/topics.css styles.css
git commit -m "refactor: extract Topics tab styles into css/topics.css"
```

---

### Task 7: Create `css/flashcard.css` (3D flashcard study mode)

**Files:**
- Create: `css/flashcard.css`
- Modify: `styles.css`

**Produces:** `.mode-container`, `.progress-bar-wrapper`, `.flashcard-stage`, `.flashcard-wrapper`, `.flashcard`, `.card-face`, `.card-front`/`.card-back`, `.card-tag`, `.card-word`, `.card-pronunciation-wrapper`, `.audio-btn`, `.card-hint`, `.card-back-header`, `.card-translation`, `.card-info-group`, `.info-item`, `.colloc-badge`, `.flashcard-action-bar`, `.show-answer-btn`, `.fsrs-buttons-panel` + the 4 rating-color blocks.

- [ ] **Step 1: Cut the sections**

Move `/* Flashcard Container styling */` through the end of the `Blue for Easy` color block (stop before `/* Quiz UI Mode Styles */`) into `css/flashcard.css`.

- [ ] **Step 2: Verify (Standard Split Verification)**

```bash
grep -c "{" css/flashcard.css
grep -n "\.flashcard-wrapper {" styles.css
```
Expected: first > 0, second empty.

Hard-refresh, open a topic's flashcards: confirm the 3D flip animation, card centering (from the "căn giữa từ vựng" fix earlier this session), and the 4 rating buttons' colors are unchanged.

- [ ] **Step 3: Commit**

```bash
git add css/flashcard.css styles.css
git commit -m "refactor: extract flashcard study mode styles into css/flashcard.css"
```

---

### Task 8: Create `css/quiz.css` (quiz mode)

**Files:**
- Create: `css/quiz.css`
- Modify: `styles.css`

**Produces:** `.quiz-card` and everything under `/* Quiz UI Mode Styles */` and `/* Quiz Feedback Box */`.

- [ ] **Step 1: Cut the sections**

Move `/* Quiz UI Mode Styles */` through the end of `/* Quiz Feedback Box */` (stop before `/* Review Tab Styling */`) into `css/quiz.css`.

- [ ] **Step 2: Verify (Standard Split Verification)**

```bash
grep -c "{" css/quiz.css
grep -n "\.quiz-card {" styles.css
```
Expected: first > 0, second empty.

Hard-refresh, switch a topic to Quiz mode and answer a question (correct + incorrect) to confirm feedback box styling.

- [ ] **Step 3: Commit**

```bash
git add css/quiz.css styles.css
git commit -m "refactor: extract quiz mode styles into css/quiz.css"
```

---

### Task 9: Create `css/review.css` (Review tab + review session overlay)

**Files:**
- Create: `css/review.css`
- Modify: `styles.css`

**Produces:** everything under `/* Review Tab Styling */` and `/* Review Session Full Overlay Panel */` (the review dashboard stat cards, `.review-stage`, review flashcard variant, etc.) — this stops right before the now-deleted vocab-manager block from Task 1, so after Task 1 this section runs straight into `/* Settings View Styles */`.

- [ ] **Step 1: Cut the sections**

Move `/* Review Tab Styling */` through the end of `/* Review Session Full Overlay Panel */` (stop before `/* Settings View Styles */`) into `css/review.css`.

- [ ] **Step 2: Verify (Standard Split Verification)**

```bash
grep -c "{" css/review.css
grep -n "\.review-stage {" styles.css
```
Expected: first > 0, second empty.

Hard-refresh, open Review tab and start a review session; confirm the stat cards and review flashcard overlay look unchanged.

- [ ] **Step 3: Commit**

```bash
git add css/review.css styles.css
git commit -m "refactor: extract Review tab styles into css/review.css"
```

---

### Task 10: Create `css/settings.css` (Settings tab, all panels/controls)

**Files:**
- Create: `css/settings.css`
- Modify: `styles.css`

**Produces:** everything from `/* Settings View Styles */` through `/* Action row for settings */` — the settings page header, `.settings-menu-grid`/`.settings-menu-card` (+ icon gradients), `.settings-detail-panel`, `.settings-group`, `.setting-row`, theme switcher, speech-rate slider, `.settings-input-num`, `.settings-select`, the iOS switch control, and the export/import/reset action buttons.

- [ ] **Step 1: Cut the sections**

Move `/* Settings View Styles */` through the end of `/* Action row for settings */` (stop before `/* Toast Notifications Container */`) into `css/settings.css`.

- [ ] **Step 2: Verify (Standard Split Verification)**

```bash
grep -c "{" css/settings.css
grep -n "\.settings-menu-card {" styles.css
```
Expected: first > 0, second empty.

Hard-refresh, go through Settings: the 6-card menu, open each detail panel (Học tập/Ôn tập/Âm thanh/Giao diện/Dữ liệu/Thông tin), toggle a switch, and check the export/reset buttons still render.

- [ ] **Step 3: Commit**

```bash
git add css/settings.css styles.css
git commit -m "refactor: extract Settings tab styles into css/settings.css"
```

---

### Task 11: Create `css/components.css` (toasts + shared animation keyframes)

**Files:**
- Create: `css/components.css`
- Modify: `styles.css`

**Produces:** `.toast-container`, `.toast` (+ `.success`/`.error`/`.info` variants), all `@keyframes` (`fadeIn`, `slideUp`, `spin`, `pulse-glow`, `slideInLeft`, `shake`, etc.) — these are used across multiple tabs (flashcard flip, quiz shake, toast fade), so they live in a shared file rather than any single feature file.

- [ ] **Step 1: Cut the sections**

Move `/* Toast Notifications Container */` through the end of `/* Shake Animation for Incorrect Answers */` (stop before the first `/* Media Queries (Responsive optimization) */`) into `css/components.css`.

- [ ] **Step 2: Verify (Standard Split Verification)**

```bash
grep -c "{" css/components.css
grep -n "@keyframes fadeIn" styles.css
```
Expected: first > 0, second empty.

Hard-refresh, trigger a toast (e.g. rate a flashcard) and confirm it fades/slides in as before.

- [ ] **Step 3: Commit**

```bash
git add css/components.css styles.css
git commit -m "refactor: extract toast + shared keyframe animations into css/components.css"
```

---

### Task 12: Create `css/notebook.css` (fullscreen focused study mode / vocabulary notebook)

**Files:**
- Create: `css/notebook.css`
- Modify: `styles.css`

**Produces:** everything from `/* Global Fullscreen Focused Study Mode */` through the end of `/* Timeline schedule groups */` (all the real `.notebook-*` classes confirmed in use via `grep -c "notebook-" index.html app.js` = 31/70 hits) — this is everything remaining in `styles.css` at this point except the third `@media` block.

- [ ] **Step 1: Cut the section**

Move `/* Global Fullscreen Focused Study Mode */` through the line immediately before the last remaining `@media (max-width: 768px) {` block into `css/notebook.css`.

- [ ] **Step 2: Verify (Standard Split Verification)**

```bash
grep -c "{" css/notebook.css
grep -n "\.notebook-view {" styles.css
```
Expected: first > 0, second empty.

Hard-refresh, open the Review tab's vocabulary notebook/library (fullscreen) view, browse a topic's word list, and expand a word card to confirm layout is unchanged.

- [ ] **Step 3: Commit**

```bash
git add css/notebook.css styles.css
git commit -m "refactor: extract fullscreen notebook/study-mode styles into css/notebook.css"
```

---

### Task 13: Create `css/responsive.css` (the merged mobile media query) and delete `styles.css`

After Task 12, `styles.css` should contain **only** the single merged `@media (max-width: 768px) { ... }` block from Task 2 (plus the top-of-file comment `/* TOEIC Vocab Spark - Design Styles System */`). Move it out and delete the now-empty original file.

**Files:**
- Create: `css/responsive.css`
- Delete: `styles.css`

- [ ] **Step 1: Confirm styles.css only has the media block left**

```bash
grep -v "^\s*$" styles.css | grep -v "^/\*" | head -5
```
Expected: the output starts with `@media (max-width: 768px) {`.

- [ ] **Step 2: Move it and delete the old file**

Move the entire `@media (max-width: 768px) { ... }` block into `css/responsive.css`, prefixed with:
```css
/* TOEIC Vocab Spark - Mobile responsive overrides (<=768px), loaded last so it wins the cascade */
```
Then delete `styles.css`.

```bash
rm "c:/Users/PC/Downloads/data-toiec/styles.css"
```

- [ ] **Step 3: Commit**

```bash
git add css/responsive.css
git rm styles.css
git commit -m "refactor: extract merged mobile media query into css/responsive.css, delete styles.css"
```

---

### Task 14: Point `index.html` at the new files and do the final full-app verification

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace the single stylesheet link**

In `index.html`, find:
```html
<link rel="stylesheet" href="styles.css">
```
Replace with (order matters — matches the cascade order from the File Structure table):
```html
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/layout.css">
<link rel="stylesheet" href="css/home.css">
<link rel="stylesheet" href="css/topics.css">
<link rel="stylesheet" href="css/flashcard.css">
<link rel="stylesheet" href="css/quiz.css">
<link rel="stylesheet" href="css/review.css">
<link rel="stylesheet" href="css/notebook.css">
<link rel="stylesheet" href="css/settings.css">
<link rel="stylesheet" href="css/components.css">
<link rel="stylesheet" href="css/responsive.css">
```

- [ ] **Step 2: Update the service worker's shell precache list**

`service-worker.js` (added earlier this session) precaches `./styles.css` by filename in `SHELL_ASSETS`. Update it to list the new files instead:

```js
const SHELL_ASSETS = [
    './',
    './index.html',
    './css/base.css',
    './css/layout.css',
    './css/home.css',
    './css/topics.css',
    './css/flashcard.css',
    './css/quiz.css',
    './css/review.css',
    './css/notebook.css',
    './css/settings.css',
    './css/components.css',
    './css/responsive.css',
    './app.js',
    './manifest.json',
    './icons/icon.svg'
];
```

- [ ] **Step 3: Full verification**

```bash
grep -rn "styles.css" index.html service-worker.js
```
Expected: no output (nothing still references the deleted file).

Hard-refresh (Ctrl+F5) and, in DevTools → Network tab, confirm all 11 CSS files return `200` (no 404s). Then click through **every** tab and mode once: Home → Topics (grid + search) → open a topic → Flashcard mode (flip, rate) → Quiz mode (answer a question) → Review tab (dashboard + start a review session) → Review's notebook/library view → Settings (all 6 detail panels). Nothing should look or behave differently from before this refactor.

- [ ] **Step 4: Commit**

```bash
git add index.html service-worker.js
git commit -m "refactor: load split CSS files from index.html, update SW precache list"
```

---

## Post-Refactor Notes

- Total line count across `css/*.css` should be noticeably **less** than the original 3197 lines (Task 1 alone removes ~135 dead lines; Task 2 removes duplicate media-query boilerplate).
- Future changes only need to open the relevant small file — e.g. "fix a flashcard bug" → `css/flashcard.css` only (~300 lines), not a 3200-line file — cutting token usage for any future CSS edit by roughly 90%.
- If a future feature doesn't fit any existing file, add a new `css/<feature>.css` and a new `<link>` in `index.html` rather than growing an existing file past ~400 lines.
