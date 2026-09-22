# \# Fluent Start

# 

# A local-first browser start page built as a Chrome / Edge extension. Dark acrylic interface, encrypted vault, bookmarks library, command palette, focus timer, media player, and a dashboard of live widgets — all running with \*\*no server, no account, and no telemetry\*\*.

# 

# !\[Version](https://img.shields.io/badge/version-3.1-0078d4)

# !\[Manifest](https://img.shields.io/badge/manifest-v3-00c4fc)

# !\[License](https://img.shields.io/badge/license-MIT-90dbff)

# 

# \---

# 

# \## Why

# 

# Every "new tab" replacement either wants your email, phones home, or ships a 4 MB font to render three icons. Fluent Start doesn't.

# 

# \- \*\*Zero cloud.\*\* Your data lives in `localStorage` + `IndexedDB` on this device only.

# \- \*\*Zero build step.\*\* Vanilla JS, no framework, no bundler, no npm install required to run.

# \- \*\*Zero telemetry.\*\* Weather and RSS are the only outbound requests, and they go straight from your browser to public APIs.

# \- \*\*Optional encryption.\*\* AES-GCM 256 with a passphrase you control.

# 

# It looks like a modern OS: fluid acrylic surfaces, deep charcoal palette, and a stack of widgets that feels like a dashboard, not a form.

# 

# \---

# 

# \## Highlights

# 

# \*\*Home\*\*

# \- Live clock, greeting, and timezone

# \- Multi-engine search (Google, DuckDuckGo, Bing, Brave, Kagi, Perplexity, YouTube, GitHub, Wikipedia) with `!bang` shortcuts

# \- Quick-launch dock with drag-to-reorder and category filters

# \- Seven dashboard widgets — Weather, Media Player, System Telemetry, Schedule, Scratchpad, Curated Signals, Security

# 

# \*\*Bookmarks\*\*

# \- Grid / list views with pinned items

# \- Folders and tags with live counts

# \- Full-text search across title, URL, host, and tags

# \- Import from Chrome / Firefox / Edge (HTML export or pasted URLs)

# \- Export to Netscape HTML or JSON

# \- Favicons via DuckDuckGo with a privacy-preserving fallback

# 

# \*\*Command Palette\*\* (`⌘K` / `Ctrl+K`)

# \- Fuzzy search across apps, bookmarks, history, and every action in the app

# \- `>` prefix in the omnibox for inline command mode

# 

# \*\*Focus Timer\*\* (`F`)

# \- Pomodoro / Deep work / Ultradian presets

# \- Custom duration, pause and resume, native notification, gentle chime

# \- Persists across tab closes — the timer keeps counting even if you leave

# 

# \*\*Media Player\*\*

# \- Stream tracks from a bundled playlist, or drop in your own audio files

# \- Files are stored locally in IndexedDB and persist across sessions

# \- Play, pause, seek, shuffle, repeat one/all/off

# 

# \*\*Security\*\*

# \- Optional AES-GCM 256 encryption via PBKDF2 (200 000 iterations)

# \- Local sandbox mode — clearly labels that no cloud telemetry is transmitted

# \- Audit log listing vault state, session start, and storage footprint

# 

# \*\*Accessibility \& polish\*\*

# \- Full keyboard navigation with focus trap in modals

# \- `prefers-reduced-motion` support

# \- Automatic "low-performance" mode on weak devices (reduced blur, no animations)

# \- Auto-hide header/footer while scrolling

# 

# \---

# 

# \## Install

# 

# \### Chrome / Edge

# 

# 1\. Download or clone this repository.

# 2\. Open `chrome://extensions/` (or `edge://extensions/`).

# 3\. Enable \*\*Developer mode\*\* (top-right corner in Chrome, left sidebar in Edge).

# 4\. Click \*\*Load unpacked\*\* and select the project folder.

# 5\. Open a new tab.

# 

# That's it. No build, no npm install, no configuration.

# 

# \### Firefox

# 

# Firefox requires a slightly different manifest structure. See \[Firefox notes](#firefox-notes) below.

# 

# \---

# 

# \## Usage

# 

# \### Keyboard shortcuts

# 

# | Key | Action |

# | --- | --- |

# | `/` | Focus search |

# | `⌘K` / `Ctrl+K` | Command palette |

# | `⌘⇧K` / `Ctrl+Shift+K` | Focus search from anywhere |

# | `Enter` | Run search |

# | `Esc` | Dismiss / close |

# | `W` | Change wallpaper |

# | `B` | Save a bookmark |

# | `A` | Add a new app |

# | `T` | Cycle theme (dark → light → auto) |

# | `F` | Start / pause focus timer |

# | `P` | Play / pause music |

# | `N` | Focus scratchpad |

# | `E` | Add calendar event |

# | `1`–`6` | Filter dock by category |

# | `,` | Open settings |

# | `?` | Show all shortcuts |

# 

# \### Search engine shortcuts

# 

# Type any of these at the start of the omnibox:

# 

# ```

# !g react hooks        → Google

# !d mechanical keyboard → DuckDuckGo

# !gh vite              → GitHub

# !yt lo-fi beats       → YouTube

# !w quantum computing  → Wikipedia

# ```

# 

# Type `>` alone to switch the omnibox into command palette mode.

# 

# \---

# 

# \## Architecture

# 

# ```

# Fluent-Start/

# ├── manifest.json         Manifest V3 declaration

# ├── startpage.html        Extension new-tab entry point

# ├── styles.css            Full stylesheet (source)

# ├── styles.min.css        Minified (loaded by the extension)

# ├── fonts-ready.js        Prevents icon-font FOUT

# ├── app.js                Application source

# ├── app.min.js            Minified bundle (loaded by the extension)

# ├── icon128.png           Toolbar icon

# └── README.md

# ```

# 

# The app is a single IIFE in `app.js`. There is no module system, no imports, no build pipeline. Every subsystem — state, storage, theming, widgets, palette, focus timer — is a self-contained block inside the same closure.

# 

# \### Data model

# 

# Two persistence layers:

# 

# \- \*\*`localStorage`\*\* — application state (settings, apps, bookmarks, todos, events, feed config, focus timer, etc.). Serialized as one JSON blob. Optionally encrypted.

# \- \*\*`IndexedDB`\*\* — binary assets (uploaded wallpapers, imported audio files).

# 

# Migration is handled by `mergeInto(defaultState(), saved)` on every load. Adding new fields to `defaultState()` is safe — existing users pick them up on the next boot.

# 

# \### Performance

# 

# Measured on a cold new tab with Chrome DevTools Performance:

# 

# | Metric | Value |

# | --- | --- |

# | Total main-thread work | 1.2 s |

# | Scripting | 26 ms |

# | Painting | 15 ms |

# | Rendering | 124 ms |

# | Font payload | 374 KB |

# | CSS + JS payload | 339 KB |

# 

# Two architectural decisions drive these numbers:

# 

# 1\. \*\*No runtime Tailwind.\*\* Classes are compiled into `styles.min.css` once and served statically. The Tailwind Play CDN is intentionally not used — it re-scans the DOM on every render and burns main-thread time.

# 2\. \*\*Single Ticker.\*\* All periodic work (clock, focus timer, telemetry, security, weather, feeds, battery) is scheduled through one `setTimeout`-based loop rather than a fleet of `setInterval` calls. Tasks sleep exactly as long as they need to.

# 

# Additionally, `body.scrolling` suspends every `backdrop-filter` during scroll so the compositor has no GPU work beyond the wallpaper layer.

# 

# \### External dependencies

# 

# The extension makes requests to three endpoints and nothing else:

# 

# | Service | Purpose | When |

# | --- | --- | --- |

# | `fonts.googleapis.com` / `fonts.gstatic.com` | Inter + Material Symbols | On load (cached) |

# | `api.open-meteo.com` | Weather | Every 10 minutes |

# | `hacker-news.firebaseio.com`, `dev.to`, `geocoding-api.open-meteo.com` | Feed headlines, city search | Every 5 minutes, or on demand |

# 

# Favicons come from `icons.duckduckgo.com` and `google.com/s2/favicons`, both lazily and with privacy-preserving `referrerpolicy="no-referrer"`.

# 

# No analytics, no crash reporting, no accounts.

# 

# \---

# 

# \## Customisation

# 

# \### Add a preset wallpaper

# 

# Edit the `WALLPAPERS` array in `app.js`. Each entry accepts either a `url` or a CSS `gradient`:

# 

# ```javascript

# { id: 'my-wallpaper', name: 'My Wallpaper', url: 'https://example.com/image.jpg' }

# { id: 'my-gradient',  name: 'Deep Ocean',   gradient: 'linear-gradient(135deg,#0b1e3a,#0c4a6e)' }

# ```

# 

# \### Add a search engine

# 

# Edit `ENGINES` in `app.js`:

# 

# ```javascript

# myEngine: { name: 'MyEngine', icon: 'search', url: 'https://myengine.com/?q=' }

# ```

# 

# Any Material Symbols icon name works for `icon`. The new engine appears in the omnibox tabs automatically.

# 

# \### Change default apps

# 

# Edit `DEFAULT\_APPS`. Existing users won't see the change (their state is already saved) — only fresh installs pick up new defaults.

# 

# \---

# 

# \## Development

# 

# There's nothing to install. Edit the source files, rebuild the minified bundles, and reload the extension.

# 

# \### One-time setup for minification (optional)

# 

# ```bash

# npm install -g esbuild

# ```

# 

# Or use `npx` to skip the global install.

# 

# \### Build

# 

# From the project folder:

# 

# ```bash

# npx esbuild app.js    --minify --outfile=app.min.js

# npx esbuild styles.css --minify --outfile=styles.min.css

# ```

# 

# \### Watch mode

# 

# ```bash

# npx esbuild app.js    --minify --outfile=app.min.js --watch

# npx esbuild styles.css --minify --outfile=styles.min.css --watch

# ```

# 

# Leave these running while you work. Every save regenerates the bundle.

# 

# \### Reload the extension

# 

# After any change to `app.min.js`, `styles.min.css`, `startpage.html`, or `manifest.json`:

# 

# 1\. Open `chrome://extensions/`

# 2\. Click the circular reload arrow on the Fluent Start card

# 3\. Open a fresh new tab

# 

# Refreshing the tab alone is \*\*not\*\* enough — Chrome caches extension resources until the extension itself reloads.

# 

# \### Verifying changes at runtime

# 

# Because minification renames every local identifier, searching the minified output for a function name will fail even when the code is present. Two reliable checks:

# 

# \- Search for a string literal (strings survive minification): `Select-String -Path app.min.js -Pattern "\_\_scrollPerfReady"`

# \- Check the runtime state in DevTools console: `window.\_\_scrollPerfReady`

# 

# \---

# 

# \## Firefox notes

# 

# Firefox does not fully support Manifest V3's `chrome\_url\_overrides` for the new-tab page in the same way Chrome does. To port:

# 

# 1\. Copy the project into a Firefox-compatible extension folder.

# 2\. Change `"manifest\_version": 3` to `2`.

# 3\. Replace the `content\_security\_policy` block with:

# 

# &#x20;  ```json

# &#x20;  "content\_security\_policy": "script-src 'self'; object-src 'self'"

# &#x20;  ```

# 

# 4\. Firefox requires the new-tab override key to be `chrome\_url\_overrides: { newtab: "startpage.html" }` — this is already the case.

# 

# I have not verified this on Firefox yet. Contributions welcome.

# 

# \---

# 

# \## Known limitations

# 

# \- \*\*Microsoft Teams integration is not implemented.\*\* Teams' web app blocks iframe embedding, and reading the calendar requires an Azure AD app registration with MSAL OAuth. The schedule widget accepts manual Teams meeting links (paste a `https://teams.microsoft.com/l/meetup-join/…` URL into an event's location field, and the widget renders a "Join" button).

# \- \*\*The Material Symbols variable font is pinned to two configurations\*\* (regular and filled, weight 400 and 500). Icons that use other weights or grades will render as literal ligature names. Stick to the built-in icon set.

# \- \*\*`chrome\_url\_overrides` doesn't apply to incognito windows\*\* unless the user explicitly enables the extension in incognito.

# \- \*\*No cloud sync.\*\* By design. If you use the same vault across machines, export and import manually.

# 

# \---

# 

# \## Credits

# 

# \- Design language inspired by \*\*Windows 11 Fluent\*\* and \*\*Acrylic\*\* material

# \- Typography: \[Inter](https://rsms.me/inter/) by Rasmus Andersson, \[Material Symbols](https://fonts.google.com/icons) by Google

# \- Weather: \[Open-Meteo](https://open-meteo.com/) — free, no API key, no tracking

# \- Feed sources: \[Hacker News](https://news.ycombinator.com/), \[Dev.to](https://dev.to/)

# \- Built with zero frameworks, zero dependencies, and a mild obsession with not wasting CPU cycles

# 

# \---

# 

# \## License

# 

# MIT. Do whatever you want with it.

