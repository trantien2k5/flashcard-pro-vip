# TOEIC Vocab Spark

Static PWA (no build tool) for TOEIC vocabulary study, served locally at `http://127.0.0.1:356/index.html`. Vietnamese-language UI; commit messages and code comments in English.

## Standing instructions

- **Auto-commit** after every code change without asking for confirmation each time.
- **Bump `APP_VERSION`** in `app.js` (shown in Settings → Thông tin) on every code/logic commit, so the user can visually confirm an update landed (service worker caches content, so this is the freshness signal). Pure data-only JSON commits (vocab content fixes) do NOT need a version bump — the app already picks up new JSON via stale-while-revalidate.
- Use **TodoWrite** to track multi-step work so progress is visible.
- **Token efficiency for large batch tasks** (e.g. fixing many vocab JSON files): prefer 1-2 long-running agents over many parallel worktree agents — each spawn/resume reloads full context and is expensive. Let an agent finish its whole assigned file list rather than checking in after each file. See memory `feedback_token_efficient_agents`.

## Architecture

- Plain HTML/CSS/JS, no bundler. `index.html` loads 11 separate `css/*.css` files (base, layout, home, topics, flashcard, quiz, review, notebook, settings, components, responsive) in cascade order — do not reintroduce a single `styles.css`.
- `app.js`: all app logic, including the FSRS-6 spaced-repetition algorithm (real implementation, not simplified — see `FSRS_WEIGHTS` and `calculateFSRS`/`fsrsNext*` functions).
- `service-worker.js`: network-first for the app shell (HTML/CSS/JS), stale-while-revalidate for `/data/*.json` and third-party assets. Has a scheme guard (`http:`/`https:` only) to avoid crashing on `chrome-extension://` requests.
- `data/vocabulary/*.json`: 49 topic files, each an array of word entries. Schema per entry: `id, word, pronunciation, audio, partOfSpeech, vietnamese, definition, example, exampleVi, topic, level, difficulty, collocations, wordFamily, image, tags, fsrs, statistics`.
- `localStorage` keys: `toeic_vocab_progress`, `toeic_vocab_settings`, `toeic_vocab_topic_recency`.

## Learn vs Review flow

Topics → Flashcard is the **Learn** flow: new words only (words with no `statistics.lastSeen`), shuffled once, capped by the session-size setting (5/10/15/20, Settings → Học tập). Ends in a completion screen (`#learn-session-complete`) with time + Again/Hard/Good/Easy stats. Due-for-review words belong to the separate **Review** tab/flow, not mixed into Learn.

## Known ongoing work: vocabulary data-quality pass

Many word entries across `data/vocabulary/*.json` were bulk-generated with placeholder content: generic `"We need to understand the concept of X"` examples (or irrelevant Wiktionary quotes), fake `"X process, key X"` collocations, templated `"X (partOfSpeech)"` wordFamily, occasional wrong-sense definitions/partOfSpeech/translations.

**Fixed so far (committed on main):** accounting, advertising, airport, appearance, banking, business, clothing, manufacturing.json.

**Not yet fixed (41 files):** common_adjectives, common_adverbs, common_verbs (checked — already good quality, likely no fixes needed), communication, contracts, customer_service, daily_activities, directions, drinks, education, email_letters, emotions, entertainment, environment, family_relationships, food, geography, health_body, hotel, house_furniture, human_resources, insurance, internet, jobs_careers, legal, logistics, marketing, media, meetings, numbers, office, personality, restaurant, sales, shopping, sports, technology, time_calendar, transportation, travel, weather.json.

Fix pattern per entry (only touch entries showing placeholder patterns, leave good ones alone):
1. `example`/`exampleVi`: natural TOEIC/workplace sentence matching the word's `topic`, accurate natural Vietnamese translation.
2. `collocations`: 2-4 real collocations, comma-separated.
3. `wordFamily`: real related forms across parts of speech, e.g. "economy (n), economic (adj), economically (adv)".
4. `definition`: rewrite in one clear learner-dictionary-style sentence if wrong-sense/irrelevant.
5. Fix `partOfSpeech`/`vietnamese` only if factually wrong.
6. Never touch `id, word, pronunciation, audio, topic, level, difficulty, image, tags, fsrs, statistics`.
7. Validate with `node -e "JSON.parse(require('fs').readFileSync('data/vocabulary/<file>.json','utf8'))"` before committing. One commit per file, message: `fix: improve vocabulary data quality for <topic-name> topic`.

**Fuller audit (2026-07-11, user rated dataset 6.5-7/10)** flagged additional issues beyond the placeholder pass, not yet started — confirm with user before starting each:
- IPA inconsistent (some entries have literal `/word/` instead of real transcription).
- `difficulty` is always `3` for every word — not meaningfully varied.
- Consider adding `synonyms`, `antonyms`, `commonMistakes` fields (e.g. profit vs revenue vs income vs earnings).
- Consider splitting `fsrs`/`statistics` out of the vocab JSON into separate progress storage — this is an architecture change touching `app.js` data loading, needs explicit go-ahead first.
