/* ══════════════════════════════════════════════════════════════════════════
   FLUENT START v3.1 — Optimized core with Bookmarks + weather fix
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    /* ───────────────────────────── Utilities ───────────────────────────── */
    const $ = (s, r) => (r || document).querySelector(s);
    const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
    const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const pad = n => String(n).padStart(2, '0');
    const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
    const pathOf = u => { try { const x = new URL(u); return x.pathname === '/' ? '' : x.pathname.slice(0, 40); } catch (e) { return ''; } };
    const debounce = (fn, ms) => { let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(() => fn.apply(c, a), ms); }; };
    const throttle = (fn, ms) => { let last = 0, timer = null; return function () { const now = Date.now(), ctx = this, args = arguments; if (now - last >= ms) { last = now; fn.apply(ctx, args); } else { clearTimeout(timer); timer = setTimeout(() => { last = Date.now(); fn.apply(ctx, args); }, ms - (now - last)); } }; };

    function timeAgo(ts) {
        const s = Math.floor((Date.now() - ts) / 1000);
        if (s < 60) return s + 's ago';
        if (s < 3600) return Math.floor(s / 60) + 'm ago';
        if (s < 86400) return Math.floor(s / 3600) + 'h ago';
        if (s < 604800) return Math.floor(s / 86400) + 'd ago';
        return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    function bytes(n) {
        if (!n && n !== 0) return '—';
        const u = ['B', 'KB', 'MB', 'GB']; let i = 0;
        while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
        return n.toFixed(n < 10 && i > 0 ? 1 : 0) + ' ' + u[i];
    }
    function b64(buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))); }
    function unb64(str) { return Uint8Array.from(atob(str), c => c.charCodeAt(0)); }
    function normaliseUrl(u) {
        u = String(u || '').trim();
        if (!u) return '';
        if (!/^https?:\/\//i.test(u)) u = 'https://' + u.replace(/^\/+/, '');
        return u;
    }
    function isValidUrl(u) { try { const x = new URL(u); return !!x.hostname; } catch (e) { return false; } }
    function faviconFor(url) {
        try {
            const h = new URL(url).hostname;
            if (
                h === 'localhost' ||
                /^127\./.test(h) ||
                /^10\./.test(h) ||
                /^192\.168\./.test(h) ||
                /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
                /^\d+\.\d+\.\d+\.\d+$/.test(h)
            ) return '';
            return 'https://icons.duckduckgo.com/ip3/' + h + '.ico';
        } catch (e) { return ''; }
    }
    function faviconImg(url, cls) {
        const ddg = faviconFor(url);
        let g = '';
        try {
            const h = new URL(url).hostname;
            g = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(h) + '&sz=64';
        } catch (e) { }
        const primary = ddg || g;
        if (!primary) return '';
        return '<img src="' + primary + '" referrerpolicy="no-referrer" class="' + (cls || '') + '" alt="" ' +
            'onerror="this.onerror=null;this.src=\'' + g + '\'"/>';
    }

    /* ───────────────────────────── IndexedDB ───────────────────────────── */
    const idb = (() => {
        let dbp = null;
        function open() {
            if (!dbp) dbp = new Promise((res, rej) => {
                const rq = indexedDB.open('fluent-start', 1);
                rq.onupgradeneeded = () => {
                    const db = rq.result;
                    if (!db.objectStoreNames.contains('wallpapers')) db.createObjectStore('wallpapers');
                    if (!db.objectStoreNames.contains('media')) db.createObjectStore('media');
                };
                rq.onsuccess = () => res(rq.result);
                rq.onerror = () => rej(rq.error);
            });
            return dbp;
        }
        const tx = async (store, mode, fn) => {
            const db = await open();
            return new Promise((res, rej) => {
                const t = db.transaction(store, mode);
                const r = fn(t.objectStore(store));
                t.oncomplete = () => res(r && r.result);
                t.onerror = () => rej(t.error);
            });
        };
        return {
            set: (s, k, v) => tx(s, 'readwrite', st => st.put(v, k)),
            get: (s, k) => tx(s, 'readonly', st => st.get(k)),
            del: (s, k) => tx(s, 'readwrite', st => st.delete(k)),
            clear: (s) => tx(s, 'readwrite', st => st.clear())
        };
    })();

    /* ───────────────────────────── Constants ───────────────────────────── */
    const ENGINES = {
        google: { name: 'Google', icon: 'travel_explore', url: 'https://www.google.com/search?q=' },
        duckduckgo: { name: 'DuckDuckGo', icon: 'security', url: 'https://duckduckgo.com/?q=' },
        bing: { name: 'Bing', icon: 'hub', url: 'https://www.bing.com/search?q=' },
        brave: { name: 'Brave', icon: 'shield', url: 'https://search.brave.com/search?q=' },
        kagi: { name: 'Kagi', icon: 'auto_awesome', url: 'https://kagi.com/search?q=' },
        perplexity: { name: 'Perplexity', icon: 'psychology', url: 'https://www.perplexity.ai/search?q=' },
        youtube: { name: 'YouTube', icon: 'smart_display', url: 'https://www.youtube.com/results?search_query=' },
        github: { name: 'GitHub', icon: 'terminal', url: 'https://github.com/search?q=' },
        wikipedia: { name: 'Wikipedia', icon: 'menu_book', url: 'https://en.wikipedia.org/w/index.php?search=' }
    };
    const BANGS = { g: 'google', gh: 'github', yt: 'youtube', w: 'wikipedia', d: 'duckduckgo', b: 'bing', k: 'kagi', br: 'brave', pp: 'perplexity' };

    const CATEGORIES = [
        { id: 'all', label: 'All' }, { id: 'dev', label: 'Development' },
        { id: 'work', label: 'Productivity' }, { id: 'media', label: 'Media' },
        { id: 'social', label: 'Social' }, { id: 'other', label: 'Other' }
    ];

    const WALLPAPERS = [
        { id: 'neo-tokyo', name: 'Rain in Neo-Tokyo', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDikDp8k771q0GDRhimF99lAyyncMyi5DUquBLcQsIUYUBGOBAz65ez3a_RtYZj-8AZ6a9FbjL9eisdE1c0fzPZTsWD9DnzDt44pHeT8_4jbe4vqp2XKC2ZbW6p6t4OvBMdKiIRSDjtCTd4PBLq4Joow2QOL4mtZfQ0j7G8alfFX1aHdGMIEb8ahgKBDx2wESOP5-Wb41Dc_PTG-AnxCu5wH9o8Id0noBFnk9vXeMcOUYqyf6A_3nKATw' },
        { id: 'night-ridge', name: 'Night Ridge', url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=80' },
        { id: 'nebula', name: 'Deep Nebula', url: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?auto=format&fit=crop&w=1920&q=80' },
        { id: 'city-night', name: 'City After Dark', url: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=1920&q=80' },
        { id: 'misty', name: 'Misty Valley', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1920&q=80' },
        { id: 'alpine', name: 'Alpine Mirror', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1920&q=80' },
        { id: 'orbit', name: 'Low Orbit', url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1920&q=80' },
        { id: 'grad-aurora', name: 'Aurora Gradient', gradient: 'linear-gradient(135deg,#0b1e3a 0%,#123a63 30%,#0d6f8f 60%,#00c4fc 100%)' },
        { id: 'grad-violet', name: 'Violet Drift', gradient: 'linear-gradient(140deg,#0a0714 0%,#2a0053 35%,#5c2d91 68%,#dab9ff 100%)' },
        { id: 'grad-ember', name: 'Ember Dusk', gradient: 'linear-gradient(160deg,#0d0a12 0%,#3a1030 45%,#8f2d5c 78%,#ff9e7a 100%)' },
        { id: 'grad-slate', name: 'Slate Minimal', gradient: 'linear-gradient(180deg,#0f141c 0%,#1b2028 60%,#30353e 100%)' }
    ];

    /* ─── WEATHER CODES (EMOJI — cannot fail) ─── */
    const WMO = {
        0: ['☀️', '🌙', 'Clear sky'],
        1: ['🌤️', '🌙', 'Mainly clear'],
        2: ['⛅', '☁️', 'Partly cloudy'],
        3: ['☁️', '☁️', 'Overcast'],
        45: ['🌫️', '🌫️', 'Fog'],
        48: ['🌫️', '🌫️', 'Rime fog'],
        51: ['🌦️', '🌦️', 'Light drizzle'],
        53: ['🌦️', '🌦️', 'Drizzle'],
        55: ['🌧️', '🌧️', 'Dense drizzle'],
        56: ['🌧️', '🌧️', 'Freezing drizzle'],
        57: ['🌧️', '🌧️', 'Freezing drizzle'],
        61: ['🌧️', '🌧️', 'Light rain'],
        63: ['🌧️', '🌧️', 'Moderate rain'],
        65: ['🌧️', '🌧️', 'Heavy rain'],
        66: ['🌧️', '🌧️', 'Freezing rain'],
        67: ['🌧️', '🌧️', 'Freezing rain'],
        71: ['🌨️', '🌨️', 'Light snow'],
        73: ['🌨️', '🌨️', 'Moderate snow'],
        75: ['❄️', '❄️', 'Heavy snow'],
        77: ['🌨️', '🌨️', 'Snow grains'],
        80: ['🌦️', '🌦️', 'Light showers'],
        81: ['🌧️', '🌧️', 'Showers'],
        82: ['⛈️', '⛈️', 'Violent showers'],
        85: ['🌨️', '🌨️', 'Snow showers'],
        86: ['🌨️', '🌨️', 'Heavy snow showers'],
        95: ['⛈️', '⛈️', 'Thunderstorm'],
        96: ['⛈️', '⛈️', 'Thunderstorm w/ hail'],
        99: ['⛈️', '⛈️', 'Thunderstorm w/ hail']
    };
    const wmo = (code, isDay) => { const e = WMO[code] || ['☁️', '☁️', 'Unknown']; return { icon: isDay ? e[0] : e[1], label: e[2] }; };

    const DEFAULT_APPS = [
        { id: 'github', name: 'GitHub', url: 'https://github.com', icon: 'terminal', kind: 'symbol', cat: 'dev', color: '#90dbff', launches: 0 },
        { id: 'vercel', name: 'Vercel', url: 'https://vercel.com', icon: 'change_history', kind: 'symbol', cat: 'dev', color: '#a3c9ff', launches: 0 },
        { id: 'linear', name: 'Linear', url: 'https://linear.app', icon: 'check_circle', kind: 'symbol', cat: 'work', color: '#dab9ff', launches: 0 },
        { id: 'figma', name: 'Figma', url: 'https://figma.com', icon: 'draw', kind: 'symbol', cat: 'dev', color: '#00c4fc', launches: 0 },
        { id: 'notion', name: 'Notion', url: 'https://notion.so', icon: 'menu_book', kind: 'symbol', cat: 'work', color: '#d3e3ff', launches: 0 },
        { id: 'slack', name: 'Slack', url: 'https://slack.com', icon: 'tag', kind: 'symbol', cat: 'work', color: '#efdbff', launches: 0 },
        { id: 'youtube', name: 'YouTube', url: 'https://youtube.com', icon: 'smart_display', kind: 'symbol', cat: 'media', color: '#ffb4ab', launches: 0 },
        { id: 'spotify', name: 'Spotify', url: 'https://spotify.com', icon: 'graphic_eq', kind: 'symbol', cat: 'media', color: '#90dbff', launches: 0 }
    ];

    const DEFAULT_TRACKS = [
        { id: 't1', title: 'Neon Corridor', artist: 'SoundHelix', album: 'Voltage EP', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', c1: '#0078d4', c2: '#00c4fc' },
        { id: 't2', title: 'Midnight Circuit', artist: 'SoundHelix', album: 'Voltage EP', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', c1: '#5c2d91', c2: '#dab9ff' },
        { id: 't3', title: 'Chrome Rain', artist: 'SoundHelix', album: 'Night Drive', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', c1: '#0d6f8f', c2: '#90dbff' },
        { id: 't4', title: 'Afterglow Drive', artist: 'SoundHelix', album: 'Night Drive', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', c1: '#8f2d5c', c2: '#ff9e7a' },
        { id: 't5', title: 'Static Bloom', artist: 'SoundHelix', album: 'Ambient Set', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3', c1: '#123a63', c2: '#6bd3ff' }
    ];

    const WIDGETS = [
        { id: 'weather', name: 'Weather', icon: 'rainy', desc: 'Live conditions from Open-Meteo', col: 3, defaultOn: true },
        { id: 'player', name: 'Media Player', icon: 'graphic_eq', desc: 'Playlist with local & streaming audio', col: 3, defaultOn: true },
        { id: 'telemetry', name: 'System Telemetry', icon: 'memory', desc: 'Real device & browser statistics', col: 3, defaultOn: true },
        { id: 'schedule', name: "Today's Schedule", icon: 'calendar_today', desc: 'Local agenda with reminders', col: 3, defaultOn: true },
        { id: 'scratchpad', name: 'Quick Scratchpad', icon: 'checklist', desc: 'Tasks that persist offline', col: 4, defaultOn: true },
        { id: 'feeds', name: 'Curated Signals', icon: 'rss_feed', desc: 'Hacker News & Dev.to headlines', col: 4, defaultOn: true },
        { id: 'security', name: 'Security & Network', icon: 'vpn_key', desc: 'Vault encryption & privacy signals', col: 4, defaultOn: true }
    ];

    const DEFAULT_BM_FOLDERS = ['Inbox', 'Work', 'Reading', 'Tools'];

    /* ───────────────────────────── Default State ───────────────────────────── */
    function defaultState() {
        return {
            version: 3,
            user: { name: 'Alex' },
            theme: 'dark',
            clock24: true,
            showSeconds: true,
            greetingEnabled: true,
            searchInNewTab: true,
            engine: 'google',
            history: [],
            wallpaper: { type: 'preset', id: 'neo-tokyo' },
            customWallpapers: [],
            apps: DEFAULT_APPS.map(a => Object.assign({}, a)),
            appFilter: 'all',
            bookmarks: [],
            bmFolders: DEFAULT_BM_FOLDERS.slice(),
            bmView: 'grid',
            bmSort: 'recent',
            bmFilter: 'all',
            bmQuery: '',
            todos: [
                { id: uid(), text: 'Ship startpage v3 layout', done: true },
                { id: uid(), text: 'Review Pull Request #142', done: false },
                { id: uid(), text: 'Read neural rendering paper', done: false }
            ],
            events: [],
            weather: { lat: 47.6062, lon: -122.3321, city: 'Seattle, WA', unit: 'f', auto: false },
            feeds: [
                { id: 'hn', name: 'Hacker News', type: 'hn', enabled: true },
                { id: 'devto', name: 'Dev.to', type: 'devto', enabled: true }
            ],
            tracks: DEFAULT_TRACKS.map(t => Object.assign({}, t)),
            player: { index: 0, volume: 0.7, shuffle: false, repeat: 'off' },
            security: { dns: '1.1.1.1 (DoH)', shield: true },
            widgets: WIDGETS.map(w => ({ id: w.id, on: w.defaultOn })),
            reduceMotion: false,
            encrypted: false
        };
    }

    /* ───────────────────────────── State I/O ───────────────────────────── */
    const LS_KEY = 'fluent-start-state-v1';
    const LS_WRAP = 'fluent-start-envelope-v1';
    let state = defaultState();
    let cryptoKey = null;

    const serialize = () => JSON.stringify(state);

    function persistNow() {
        try {
            if (cryptoKey && window.crypto && crypto.subtle) encryptAndStore(serialize());
            else localStorage.setItem(LS_KEY, serialize());
        } catch (e) { toast('Storage error: ' + e.message, 'error'); }
    }
    const persist = debounce(persistNow, 400);

    async function encryptAndStore(plain) {
        const enc = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, enc.encode(plain));
        localStorage.setItem(LS_WRAP, JSON.stringify({ enc: true, v: 1, iv: b64(iv), data: b64(ct) }));
        localStorage.removeItem(LS_KEY);
    }

    async function deriveKey(pass, saltB64) {
        const enc = new TextEncoder();
        const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
        const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
        const key = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
            base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
        );
        return { key, salt: b64(salt) };
    }
    const hasEncryptedVault = () => !!localStorage.getItem(LS_WRAP);

    function loadState() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (raw) { mergeInto(defaultState(), JSON.parse(raw)); return true; }
        } catch (e) { console.warn('load failed', e); }
        return false;
    }
    function mergeInto(base, saved) {
        Object.keys(base).forEach(k => {
            if (saved[k] === undefined) return;
            if (Array.isArray(base[k])) base[k] = saved[k];
            else if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) Object.assign(base[k], saved[k]);
            else base[k] = saved[k];
        });
        state = base;
    }

    /* ───────────────────────────── Toasts ───────────────────────────── */
    const TOAST_ICON = { info: 'info', success: 'check_circle', warn: 'warning', error: 'error' };
    const toastRoot = () => $('#toasts');
    function toast(msg, kind) {
        kind = kind || 'info';
        const el = document.createElement('div');
        el.className = 'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl acrylic-strong rim text-on-surface font-body-md text-body-md shadow-2xl max-w-sm pop';
        el.innerHTML = '<span class="material-symbols-outlined text-[20px] ' +
            (kind === 'error' ? 'text-error' : kind === 'warn' ? 'text-tertiary' : kind === 'success' ? 'text-secondary' : 'text-primary') +
            '">' + (TOAST_ICON[kind] || 'info') + '</span><span class="flex-1">' + esc(msg) + '</span>';
        const root = toastRoot();
        // Cap at 3 visible toasts; dismiss the oldest
        while (root.children.length >= 3) root.firstChild.remove();
        root.appendChild(el);
        setTimeout(() => {
            el.style.transition = 'opacity .25s, transform .25s';
            el.style.opacity = '0'; el.style.transform = 'translateX(12px)';
            setTimeout(() => el.remove(), 260);
        }, 3000);
    }

    /* ───────────────────────────── Modal ───────────────────────────── */
    let modalEscHandler = null;
    function openModal(opts) {
        const root = $('#modal-root');
        root.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop';
        const panel = document.createElement('div');
        panel.className = 'relative w-full ' + (opts.width || 'max-w-lg') + ' max-h-[88vh] overflow-y-auto rounded-2xl acrylic-strong rim pop';
        panel.innerHTML =
            '<div class="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 py-4 border-b border-outline-variant/30 bg-surface-container/60 backdrop-blur-xl">' +
            '<div class="flex items-center gap-2.5 min-w-0">' +
            (opts.icon ? '<span class="material-symbols-outlined text-secondary text-[20px]">' + opts.icon + '</span>' : '') +
            '<h3 class="font-headline-sm text-headline-sm text-on-surface truncate">' + esc(opts.title || '') + '</h3>' +
            '</div>' +
            '<button data-close class="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors shrink-0"><span class="material-symbols-outlined text-[20px]">close</span></button>' +
            '</div>' +
            '<div class="p-5" id="modal-body"></div>' +
            (opts.footer === false ? '' : '<div class="sticky bottom-0 px-5 py-4 border-t border-outline-variant/30 bg-surface-container/60 backdrop-blur-xl flex items-center justify-end gap-2" id="modal-footer"></div>');
        wrap.appendChild(panel);
        root.appendChild(wrap);

        const body = panel.querySelector('#modal-body');
        if (typeof opts.body === 'string') body.innerHTML = opts.body;
        else if (opts.body) body.appendChild(opts.body);

        const footer = panel.querySelector('#modal-footer');
        if (footer) {
            if (typeof opts.footer === 'string') footer.innerHTML = opts.footer;
            else footer.innerHTML =
                '<button data-close class="h-9 px-4 rounded-full bg-surface-container-high/70 text-on-surface font-label-md text-label-md hover:bg-surface-container-highest transition">Cancel</button>' +
                '<button data-ok class="h-9 px-5 rounded-full bg-primary-container text-on-primary-container font-label-md text-label-md font-semibold shadow hover:brightness-110 transition">Save</button>';
        }

        const close = () => {
            root.innerHTML = '';
            if (modalEscHandler) { document.removeEventListener('keydown', modalEscHandler, true); modalEscHandler = null; }
        };
        wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
        $$('[data-close]', panel).forEach(b => b.addEventListener('click', close));
        const okBtn = panel.querySelector('[data-ok]');
        if (okBtn) okBtn.addEventListener('click', () => {
            if (opts.onOk) { if (opts.onOk(panel) !== false) close(); }
            else close();
        });

        modalEscHandler = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
        document.addEventListener('keydown', modalEscHandler, true);
        const focusable = () => $$('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', panel)
            .filter(el => el.offsetParent !== null);

        const trapKey = (e) => {
            if (e.key !== 'Tab') return;
            const list = focusable();
            if (!list.length) return;
            const first = list[0], last = list[list.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        panel.addEventListener('keydown', trapKey);
        setTimeout(() => { const f = panel.querySelector('input,select,textarea'); if (f && opts.autofocus !== false) f.focus(); }, 60);
        return { panel, body, close };
    }

    /* ───────────────────────────── Context menu ───────────────────────────── */
    function showCtxMenu(x, y, items) {
        const m = $('#ctx-menu');
        m.innerHTML = items.map((it, i) => it === '-' ? '<div class="ctx-sep"></div>' :
            '<div class="ctx-item" data-i="' + i + '"><span class="material-symbols-outlined text-[18px] ' + (it.danger ? 'text-error' : 'text-on-surface-variant') + '">' + it.icon + '</span>' + esc(it.label) + (it.hint ? '<span class="ml-auto pl-4 font-mono text-[10px] text-on-surface-variant">' + esc(it.hint) + '</span>' : '') + '</div>'
        ).join('');
        m.classList.remove('hidden');
        const w = m.offsetWidth, h = m.offsetHeight;
        m.style.left = Math.min(x, innerWidth - w - 8) + 'px';
        m.style.top = Math.min(y, innerHeight - h - 8) + 'px';
        const handler = (e) => {
            const t = e.target.closest('.ctx-item');
            if (t) { const idx = +t.dataset.i; const it = items[idx]; hide(); if (it && it.action) it.action(); }
            else if (!m.contains(e.target)) hide();
            e.stopPropagation();
        };
        function hide() {
            m.classList.add('hidden');
            document.removeEventListener('mousedown', handler, true);
            document.removeEventListener('contextmenu', handler, true);
        }
        setTimeout(() => {
            document.addEventListener('mousedown', handler, true);
            document.addEventListener('contextmenu', handler, true);
        }, 0);
    }

    /* ══════════════════════════════════════════════════════════════════════════
       PERF MODE
       ══════════════════════════════════════════════════════════════════════════ */
    const perf = {
        lowEnd: false,
        detect() {
            const cores = navigator.hardwareConcurrency || 4;
            const mem = navigator.deviceMemory || 8;
            const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const saveData = navigator.connection && navigator.connection.saveData;
            this.lowEnd = cores <= 4 || mem <= 4 || rm || saveData;
            document.documentElement.classList.toggle('low-perf', this.lowEnd);
            document.documentElement.classList.toggle('reduce-motion', rm || state.reduceMotion);
        }
    };

    /* ══════════════════════════════════════════════════════════════════════════
       TICKER — timer-based scheduler (was rAF-based; rAF was burning 60 callbacks/s)
       ══════════════════════════════════════════════════════════════════════════ */
    const Ticker = {
        tasks: [], timer: null, running: false,
        add(id, intervalMs, fn) {
            this.tasks.push({ id, interval: intervalMs, fn, next: performance.now() + intervalMs });
        },
        start() {
            if (this.running) return;
            this.running = true;
            this.schedule();
        },
        stop() {
            if (this.timer) { clearTimeout(this.timer); this.timer = null; }
            this.running = false;
        },
        schedule() {
            if (!this.running) return;
            if (document.hidden) {
                // When hidden, pause everything and check again in 2 s
                this.timer = setTimeout(() => this.schedule(), 2000);
                return;
            }
            const now = performance.now();
            let soonest = Infinity;
            for (let i = 0; i < this.tasks.length; i++) {
                const t = this.tasks[i];
                if (now >= t.next) {
                    try { t.fn(); } catch (e) { /* silent */ }
                    t.next = now + t.interval;
                }
                soonest = Math.min(soonest, t.next - now);
            }
            // Wake up when the next task is due, capped at 1 s
            const delay = Math.max(20, Math.min(1000, soonest));
            this.timer = setTimeout(() => this.schedule(), delay);
        }
    };

    /* ══════════════════════════════════════════════════════════════════════════
       THEME
       ══════════════════════════════════════════════════════════════════════════ */
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    function applyTheme() {
        let effective = state.theme;
        if (state.theme === 'auto') effective = mq.matches ? 'light' : 'dark';
        document.documentElement.classList.toggle('light', effective === 'light');
        document.documentElement.classList.toggle('dark', effective === 'dark');
        document.documentElement.classList.toggle('reduce-motion', !!state.reduceMotion);
        $$('.theme-btn').forEach(b => {
            const on = b.dataset.theme === state.theme;
            b.classList.toggle('bg-primary-container', on);
            b.classList.toggle('text-on-primary-container', on);
            b.classList.toggle('shadow-sm', on);
            b.classList.toggle('text-on-surface-variant', !on);
        });
    }
    mq.addEventListener('change', () => { if (state.theme === 'auto') applyTheme(); });

    /* ══════════════════════════════════════════════════════════════════════════
       WALLPAPER
       ══════════════════════════════════════════════════════════════════════════ */
    let lastWallpaperApplied = '';
    async function resolveWallpaperUrl(w) {
        if (!w) return '';
        if (w.type === 'preset') { const p = WALLPAPERS.find(x => x.id === w.id); return p ? (p.url || p.gradient) : ''; }
        if (w.type === 'url') return w.url;
        if (w.type === 'custom') { try { return await idb.get('wallpapers', w.id) || ''; } catch (e) { return ''; } }
        return '';
    }
    async function applyWallpaper(force) {
        const url = await resolveWallpaperUrl(state.wallpaper);
        const key = url || 'none';
        if (!force && key === lastWallpaperApplied) return;
        lastWallpaperApplied = key;
        const layer = $('#wallpaper-image');
        const isGradient = url && url.startsWith('linear-gradient');
        if (isGradient) { layer.style.background = url; layer.style.backgroundImage = ''; }
        else if (url) { layer.style.background = ''; layer.style.backgroundImage = "url('" + url + "')"; }
        else { layer.style.background = ''; layer.style.backgroundImage = 'none'; }
        let name = 'Custom';
        if (state.wallpaper.type === 'preset') { const p = WALLPAPERS.find(x => x.id === state.wallpaper.id); name = p ? p.name : 'Preset'; }
        else if (state.wallpaper.type === 'url') name = hostOf(state.wallpaper.url) || 'External';
        else { const c = state.customWallpapers.find(x => x.id === state.wallpaper.id); name = c ? c.name : 'Custom'; }
        const nEl = $('#wallpaper-name'); if (nEl) nEl.textContent = name;
        const scrim = $('#wallpaper-scrim'); if (scrim) scrim.style.opacity = isGradient ? '0.55' : '1';
    }

    function openWallpaperPicker() {
        const m = openModal({ title: 'Wallpaper', icon: 'wallpaper', width: 'max-w-3xl', footer: false });
        const body = m.body;
        body.innerHTML =
            '<div class="space-y-5">' +
            '<div><div class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-2">Presets</div>' +
            '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" id="wp-presets"></div></div>' +
            (state.customWallpapers.length ?
                '<div><div class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-2">Your uploads</div>' +
                '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" id="wp-customs"></div></div>' : '') +
            '<div><div class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-2">From URL</div>' +
            '<div class="flex gap-2"><input id="wp-url" placeholder="https://…/image.jpg" class="flex-1 h-10 px-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-sm text-body-sm focus:outline-none focus:border-secondary/70"/>' +
            '<button id="wp-url-go" class="h-10 px-4 rounded-xl bg-primary-container text-on-primary-container font-label-md text-label-md font-semibold">Set</button></div></div>' +
            '<div><div class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-2">Upload from device</div>' +
            '<label class="flex items-center justify-center gap-2 h-20 rounded-xl border-2 border-dashed border-outline-variant/60 hover:border-secondary/70 hover:bg-surface-container-high/40 transition cursor-pointer text-on-surface-variant font-label-md text-label-md">' +
            '<span class="material-symbols-outlined">upload_file</span>' +
            '<span>Choose an image (auto-optimised, stored locally)</span>' +
            '<input id="wp-file" type="file" accept="image/*" class="hidden"/>' +
            '</label></div>' +
            '</div>';

        const grid = body.querySelector('#wp-presets');
        WALLPAPERS.forEach(w => {
            const active = state.wallpaper.type === 'preset' && state.wallpaper.id === w.id;
            const d = document.createElement('button');
            d.className = 'group relative aspect-video rounded-xl overflow-hidden border-2 transition ' + (active ? 'border-secondary' : 'border-transparent hover:border-outline-variant');
            if (w.gradient) d.style.background = w.gradient;
            if (w.url) { d.style.backgroundImage = "url('" + w.url + "')"; d.style.backgroundSize = 'cover'; d.style.backgroundPosition = 'center'; }
            d.innerHTML = '<span class="absolute inset-x-0 bottom-0 px-2 py-1 text-[10px] font-label-sm text-white bg-black/55 backdrop-blur-sm truncate">' + esc(w.name) + '</span>' +
                (active ? '<span class="absolute top-1.5 right-1.5 material-symbols-outlined text-[16px] text-secondary filled">check_circle</span>' : '');
            d.onclick = () => { state.wallpaper = { type: 'preset', id: w.id }; persist(); applyWallpaper(true); m.close(); toast('Wallpaper applied', 'success'); };
            grid.appendChild(d);
        });

        const cg = body.querySelector('#wp-customs');
        if (cg) state.customWallpapers.forEach(c => {
            const active = state.wallpaper.type === 'custom' && state.wallpaper.id === c.id;
            const d = document.createElement('button');
            d.className = 'group relative aspect-video rounded-xl overflow-hidden border-2 transition ' + (active ? 'border-secondary' : 'border-transparent hover:border-outline-variant');
            d.style.backgroundImage = "url('" + c.thumb + "')"; d.style.backgroundSize = 'cover'; d.style.backgroundPosition = 'center';
            d.innerHTML = '<span class="absolute inset-x-0 bottom-0 px-2 py-1 text-[10px] font-label-sm text-white bg-black/55 backdrop-blur-sm truncate">' + esc(c.name) + '</span>' +
                '<span data-del="' + c.id + '" class="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><span class="material-symbols-outlined text-[14px]">delete</span></span>';
            d.onclick = async (e) => {
                if (e.target.closest('[data-del]')) {
                    await idb.del('wallpapers', c.id);
                    state.customWallpapers = state.customWallpapers.filter(x => x.id !== c.id);
                    if (state.wallpaper.type === 'custom' && state.wallpaper.id === c.id) { state.wallpaper = { type: 'preset', id: 'neo-tokyo' }; applyWallpaper(true); }
                    persist(); m.close(); openWallpaperPicker(); toast('Wallpaper removed', 'success');
                    return;
                }
                state.wallpaper = { type: 'custom', id: c.id }; persist(); applyWallpaper(true); m.close(); toast('Wallpaper applied', 'success');
            };
            cg.appendChild(d);
        });

        body.querySelector('#wp-url-go').onclick = () => {
            const u = body.querySelector('#wp-url').value.trim();
            if (!u) return;
            state.wallpaper = { type: 'url', url: u }; persist(); applyWallpaper(true); m.close(); toast('Wallpaper applied', 'success');
        };

        body.querySelector('#wp-file').onchange = async (e) => {
            const f = e.target.files[0]; if (!f) return;
            toast('Optimising image…');
            try {
                const dataUrl = await downscaleImage(f, 1920, 0.78);
                const id = uid();
                await idb.set('wallpapers', id, dataUrl);
                const thumb = await downscaleImage(f, 400, 0.6);
                state.customWallpapers.unshift({ id, name: f.name.replace(/\.[^.]+$/, ''), thumb });
                state.wallpaper = { type: 'custom', id };
                persist(); applyWallpaper(true); m.close(); toast('Wallpaper uploaded', 'success');
            } catch (err) { toast('Could not process image', 'error'); }
        };
    }

    function downscaleImage(file, maxW, quality) {
        return new Promise((res, rej) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                const scale = Math.min(1, maxW / img.width);
                const c = document.createElement('canvas');
                c.width = Math.round(img.width * scale);
                c.height = Math.round(img.height * scale);
                c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                URL.revokeObjectURL(url);
                res(c.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('invalid image')); };
            img.src = url;
        });
    }

    /* ══════════════════════════════════════════════════════════════════════════
       CLOCK
       ══════════════════════════════════════════════════════════════════════════ */
    const clockEls = {};
    let lastDateKey = '';
    function fmtTime(d) {
        if (state.clock24) return { main: pad(d.getHours()) + ':' + pad(d.getMinutes()), ampm: '' };
        let h = d.getHours() % 12; if (h === 0) h = 12;
        return { main: pad(h) + ':' + pad(d.getMinutes()), ampm: d.getHours() < 12 ? 'AM' : 'PM' };
    }
    function tickClock() {
        if (!clockEls.display) {
            clockEls.display = $('#clock-display');
            clockEls.seconds = $('#clock-seconds');
            clockEls.ampm = $('#clock-ampm');
            clockEls.date = $('#date-display');
            clockEls.tz = $('#tz-label');
            clockEls.greet = $('#greeting-text');
        }
        const now = new Date();
        const t = fmtTime(now);
        if (clockEls.display) clockEls.display.textContent = t.main;
        if (clockEls.ampm) clockEls.ampm.textContent = t.ampm;
        if (clockEls.seconds) {
            clockEls.seconds.style.display = state.showSeconds ? '' : 'none';
            if (state.showSeconds) clockEls.seconds.textContent = pad(now.getSeconds());
        }
        const dateKey = now.toDateString();
        if (dateKey !== lastDateKey) {
            lastDateKey = dateKey;
            if (clockEls.date) clockEls.date.textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
            try {
                let tzName = Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop().replace(/_/g, ' ');
                const off = -now.getTimezoneOffset() / 60;
                tzName += ' • UTC' + (off >= 0 ? '+' : '') + off;
                if (clockEls.tz) clockEls.tz.textContent = tzName;
            } catch (e) { }
        }
        if (state.greetingEnabled) {
            const h = now.getHours();
            const g = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
            if (clockEls.greet) clockEls.greet.textContent = g + ', ' + state.user.name;
        } else if (clockEls.greet) clockEls.greet.textContent = '';
    }

    /* ══════════════════════════════════════════════════════════════════════════
       SEARCH
       ══════════════════════════════════════════════════════════════════════════ */
    function renderEngines() {
        const box = $('#engine-tabs');
        const keys = Object.keys(ENGINES);
        box.innerHTML = keys.map(k => {
            const on = k === state.engine;
            return '<button class="engine-tab shrink-0 px-3 py-1 rounded-full font-label-sm text-label-sm transition-all flex items-center gap-1.5 ' +
                (on ? 'text-on-primary-container bg-primary-container shadow-sm' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high') +
                '" data-engine="' + k + '"><span class="material-symbols-outlined text-[14px]">' + ENGINES[k].icon + '</span>' + ENGINES[k].name + '</button>';
        }).join('');
        const ic = $('#omnibox-icon'); if (ic) ic.textContent = ENGINES[state.engine].icon;
    }

    function looksLikeUrl(v) {
        if (/^https?:\/\//i.test(v)) return true;
        if (/^localhost(:\d+)?(\/|$)/i.test(v)) return true;
        if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v) && !/\s/.test(v)) return true;
        return false;
    }

    function executeSearch(raw) {
        const q = (raw || '').trim();
        if (!q) return;
        let engine = state.engine, term = q;
        const m = q.match(/^!([a-z]+)\s+(.*)$/i);
        if (m) {
            const key = m[1].toLowerCase();
            if (BANGS[key]) { engine = BANGS[key]; term = m[2]; }
            else if (ENGINES[key]) { engine = key; term = m[2]; }
        }
        let url;
        if (looksLikeUrl(term)) url = /^https?:\/\//i.test(term) ? term : 'https://' + term;
        else url = ENGINES[engine].url + encodeURIComponent(term);

        if (!/^https?:\/\//i.test(term)) {
            state.history.unshift({ q: term, ts: Date.now() });
            state.history = state.history.slice(0, 60);
            persist();
        }
        hideSuggestions();
        if (state.searchInNewTab) window.open(url, '_blank', 'noopener');
        else location.href = url;
        $('#omnibox').value = '';
    }

    function buildSuggestions(q) {
        const out = [];
        const query = q.trim().toLowerCase();

        if (!query) {
            state.history.slice(0, 5).forEach(h => out.push({ icon: 'history', label: h.q, sub: 'Recent', run: () => executeSearch(h.q) }));
            state.apps.slice(0, 3).forEach(a => out.push({ icon: a.kind === 'symbol' ? a.icon : 'public', label: a.name, sub: 'App', run: () => openApp(a) }));
            return out;
        }

        const bm = query.match(/^!([a-z]*)$/);
        if (bm) {
            Object.keys(BANGS).forEach(b => out.push({ icon: 'bolt', label: '!' + b, sub: 'Search ' + ENGINES[BANGS[b]].name, run: () => executeSearch('!' + b + ' ') }));
            return out.slice(0, 6);
        }

        state.apps.filter(a => a.name.toLowerCase().includes(query) || hostOf(a.url).includes(query)).slice(0, 3)
            .forEach(a => out.push({ icon: a.kind === 'symbol' ? a.icon : 'public', label: a.name, sub: hostOf(a.url) || 'App', run: () => openApp(a) }));

        state.bookmarks.filter(b => b.title.toLowerCase().includes(query) || b.url.toLowerCase().includes(query)).slice(0, 3)
            .forEach(b => out.push({ icon: 'bookmark', label: b.title, sub: hostOf(b.url), run: () => window.open(b.url, '_blank', 'noopener') }));

        state.history.filter(h => h.q.toLowerCase().includes(query)).slice(0, 3)
            .forEach(h => out.push({ icon: 'history', label: h.q, sub: 'Recent', run: () => executeSearch(h.q) }));

        const cmds = [
            { k: 'settings preferences options', icon: 'settings', label: 'Open settings', run: () => openSettings() },
            { k: 'wallpaper background ambience', icon: 'wallpaper', label: 'Change wallpaper', run: () => openWallpaperPicker() },
            { k: 'bookmark save', icon: 'bookmark_add', label: 'Save a bookmark', run: () => openBookmarkEditor(null) },
            { k: 'add app shortcut', icon: 'add', label: 'Add a new app', run: () => openAppEditor(null) },
            { k: 'theme light dark', icon: 'contrast', label: 'Toggle theme', run: () => cycleTheme() }
        ].filter(c => c.k.split(' ').some(w => w.startsWith(query))).slice(0, 3);
        cmds.forEach(c => out.push({ icon: c.icon, label: c.label, sub: 'Action', run: c.run }));

        out.push({ icon: 'search', label: 'Search ' + ENGINES[state.engine].name + ' for “' + q + '”', sub: 'Enter', primary: true, run: () => executeSearch(q) });
        return out.slice(0, 10);
    }

    function showSuggestions(q) {
        const box = $('#suggestions');
        if (q.startsWith('>')) {
            const term = q.slice(1).trim().toLowerCase();
            const items = Palette.registry().filter(a =>
                !a.hidden && (fuzzyMatch(a.title, term) || fuzzyMatch(a.sub || '', term))
            ).slice(0, 8);
            if (!items.length) { hideSuggestions(); return; }
            box.innerHTML = items.map((it, i) =>
                '<div class="sug flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer hover:bg-surface-container-highest/80 transition-colors" data-cmd="' + i + '">' +
                '<span class="material-symbols-outlined text-[18px] text-on-surface-variant">' + it.icon + '</span>' +
                '<span class="flex-1 min-w-0 font-body-md text-body-md text-on-surface truncate">' + esc(it.title) + '</span>' +
                '<span class="font-label-sm text-label-sm text-on-surface-variant shrink-0">' + esc(it.sub || '') + '</span>' +
                '</div>').join('');
            box.classList.remove('hidden');
            box.onmousedown = (e) => {
                const el = e.target.closest('[data-cmd]');
                if (el) { e.preventDefault(); const it = items[+el.dataset.cmd]; $('#omnibox').value = ''; hideSuggestions(); setTimeout(() => it.run(), 40); }
            };
            return;
        }

        const items = buildSuggestions(q);
        if (!items.length) { hideSuggestions(); return; }
        box.innerHTML = items.map((it, i) =>
            '<div class="sug flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer hover:bg-surface-container-highest/80 transition-colors" data-i="' + i + '">' +
            '<span class="material-symbols-outlined text-[18px] ' + (it.primary ? 'text-secondary' : 'text-on-surface-variant') + '">' + it.icon + '</span>' +
            '<span class="flex-1 min-w-0 font-body-md text-body-md text-on-surface truncate">' + esc(it.label) + '</span>' +
            '<span class="font-label-sm text-label-sm text-on-surface-variant shrink-0">' + esc(it.sub || '') + '</span>' +
            '</div>').join('');
        box.classList.remove('hidden');
        box.onmousedown = (e) => {
            const el = e.target.closest('.sug');
            if (el) { e.preventDefault(); const it = items[+el.dataset.i]; if (it) it.run(); }
        };
    }

    function fuzzyMatch(text, query) {
        return !query || String(text).toLowerCase().includes(query);
    }

    function hideSuggestions() { const b = $('#suggestions'); if (b) b.classList.add('hidden'); }

    function openApp(a) {
        a.launches = (a.launches || 0) + 1;
        persist();
        window.open(a.url, '_blank', 'noopener');
    }

    /* ══════════════════════════════════════════════════════════════════════════
       DOCK
       ══════════════════════════════════════════════════════════════════════════ */
    function renderFilters() {
        const box = $('#app-filters');
        box.innerHTML = CATEGORIES.map(c => {
            const on = c.id === state.appFilter;
            const count = c.id === 'all' ? state.apps.length : state.apps.filter(a => a.cat === c.id).length;
            return '<button class="app-filter shrink-0 px-4 py-1.5 rounded-full font-label-md text-label-md transition-all ' +
                (on ? 'text-on-surface bg-surface-container-high shadow-sm' : 'text-on-surface-variant hover:text-on-surface') +
                '" data-cat="' + c.id + '">' + c.label +
                '<span class="ml-1.5 font-mono text-[10px] opacity-60">' + count + '</span></button>';
        }).join('');
    }

    function tileIconHTML(a) {
        if (a.kind === 'favicon') {
            const url = faviconFor(a.url);
            return '<img src="' + url + '" loading="lazy" class="w-8 h-8 rounded" alt="" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'material-symbols-outlined text-[30px]\',textContent:\'public\'}))"/>';
        }
        if (a.kind === 'emoji') return '<span class="text-[28px] leading-none">' + esc(a.icon) + '</span>';
        return '<span class="material-symbols-outlined text-[30px]" style="color:' + (a.color || '#a3c9ff') + '">' + esc(a.icon || 'public') + '</span>';
    }

    function renderDock() {
        const dock = $('#quick-dock');
        const cat = state.appFilter;
        const list = state.apps.filter(a => cat === 'all' || a.cat === cat);
        const tmp = document.createElement('div');
        tmp.innerHTML = list.map(a =>
            '<a class="dock-tile flex flex-col items-center gap-2 group cursor-pointer" draggable="true" data-id="' + a.id + '" href="' + esc(a.url) + '" target="_blank" rel="noopener">' +
            '<div class="w-16 h-16 rounded-2xl bg-surface-container-high/60 backdrop-blur-xl flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-105 group-hover:bg-surface-container-highest border border-white/5">' + tileIconHTML(a) + '</div>' +
            '<span class="font-label-sm text-label-sm text-on-surface-variant group-hover:text-on-surface truncate max-w-[68px]">' + esc(a.name) + '</span>' +
            '</a>').join('') +
            '<button id="add-app-tile" class="flex flex-col items-center gap-2 group focus-ring rounded-2xl">' +
            '<div class="w-16 h-16 rounded-2xl bg-surface-container-high/40 backdrop-blur-xl flex items-center justify-center text-on-surface-variant group-hover:text-on-surface shadow-lg transition-transform duration-300 group-hover:scale-105 group-hover:bg-surface-container-highest border border-dashed border-outline-variant/50"><span class="material-symbols-outlined text-[26px]">add</span></div>' +
            '<span class="font-label-sm text-label-sm text-on-surface-variant group-hover:text-on-surface">Add App</span>' +
            '</button>';
        dock.innerHTML = '';
        while (tmp.firstChild) dock.appendChild(tmp.firstChild);

        $$('.dock-tile', dock).forEach(tile => {
            tile.addEventListener('click', () => { const a = state.apps.find(x => x.id === tile.dataset.id); if (a) { a.launches = (a.launches || 0) + 1; persist(); } });
            tile.addEventListener('contextmenu', e => {
                e.preventDefault();
                const a = state.apps.find(x => x.id === tile.dataset.id);
                if (!a) return;
                showCtxMenu(e.clientX, e.clientY, [
                    { icon: 'open_in_new', label: 'Open', action: () => openApp(a) },
                    { icon: 'content_copy', label: 'Copy URL', action: () => { navigator.clipboard.writeText(a.url); toast('Copied', 'success'); } },
                    { icon: 'bookmark_add', label: 'Save to bookmarks', action: () => saveBookmark({ title: a.name, url: a.url, folder: 'Inbox' }) },
                    { icon: 'edit', label: 'Edit app…', action: () => openAppEditor(a) },
                    '-',
                    { icon: 'delete', label: 'Remove', danger: true, action: () => { state.apps = state.apps.filter(x => x.id !== a.id); persist(); renderDock(); renderFilters(); toast('Removed ' + a.name, 'success'); } }
                ]);
            });
        });

        const addTile = $('#add-app-tile');
        if (addTile) addTile.addEventListener('click', () => openAppEditor(null));

        let dragId = null;
        $$('.dock-tile', dock).forEach(tile => {
            tile.addEventListener('dragstart', e => { dragId = tile.dataset.id; tile.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (x) { } });
            tile.addEventListener('dragend', () => { tile.classList.remove('dragging'); $$('.dock-tile').forEach(t => t.classList.remove('drop-target')); });
            tile.addEventListener('dragover', e => { e.preventDefault(); tile.classList.add('drop-target'); });
            tile.addEventListener('dragleave', () => tile.classList.remove('drop-target'));
            tile.addEventListener('drop', e => {
                e.preventDefault(); tile.classList.remove('drop-target');
                const targetId = tile.dataset.id;
                if (!dragId || dragId === targetId) return;
                const from = state.apps.findIndex(a => a.id === dragId);
                const to = state.apps.findIndex(a => a.id === targetId);
                if (from < 0 || to < 0) return;
                const [moved] = state.apps.splice(from, 1);
                state.apps.splice(to, 0, moved);
                persist(); renderDock();
            });
        });
    }

    /* ── App editor ── */
    const ICON_CHOICES = ['public', 'terminal', 'code', 'bug_report', 'cloud', 'storage', 'draw', 'palette', 'menu_book', 'tag', 'smart_display', 'graphic_eq', 'photo_camera', 'movie', 'mail', 'chat', 'forum', 'group', 'shopping_cart', 'payments', 'fitness_center', 'restaurant', 'flight', 'map', 'school', 'science', 'bolt', 'rocket_launch', 'insights', 'analytics', 'dashboard', 'folder', 'description', 'event', 'task_alt', 'check_circle', 'extension', 'widgets', 'videogame_asset', 'sports_esports'];
    const COLOR_CHOICES = ['#a3c9ff', '#90dbff', '#00c4fc', '#dab9ff', '#8f60c6', '#ffb4ab', '#6bd3ff', '#d3e3ff', '#efdbff', '#ffffff', '#ffd28a', '#8ef0b8'];

    function openAppEditor(app) {
        const isNew = !app;
        const draft = app ? Object.assign({}, app) : { id: uid(), name: '', url: '', icon: 'public', kind: 'symbol', cat: 'other', color: '#a3c9ff', launches: 0 };
        const m = openModal({
            title: isNew ? 'Add app' : 'Edit app', icon: isNew ? 'add' : 'edit', width: 'max-w-xl',
            onOk: () => {
                const name = m.panel.querySelector('#f-name').value.trim();
                let url = m.panel.querySelector('#f-url').value.trim();
                if (!name) { toast('Name is required', 'warn'); return false; }
                if (!url) { toast('URL is required', 'warn'); return false; }
                url = normaliseUrl(url);
                if (!isValidUrl(url)) { toast('Invalid URL', 'warn'); return false; }
                draft.name = name; draft.url = url;
                draft.cat = m.panel.querySelector('#f-cat').value;
                draft.kind = m.panel.querySelector('[name=iconkind]:checked').value;
                if (draft.kind === 'symbol') { draft.icon = m.panel.querySelector('#f-icon').value; draft.color = m.panel.querySelector('#f-color').value; }
                else if (draft.kind === 'emoji') { draft.icon = m.panel.querySelector('#f-emoji').value || '🌐'; }
                if (isNew) state.apps.push(draft); else Object.assign(app, draft);
                persist(); renderDock(); renderFilters(); renderLibrary();
                toast(isNew ? 'App added' : 'App updated', 'success');
            }
        });
        m.body.innerHTML =
            '<div class="space-y-4">' +
            '<div class="flex items-center gap-4">' +
            '<div id="f-preview" class="w-16 h-16 rounded-2xl bg-surface-container-high/70 border border-white/10 flex items-center justify-center shrink-0"></div>' +
            '<div class="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">' +
            '<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Name</span>' +
            '<input id="f-name" value="' + esc(draft.name) + '" placeholder="GitHub" class="mt-1 w-full h-10 px-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:border-secondary/70"/></label>' +
            '<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Category</span>' +
            '<select id="f-cat" class="mt-1 w-full h-10 px-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:border-secondary/70">' +
            CATEGORIES.filter(c => c.id !== 'all').map(c => '<option value="' + c.id + '"' + (draft.cat === c.id ? ' selected' : '') + '>' + c.label + '</option>').join('') + '</select></label>' +
            '</div>' +
            '</div>' +
            '<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">URL</span>' +
            '<input id="f-url" value="' + esc(draft.url) + '" placeholder="https://github.com" class="mt-1 w-full h-10 px-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:border-secondary/70"/></label>' +
            '<div><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Icon style</span>' +
            '<div class="mt-2 flex flex-wrap gap-2">' +
            ['symbol:Material symbol', 'favicon:Site favicon', 'emoji:Emoji'].map(s => {
                const parts = s.split(':');
                const v = parts[0], l = parts[1];
                return '<label class="cursor-pointer"><input type="radio" name="iconkind" value="' + v + '" class="peer sr-only"' + (draft.kind === v ? ' checked' : '') + '/>' +
                    '<span class="inline-block px-3 py-1.5 rounded-full border border-outline-variant/50 font-label-md text-label-md text-on-surface-variant peer-checked:bg-primary-container peer-checked:text-on-primary-container peer-checked:border-transparent transition">' + l + '</span></label>';
            }).join('') + '</div></div>' +
            '<div id="f-symbol-block"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Symbol</span>' +
            '<div class="mt-2 grid grid-cols-8 sm:grid-cols-10 gap-1.5 max-h-40 overflow-y-auto p-2 rounded-xl bg-surface-container-high/40 border border-outline-variant/30" id="f-icons"></div>' +
            '<input id="f-icon" value="' + esc(draft.icon) + '" class="mt-2 w-full h-9 px-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-mono text-[12px] focus:outline-none focus:border-secondary/70"/>' +
            '<div class="mt-3"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Accent</span>' +
            '<div class="mt-2 flex flex-wrap gap-2" id="f-colors"></div></div></div>' +
            '<div id="f-emoji-block" class="hidden"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Emoji</span>' +
            '<input id="f-emoji" value="' + esc(draft.kind === 'emoji' ? draft.icon : '🌐') + '" maxlength="4" class="mt-1 w-24 h-10 px-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface text-center text-xl focus:outline-none focus:border-secondary/70"/></div>' +
            '</div>';

        const iconsBox = m.panel.querySelector('#f-icons');
        iconsBox.innerHTML = ICON_CHOICES.map(ic => '<button type="button" data-ic="' + ic + '" class="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition"><span class="material-symbols-outlined text-[18px]">' + ic + '</span></button>').join('');
        iconsBox.addEventListener('click', e => {
            const b = e.target.closest('[data-ic]'); if (!b) return;
            m.panel.querySelector('#f-icon').value = b.dataset.ic; updatePreview();
        });

        const colorsBox = m.panel.querySelector('#f-colors');
        colorsBox.innerHTML = COLOR_CHOICES.map(c => '<button type="button" data-c="' + c + '" class="w-7 h-7 rounded-full border-2 border-white/20 hover:scale-110 transition" style="background:' + c + '"></button>').join('');
        colorsBox.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; m.panel.querySelector('#f-color').value = b.dataset.c; updatePreview(); });
        const colorInput = document.createElement('input'); colorInput.type = 'hidden'; colorInput.id = 'f-color'; colorInput.value = draft.color || '#a3c9ff';
        colorsBox.appendChild(colorInput);

        function currentKind() { return m.panel.querySelector('[name=iconkind]:checked').value; }
        function updatePreview() {
            const k = currentKind();
            m.panel.querySelector('#f-symbol-block').classList.toggle('hidden', k !== 'symbol');
            m.panel.querySelector('#f-emoji-block').classList.toggle('hidden', k !== 'emoji');
            const prev = m.panel.querySelector('#f-preview');
            const tmp = {
                kind: k,
                icon: k === 'emoji' ? m.panel.querySelector('#f-emoji').value : m.panel.querySelector('#f-icon').value,
                color: m.panel.querySelector('#f-color').value,
                url: m.panel.querySelector('#f-url').value || 'https://example.com'
            };
            prev.innerHTML = tileIconHTML(tmp);
        }
        m.panel.addEventListener('input', updatePreview);
        m.panel.addEventListener('change', updatePreview);
        updatePreview();
    }

    /* ══════════════════════════════════════════════════════════════════════════
       BOOKMARKS
       ══════════════════════════════════════════════════════════════════════════ */
    function saveBookmark(data) {
        const item = {
            id: uid(),
            title: (data.title || hostOf(data.url) || 'Untitled').slice(0, 200),
            url: normaliseUrl(data.url),
            folder: data.folder || 'Inbox',
            tags: data.tags || [],
            note: data.note || '',
            added: Date.now(),
            visits: 0,
            pinned: false
        };
        if (!item.url || !isValidUrl(item.url)) { toast('Invalid URL', 'warn'); return false; }
        state.bookmarks.unshift(item);
        persist();
        renderBookmarks();
        toast('Bookmark saved', 'success');
        return item;
    }

    function openBookmarkEditor(bm) {
        const isNew = !bm;
        const folders = state.bmFolders.slice();
        const draft = bm ? Object.assign({}, bm) : { id: uid(), title: '', url: '', folder: folders[0] || 'Inbox', tags: [], note: '', visits: 0, pinned: false };

        const m = openModal({
            title: isNew ? 'New bookmark' : 'Edit bookmark', icon: isNew ? 'bookmark_add' : 'edit', width: 'max-w-lg',
            onOk: () => {
                const url = normaliseUrl(m.panel.querySelector('#bm-url').value);
                const title = m.panel.querySelector('#bm-title').value.trim() || hostOf(url);
                if (!url || !isValidUrl(url)) { toast('Valid URL required', 'warn'); return false; }
                draft.url = url; draft.title = title.slice(0, 200);
                draft.folder = m.panel.querySelector('#bm-folder').value || 'Inbox';
                draft.note = m.panel.querySelector('#bm-note').value;
                const tagsRaw = m.panel.querySelector('#bm-tags').value;
                draft.tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean).slice(0, 8);
                if (isNew) state.bookmarks.unshift(draft); else Object.assign(bm, draft);
                persist(); renderBookmarks(); renderFolderChips();
                toast(isNew ? 'Bookmark added' : 'Bookmark updated', 'success');
            }
        });

        m.body.innerHTML =
            '<div class="space-y-4">' +
            '<div id="bm-preview" class="flex items-center gap-3 p-3 rounded-xl bg-surface-container-high/40">' +
            '<div class="bm-fav" id="bm-preview-fav">•</div>' +
            '<div class="min-w-0"><div class="font-label-md text-label-md text-on-surface truncate" id="bm-preview-title">Preview</div>' +
            '<div class="font-body-sm text-body-sm text-on-surface-variant truncate" id="bm-preview-host">—</div></div>' +
            '</div>' +
            '<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">URL</span>' +
            '<input id="bm-url" value="' + esc(draft.url) + '" placeholder="https://example.com" class="mt-1 w-full h-10 px-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:border-secondary/70"/></label>' +
            '<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Title</span>' +
            '<input id="bm-title" value="' + esc(draft.title) + '" placeholder="Auto-filled from URL" class="mt-1 w-full h-10 px-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:border-secondary/70"/></label>' +
            '<div class="grid grid-cols-2 gap-3">' +
            '<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Folder</span>' +
            '<select id="bm-folder" class="mt-1 w-full h-10 px-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:border-secondary/70">' +
            folders.map(f => '<option value="' + esc(f) + '"' + (draft.folder === f ? ' selected' : '') + '>' + esc(f) + '</option>').join('') +
            '</select></label>' +
            '<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Tags (comma separated)</span>' +
            '<input id="bm-tags" value="' + esc((draft.tags || []).join(', ')) + '" placeholder="design, ui" class="mt-1 w-full h-10 px-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:border-secondary/70"/></label>' +
            '</div>' +
            '<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Note</span>' +
            '<textarea id="bm-note" rows="2" placeholder="Optional note…" class="mt-1 w-full px-3 py-2 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:border-secondary/70 resize-none">' + esc(draft.note) + '</textarea></label>' +
            '<div class="flex items-center justify-between p-3 rounded-xl bg-surface-container-high/40">' +
            '<span class="font-label-md text-label-md text-on-surface">Pin to top</span>' +
            '<div class="switch ' + (draft.pinned ? 'on' : '') + '" id="bm-pinned"></div>' +
            '</div>' +
            '</div>';

        const updatePrev = () => {
            const u = normaliseUrl(m.panel.querySelector('#bm-url').value);
            const t = m.panel.querySelector('#bm-title').value.trim() || hostOf(u) || 'Preview';
            const host = hostOf(u) || '—';
            m.panel.querySelector('#bm-preview-title').textContent = t;
            m.panel.querySelector('#bm-preview-host').textContent = host;
            const fav = m.panel.querySelector('#bm-preview-fav');
            if (u && isValidUrl(u)) {
                fav.innerHTML = '<img src="' + faviconFor(u) + '" alt="" onerror="this.replaceWith(document.createTextNode(\'' + esc((t[0] || '•').toUpperCase()) + '\'))"/>';
            } else {
                fav.textContent = (t[0] || '•').toUpperCase();
            }
        };
        m.panel.querySelector('#bm-url').addEventListener('input', debounce(updatePrev, 200));
        m.panel.querySelector('#bm-title').addEventListener('input', debounce(updatePrev, 120));
        const pin = m.panel.querySelector('#bm-pinned');
        pin.onclick = () => { draft.pinned = !draft.pinned; pin.classList.toggle('on', draft.pinned); };
        updatePrev();
    }

    function bookmarkOpen(bm) {
        bm.visits = (bm.visits || 0) + 1;
        persist();
        window.open(bm.url, '_blank', 'noopener');
    }

    function renderFolderChips() {
        const box = $('#bm-folders');
        if (!box) return;
        const counts = {};
        state.bookmarks.forEach(b => { counts[b.folder] = (counts[b.folder] || 0) + 1; });
        const all = state.bookmarks.length;
        const pinned = state.bookmarks.filter(b => b.pinned).length;
        const items = [
            { id: 'all', label: 'All', icon: 'apps', count: all },
            ...(pinned ? [{ id: '__pinned', label: 'Pinned', icon: 'push_pin', count: pinned }] : []),
            ...state.bmFolders.map(f => ({ id: f, label: f, icon: 'folder', count: counts[f] || 0 }))
        ];
        box.innerHTML = items.map(it =>
            '<button class="bm-folder-chip ' + (state.bmFilter === it.id ? 'active' : '') + '" data-f="' + esc(it.id) + '">' +
            '<span class="material-symbols-outlined">' + it.icon + '</span>' + esc(it.label) +
            '<span class="count">' + it.count + '</span></button>'
        ).join('') +
            '<button id="bm-add-folder" class="bm-folder-chip"><span class="material-symbols-outlined">create_new_folder</span>New folder</button>';
    }

    function getFilteredBookmarks() {
        const q = state.bmQuery.toLowerCase().trim();
        let items = state.bookmarks.slice();
        if (state.bmFilter === '__pinned') items = items.filter(b => b.pinned);
        else if (state.bmFilter !== 'all') items = items.filter(b => b.folder === state.bmFilter);
        if (q) items = items.filter(b =>
            b.title.toLowerCase().includes(q) ||
            b.url.toLowerCase().includes(q) ||
            hostOf(b.url).includes(q) ||
            (b.tags || []).some(t => t.toLowerCase().includes(q))
        );
        const s = state.bmSort;
        if (s === 'name') items.sort((a, b) => a.title.localeCompare(b.title));
        else if (s === 'visits') items.sort((a, b) => (b.visits || 0) - (a.visits || 0));
        else if (s === 'added') items.sort((a, b) => (b.added || 0) - (a.added || 0));
        else if (s === 'manual') { /* insertion order */ }
        else items.sort((a, b) => (b.added || 0) - (a.added || 0));
        if (s !== 'manual') items.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
        return items;
    }

    function renderBookmarks() {
        const box = $('#bm-content');
        if (!box) return;
        const items = getFilteredBookmarks();
        const total = $('#bm-total'); if (total) total.textContent = state.bookmarks.length;

        if (!state.bookmarks.length) {
            box.innerHTML =
                '<div class="bm-empty acrylic rim rounded-2xl">' +
                '<span class="material-symbols-outlined text-outline text-[48px]">bookmark_border</span>' +
                '<h3 class="font-headline-sm text-headline-sm text-on-surface">No bookmarks yet</h3>' +
                '<p class="font-body-sm text-body-sm max-w-md">Save pages you want to revisit. Everything is stored on this device — nothing is uploaded. Import from your browser to get started instantly.</p>' +
                '<div class="flex flex-wrap items-center gap-2 mt-2">' +
                '<button id="bm-empty-add" class="h-9 px-4 rounded-full bg-primary-container text-on-primary-container font-label-md text-label-md font-semibold shadow hover:brightness-110 transition flex items-center gap-1.5">' +
                '<span class="material-symbols-outlined text-[18px]">add</span>Add bookmark</button>' +
                '<button id="bm-empty-import" class="h-9 px-4 rounded-full bg-surface-container-high/70 text-on-surface font-label-md text-label-md hover:bg-surface-container-highest transition flex items-center gap-1.5">' +
                '<span class="material-symbols-outlined text-[18px]">upload</span>Import bookmarks</button>' +
                '</div>' +
                '</div>';
            $('#bm-empty-add').onclick = () => openBookmarkEditor(null);
            $('#bm-empty-import').onclick = openImportDialog;
            return;
        }

        if (!items.length) {
            box.innerHTML = '<div class="bm-empty"><span class="material-symbols-outlined text-outline text-[40px]">search_off</span>' +
                '<p class="font-body-sm text-body-sm">No bookmarks match your filters.</p></div>';
            return;
        }

        if (state.bmView === 'grid') {
            box.innerHTML = '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3" id="bm-grid">' +
                items.map(b => bmCardHTML(b)).join('') + '</div>';
        } else {
            box.innerHTML = '<div class="rounded-2xl acrylic rim overflow-hidden" id="bm-list">' +
                items.map(b => bmRowHTML(b)).join('') + '</div>';
        }

        bindBookmarkEvents();
    }

    function bmCardHTML(b) {
        const host = hostOf(b.url);
        const initial = (b.title[0] || host[0] || '•').toUpperCase();
        return '<div class="bm-card group" data-id="' + b.id + '" draggable="' + (state.bmSort === 'manual' ? 'true' : 'false') + '">' +
            (b.pinned ? '<span class="material-symbols-outlined absolute top-2 right-2 text-[14px] text-secondary filled">push_pin</span>' : '') +
            '<div class="flex items-start gap-3 min-w-0">' +
            '<div class="bm-fav">' + faviconImg(b.url, 'w-6 h-6') + '</div>' +
            '<div class="min-w-0 flex-1">' +
            '<div class="bm-title">' + esc(b.title) + '</div>' +
            '<div class="bm-host truncate">' + esc(host) + (b.folder && b.folder !== 'Inbox' ? ' · ' + esc(b.folder) : '') + '</div>' +
            '</div>' +
            '</div>' +
            (b.tags && b.tags.length ?
                '<div class="flex flex-wrap gap-1 mt-auto">' +
                b.tags.slice(0, 3).map(t => '<span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-container-highest/70 text-on-surface-variant">#' + esc(t) + '</span>').join('') +
                '</div>' : '') +
            '<div class="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/40 to-transparent rounded-b-[14px]">' +
            '<button data-act="edit" class="w-7 h-7 rounded-full flex items-center justify-center text-white/90 hover:text-white hover:bg-white/15 transition" title="Edit"><span class="material-symbols-outlined text-[14px]">edit</span></button>' +
            '<button data-act="delete" class="w-7 h-7 rounded-full flex items-center justify-center text-white/90 hover:text-red-400 hover:bg-white/15 transition" title="Delete"><span class="material-symbols-outlined text-[14px]">delete</span></button>' +
            '</div>' +
            '</div>';
    }

    function bmRowHTML(b) {
        const host = hostOf(b.url);
        return '<div class="bm-row group" data-id="' + b.id + '" draggable="' + (state.bmSort === 'manual' ? 'true' : 'false') + '">' +
            '<div class="bm-fav">' + faviconImg(b.url, 'w-6 h-6') + '</div>' +
            '<div class="min-w-0">' +
            '<div class="font-label-md text-label-md text-on-surface truncate">' + esc(b.title) + (b.pinned ? ' <span class="material-symbols-outlined text-[12px] text-secondary filled align-middle">push_pin</span>' : '') + '</div>' +
            '<div class="font-body-sm text-body-sm text-on-surface-variant truncate">' + esc(host + pathOf(b.url)) + '</div>' +
            '</div>' +
            '<div class="hidden md:block font-label-sm text-label-sm text-on-surface-variant">' + esc(b.folder || 'Inbox') + '</div>' +
            '<div class="hidden md:block font-mono text-[11px] text-on-surface-variant w-16 text-right">' + (b.visits || 0) + ' opens</div>' +
            '<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">' +
            '<button data-act="open" class="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition" title="Open"><span class="material-symbols-outlined text-[16px]">open_in_new</span></button>' +
            '<button data-act="edit" class="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition" title="Edit"><span class="material-symbols-outlined text-[16px]">edit</span></button>' +
            '<button data-act="delete" class="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:text-red-400 hover:bg-surface-container-highest transition" title="Delete"><span class="material-symbols-outlined text-[16px]">delete</span></button>' +
            '</div>' +
            '</div>';
    }

    let bmDragId = null;
    function bindBookmarkEvents() {
        const box = $('#bm-content');
        box.querySelectorAll('[data-id]').forEach(el => {
            const b = state.bookmarks.find(x => x.id === el.dataset.id);
            if (!b) return;

            el.addEventListener('click', (e) => {
                if (e.target.closest('[data-act]')) return;
                bookmarkOpen(b);
            });
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showCtxMenu(e.clientX, e.clientY, [
                    { icon: 'open_in_new', label: 'Open', action: () => bookmarkOpen(b) },
                    { icon: 'content_copy', label: 'Copy URL', action: () => { navigator.clipboard.writeText(b.url); toast('Copied', 'success'); } },
                    { icon: 'push_pin', label: b.pinned ? 'Unpin' : 'Pin to top', action: () => { b.pinned = !b.pinned; persist(); renderBookmarks(); } },
                    { icon: 'edit', label: 'Edit…', action: () => openBookmarkEditor(b) },
                    { icon: 'drive_file_move', label: 'Move to folder…', action: () => openMoveFolderDialog(b) },
                    '-',
                    { icon: 'delete', label: 'Delete', danger: true, action: () => { state.bookmarks = state.bookmarks.filter(x => x.id !== b.id); persist(); renderBookmarks(); renderFolderChips(); toast('Bookmark removed', 'success'); } }
                ]);
            });
            el.querySelectorAll('[data-act]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const act = btn.dataset.act;
                    if (act === 'open') bookmarkOpen(b);
                    else if (act === 'edit') openBookmarkEditor(b);
                    else if (act === 'delete') { state.bookmarks = state.bookmarks.filter(x => x.id !== b.id); persist(); renderBookmarks(); renderFolderChips(); toast('Bookmark removed', 'success'); }
                });
            });

            if (state.bmSort === 'manual') {
                el.addEventListener('dragstart', () => { bmDragId = b.id; el.classList.add('dragging'); });
                el.addEventListener('dragend', () => { el.classList.remove('dragging'); box.querySelectorAll('.drop-target').forEach(x => x.classList.remove('drop-target')); });
                el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drop-target'); });
                el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
                el.addEventListener('drop', e => {
                    e.preventDefault(); el.classList.remove('drop-target');
                    if (!bmDragId || bmDragId === b.id) return;
                    const from = state.bookmarks.findIndex(x => x.id === bmDragId);
                    const to = state.bookmarks.findIndex(x => x.id === b.id);
                    if (from < 0 || to < 0) return;
                    const [m] = state.bookmarks.splice(from, 1);
                    state.bookmarks.splice(to, 0, m);
                    persist(); renderBookmarks();
                });
            }
        });
    }

    function openMoveFolderDialog(bm) {
        const m = openModal({
            title: 'Move to folder', icon: 'drive_file_move', width: 'max-w-sm',
            onOk: () => {
                const v = m.panel.querySelector('#mv-sel').value;
                bm.folder = v; persist(); renderBookmarks(); renderFolderChips();
                toast('Moved to ' + v, 'success');
            }
        });
        m.body.innerHTML =
            '<div class="space-y-3">' +
            '<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Folder</span>' +
            '<select id="mv-sel" class="mt-1 w-full h-10 px-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-md text-body-md">' +
            state.bmFolders.map(f => '<option value="' + esc(f) + '"' + (bm.folder === f ? ' selected' : '') + '>' + esc(f) + '</option>').join('') +
            '</select></label>' +
            '<div class="flex items-center gap-2"><input id="mv-new" placeholder="Or type a new folder…" class="flex-1 h-9 px-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-sm text-body-sm"/>' +
            '<button id="mv-add" class="h-9 px-3 rounded-xl bg-primary-container text-on-primary-container font-label-md text-label-md font-semibold">Add</button></div>' +
            '</div>';
        m.panel.querySelector('#mv-add').onclick = () => {
            const v = m.panel.querySelector('#mv-new').value.trim();
            if (!v) return;
            if (!state.bmFolders.includes(v)) state.bmFolders.push(v);
            m.panel.querySelector('#mv-sel').value = v;
        };
    }

    function openImportDialog() {
        const m = openModal({ title: 'Import bookmarks', icon: 'upload', width: 'max-w-2xl', footer: false });
        m.body.innerHTML =
            '<div class="space-y-4">' +
            '<div class="flex flex-wrap gap-2">' +
            '<button data-tab="text" class="imp-tab px-3 py-1.5 rounded-full font-label-md text-label-md bg-primary-container text-on-primary-container">Paste URLs</button>' +
            '<button data-tab="html" class="imp-tab px-3 py-1.5 rounded-full font-label-md text-label-md bg-surface-container-high/60 text-on-surface-variant hover:text-on-surface">Browser HTML</button>' +
            '</div>' +
            '<div id="imp-body"></div>' +
            '</div>';

        const draw = (tab) => {
            m.body.querySelectorAll('.imp-tab').forEach(b => b.className = 'imp-tab px-3 py-1.5 rounded-full font-label-md text-label-md ' + (b.dataset.tab === tab ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high/60 text-on-surface-variant hover:text-on-surface'));
            const body = m.body.querySelector('#imp-body');
            if (tab === 'text') {
                body.innerHTML =
                    '<div class="space-y-3">' +
                    '<p class="font-body-sm text-body-sm text-on-surface-variant">Paste one URL per line, or use the format <span class="font-mono text-[11px] text-on-surface bg-surface-container-high/60 px-1.5 py-0.5 rounded">Title | https://example.com</span></p>' +
                    '<textarea id="imp-text" rows="10" placeholder="Design Systems Repo | https://designsystems.com&#10;https://news.ycombinator.com&#10;MDN Web Docs | https://developer.mozilla.org" class="w-full px-3 py-2 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-mono text-[12px] focus:outline-none focus:border-secondary/70 resize-none"></textarea>' +
                    '<div class="flex items-center justify-between gap-3">' +
                    '<label class="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant"><span>Folder</span>' +
                    '<input id="imp-folder" value="Inbox" class="h-9 px-3 rounded-lg bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-sm text-body-sm w-40"/></label>' +
                    '<div class="flex items-center gap-2">' +
                    '<button data-close class="h-9 px-4 rounded-full bg-surface-container-high/70 text-on-surface font-label-md text-label-md">Cancel</button>' +
                    '<button id="imp-go" class="h-9 px-5 rounded-full bg-primary-container text-on-primary-container font-label-md text-label-md font-semibold">Import</button>' +
                    '</div>' +
                    '</div>' +
                    '</div>';
                body.querySelector('#imp-go').onclick = () => {
                    const raw = body.querySelector('#imp-text').value;
                    const folder = body.querySelector('#imp-folder').value.trim() || 'Inbox';
                    const added = importFromText(raw, folder);
                    if (added === 0) toast('No valid URLs found', 'warn');
                    else { toast('Imported ' + added + ' bookmark' + (added === 1 ? '' : 's'), 'success'); m.close(); }
                };
            } else {
                body.innerHTML =
                    '<div class="space-y-3">' +
                    '<p class="font-body-sm text-body-sm text-on-surface-variant">Upload a bookmarks HTML file exported from Chrome, Firefox, Safari, or Edge (Bookmarks → Export).</p>' +
                    '<label class="flex flex-col items-center justify-center gap-2 py-10 rounded-xl border-2 border-dashed border-outline-variant/60 hover:border-secondary/70 hover:bg-surface-container-high/40 transition cursor-pointer text-on-surface-variant font-label-md text-label-md">' +
                    '<span class="material-symbols-outlined text-[32px]">upload_file</span>' +
                    'Click to select a .html file' +
                    '<input id="imp-html" type="file" accept=".html,.htm,text/html" class="hidden"/>' +
                    '</label>' +
                    '<div class="flex items-center justify-between gap-3">' +
                    '<label class="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant"><span>Folder</span>' +
                    '<input id="imp-folder2" value="Imported" class="h-9 px-3 rounded-lg bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-sm text-body-sm w-40"/></label>' +
                    '<button data-close class="h-9 px-4 rounded-full bg-surface-container-high/70 text-on-surface font-label-md text-label-md">Close</button>' +
                    '</div>' +
                    '</div>';
                body.querySelector('#imp-html').onchange = (e) => {
                    const f = e.target.files[0]; if (!f) return;
                    const folder = body.querySelector('#imp-folder2').value.trim() || 'Imported';
                    const r = new FileReader();
                    r.onload = () => {
                        const added = importFromHTML(r.result, folder);
                        toast('Imported ' + added + ' bookmark' + (added === 1 ? '' : 's'), 'success');
                        m.close();
                    };
                    r.readAsText(f);
                };
            }
        };
        m.body.querySelectorAll('.imp-tab').forEach(b => b.onclick = () => draw(b.dataset.tab));
        draw('text');
    }

    function importFromText(raw, folder) {
        let count = 0;
        raw.split(/\r?\n/).forEach(line => {
            line = line.trim();
            if (!line) return;
            let title = '', url = '';
            const sep = line.indexOf('|');
            if (sep > -1) { title = line.slice(0, sep).trim(); url = line.slice(sep + 1).trim(); }
            else url = line;
            if (!looksLikeUrl(url)) return;
            url = normaliseUrl(url);
            if (!isValidUrl(url)) return;
            state.bookmarks.unshift({
                id: uid(), title: title || hostOf(url), url, folder,
                tags: [], note: '', added: Date.now(), visits: 0, pinned: false
            });
            count++;
        });
        if (count) {
            if (folder && !state.bmFolders.includes(folder)) state.bmFolders.push(folder);
            persist(); renderBookmarks(); renderFolderChips();
        }
        return count;
    }

    function importFromHTML(html, folder) {
        let count = 0;
        try {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            doc.querySelectorAll('a[href]').forEach(a => {
                const url = normaliseUrl(a.getAttribute('href'));
                if (!isValidUrl(url)) return;
                const title = (a.textContent || '').trim() || hostOf(url);
                state.bookmarks.unshift({
                    id: uid(), title, url, folder,
                    tags: [], note: '', added: Date.now() - count, visits: 0, pinned: false
                });
                count++;
            });
        } catch (e) { /* noop */ }
        if (count) {
            if (folder && !state.bmFolders.includes(folder)) state.bmFolders.push(folder);
            persist(); renderBookmarks(); renderFolderChips();
        }
        return count;
    }

    function exportBookmarks(kind) {
        if (!state.bookmarks.length) { toast('No bookmarks to export', 'warn'); return; }
        if (kind === 'html') {
            const lines = ['<!DOCTYPE NETSCAPE-Bookmark-file-1>', '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">', '<TITLE>Bookmarks</TITLE>', '<H1>Bookmarks</H1>', '<DL><p>'];
            state.bookmarks.forEach(b => { lines.push('    <DT><A HREF="' + esc(b.url) + '" ADD_DATE="' + Math.floor(b.added / 1000) + '">' + esc(b.title) + '</A>'); });
            lines.push('</DL><p>');
            download('bookmarks-' + new Date().toISOString().slice(0, 10) + '.html', lines.join('\n'), 'text/html');
        } else {
            const data = state.bookmarks.map(b => ({ title: b.title, url: b.url, folder: b.folder, tags: b.tags, note: b.note, added: b.added }));
            download('bookmarks-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(data, null, 2), 'application/json');
        }
        toast('Bookmarks exported', 'success');
    }

    function download(name, content, type) {
        const blob = new Blob([content], { type });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    function openAddFolderDialog() {
        const m = openModal({
            title: 'New folder', icon: 'create_new_folder', width: 'max-w-sm',
            onOk: () => {
                const v = m.panel.querySelector('#nf').value.trim();
                if (!v) return false;
                if (!state.bmFolders.includes(v)) state.bmFolders.push(v);
                persist(); renderFolderChips();
                toast('Folder created', 'success');
            }
        });
        m.body.innerHTML = '<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Name</span>' +
            '<input id="nf" placeholder="e.g. Recipes" class="mt-1 w-full h-10 px-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:border-secondary/70"/></label>';
    }

    /* ══════════════════════════════════════════════════════════════════════════
       WIDGET RENDERING
       ══════════════════════════════════════════════════════════════════════════ */
    function widgetColClass(col) { return col === 4 ? 'md:col-span-6 lg:col-span-4' : 'md:col-span-6 lg:col-span-3'; }

    const WIDGET_RENDER = {
        weather() {
            return '<div class="h-full flex flex-col justify-between p-space-md rounded-2xl acrylic rim overflow-hidden" id="weather-card">' +
                '<div>' +
                '<div class="flex items-center justify-between gap-2 mb-3 min-w-0">' +
                '<button class="flex items-center gap-2 min-w-0 flex-1 text-on-surface-variant hover:text-on-surface transition-colors focus-ring rounded-full" id="weather-city-btn">' +
                '<span class="material-symbols-outlined text-[18px] shrink-0">location_on</span>' +
                '<span class="font-label-md text-label-md truncate" id="w-city">Locating…</span>' +
                '</button>' +
                '<span class="font-label-sm text-label-sm text-secondary bg-surface-container-highest/60 px-2 py-0.5 rounded-full shrink-0 truncate max-w-[110px]" id="w-cond">—</span>' +
                '</div>' +
                '<div class="flex items-center justify-between mb-4">' +
                '<div>' +
                '<div class="font-headline-lg text-headline-lg text-on-surface font-semibold tracking-tight" id="w-temp">—°</div>' +
                '<div class="font-body-sm text-body-sm text-on-surface-variant" id="w-feels">—</div>' +
                '</div>' +
                '<span class="text-[44px] leading-none select-none" id="w-icon">☁️</span>' +
                '</div>' +
                '</div>' +
                '<div class="grid grid-cols-3 gap-2 pt-3 bg-surface-container-low/50 -mx-space-md -mb-space-md px-space-md py-2.5 rounded-b-2xl" id="w-hourly"></div>' +
                '</div>';
        },
        player() {
            const t = state.tracks[state.player.index] || state.tracks[0] || { title: '—', artist: '—', album: '—', c1: '#0078d4', c2: '#00c4fc' };
            return '<div class="h-full flex flex-col justify-between p-space-md rounded-2xl acrylic rim" id="player-card">' +
                '<div class="flex items-center justify-between mb-3">' +
                '<div class="flex items-center gap-2"><span class="material-symbols-outlined text-secondary text-[18px]">graphic_eq</span>' +
                '<span class="font-label-md text-label-md text-on-surface font-medium">Now Playing</span></div>' +
                '<button id="player-list-btn" class="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-colors focus-ring rounded-full">Playlist</button>' +
                '</div>' +
                '<div class="flex items-center gap-3 my-2">' +
                '<div class="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center shadow-md" style="background:linear-gradient(135deg,' + t.c1 + ',' + t.c2 + ')">' +
                '<span class="material-symbols-outlined text-white/90 text-[28px]" id="p-art">album</span></div>' +
                '<div class="min-w-0 flex-1">' +
                '<div class="font-label-lg text-label-lg text-on-surface font-semibold truncate" id="p-title">' + esc(t.title) + '</div>' +
                '<div class="font-body-sm text-body-sm text-on-surface-variant truncate" id="p-sub">' + esc(t.artist + ' • ' + t.album) + '</div>' +
                '</div>' +
                '</div>' +
                '<div class="space-y-2 pt-2">' +
                '<input id="p-seek" type="range" min="0" max="1000" value="0" class="w-full cursor-pointer"/>' +
                '<div class="flex items-center justify-between">' +
                '<span class="font-mono font-label-sm text-label-sm text-on-surface-variant tabular-nums" id="p-cur">0:00</span>' +
                '<div class="flex items-center gap-2">' +
                '<button id="p-shuffle" class="text-on-surface-variant hover:text-on-surface transition-colors focus-ring rounded-full"><span class="material-symbols-outlined text-[18px]">shuffle</span></button>' +
                '<button id="p-prev" class="text-on-surface-variant hover:text-on-surface transition-colors focus-ring rounded-full"><span class="material-symbols-outlined text-[20px]">skip_previous</span></button>' +
                '<button id="p-play" class="w-8 h-8 rounded-full bg-on-surface text-surface flex items-center justify-center hover:scale-105 transition-transform focus-ring"><span class="material-symbols-outlined text-[20px] filled">play_arrow</span></button>' +
                '<button id="p-next" class="text-on-surface-variant hover:text-on-surface transition-colors focus-ring rounded-full"><span class="material-symbols-outlined text-[20px]">skip_next</span></button>' +
                '<button id="p-repeat" class="text-on-surface-variant hover:text-on-surface transition-colors focus-ring rounded-full"><span class="material-symbols-outlined text-[18px]">repeat</span></button>' +
                '</div>' +
                '<span class="font-mono font-label-sm text-label-sm text-on-surface-variant tabular-nums" id="p-dur">0:00</span>' +
                '</div>' +
                '<div class="flex items-center gap-2 pt-1">' +
                '<span class="material-symbols-outlined text-[16px] text-on-surface-variant" id="p-vol-icon">volume_up</span>' +
                '<input id="p-vol" type="range" min="0" max="100" value="' + Math.round(state.player.volume * 100) + '" class="flex-1 cursor-pointer"/>' +
                '<button id="p-add" class="text-on-surface-variant hover:text-on-surface transition-colors focus-ring rounded-full" title="Add local audio"><span class="material-symbols-outlined text-[18px]">library_add</span></button>' +
                '</div>' +
                '</div>' +
                '</div>';
        },
        telemetry() {
            const rows = [
                { k: 'cpu', label: 'CPU load' },
                { k: 'mem', label: 'Memory' },
                { k: 'net', label: 'Throughput' }
            ];
            return '<div class="h-full flex flex-col justify-between p-space-md rounded-2xl acrylic rim" id="telemetry-card">' +
                '<div class="flex items-center justify-between mb-3">' +
                '<div class="flex items-center gap-2"><span class="material-symbols-outlined text-[18px] text-secondary">memory</span>' +
                '<span class="font-label-md text-label-md text-on-surface font-medium">System Telemetry</span></div>' +
                '<span class="font-mono font-label-sm text-label-sm text-secondary bg-surface-container-highest/60 px-2 py-0.5 rounded-full" id="t-status">Live</span>' +
                '</div>' +
                '<div class="space-y-3">' +
                rows.map(r =>
                    '<div data-t-row="' + r.k + '">' +
                    '<div class="flex justify-between font-label-sm text-label-sm mb-1 gap-2">' +
                    '<span class="text-on-surface-variant truncate">' + r.label + ' <span class="opacity-60" data-t-sub>—</span></span>' +
                    '<span class="font-mono text-on-surface shrink-0" data-t-val>—</span>' +
                    '</div>' +
                    '<div class="w-full bg-surface-container-highest/60 rounded-full h-1.5 overflow-hidden">' +
                    '<div class="h-full rounded-full transition-all duration-700" data-t-bar style="width:0%"></div>' +
                    '</div>' +
                    '</div>').join('') +
                '</div>' +
                '<div class="grid grid-cols-3 gap-2 pt-3" id="t-small"></div>' +
                '</div>';
        },
        schedule() {
            return '<div class="h-full flex flex-col justify-between p-space-md rounded-2xl acrylic rim" id="schedule-card">' +
                '<div class="flex items-center justify-between mb-3">' +
                '<div class="flex items-center gap-2"><span class="material-symbols-outlined text-[18px] text-tertiary">calendar_today</span>' +
                '<span class="font-label-md text-label-md text-on-surface font-medium">Today\'s Schedule</span></div>' +
                '<div class="flex items-center gap-1">' +
                '<span class="font-label-sm text-label-sm text-on-surface-variant" id="ev-count">0</span>' +
                '<button id="ev-add" class="w-6 h-6 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors focus-ring"><span class="material-symbols-outlined text-[16px]">add</span></button>' +
                '</div>' +
                '</div>' +
                '<div class="space-y-2.5 flex-1" id="ev-list"></div>' +
                '</div>';
        },
        scratchpad() {
            const done = state.todos.filter(t => t.done).length;
            return '<div class="h-full flex flex-col justify-between p-space-md rounded-2xl acrylic rim">' +
                '<div>' +
                '<div class="flex items-center justify-between mb-3">' +
                '<div class="flex items-center gap-2"><span class="material-symbols-outlined text-secondary text-[18px]">checklist</span>' +
                '<span class="font-label-md text-label-md text-on-surface font-medium">Quick Scratchpad</span></div>' +
                '<span class="font-mono font-label-sm text-label-sm text-on-surface-variant" id="todo-count">' + done + '/' + state.todos.length + '</span>' +
                '</div>' +
                '<div class="space-y-2 max-h-[190px] overflow-y-auto pr-0.5" id="todo-list"></div>' +
                '</div>' +
                '<div class="relative mt-4">' +
                '<input id="todo-input" class="w-full h-10 px-3 pr-10 rounded-xl bg-surface-container-highest/60 text-on-surface font-body-sm text-body-sm placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-secondary/60" placeholder="Add rapid note or task…" type="text"/>' +
                '<button id="todo-add" class="absolute right-2 top-2 p-1 text-on-surface-variant hover:text-on-surface focus-ring rounded-full"><span class="material-symbols-outlined text-[18px]">add_circle</span></button>' +
                '</div>' +
                '</div>';
        },
        feeds() {
            return '<div class="h-full flex flex-col justify-between p-space-md rounded-2xl acrylic rim">' +
                '<div>' +
                '<div class="flex items-center justify-between mb-3">' +
                '<div class="flex items-center gap-2"><span class="material-symbols-outlined text-primary text-[18px]">rss_feed</span>' +
                '<span class="font-label-md text-label-md text-on-surface font-medium">Curated Signals</span></div>' +
                '<button id="feeds-refresh" class="flex items-center gap-1 font-label-sm text-label-sm text-secondary hover:text-on-surface transition-colors focus-ring rounded-full">' +
                '<span class="material-symbols-outlined text-[14px]">refresh</span><span id="feeds-updated">—</span></button>' +
                '</div>' +
                '<div class="space-y-3" id="feeds-list"></div>' +
                '</div>' +
                '<div class="flex items-center justify-between pt-3 text-on-surface-variant font-label-sm text-label-sm">' +
                '<span id="feeds-meta">Aggregating feeds…</span>' +
                '<button id="feeds-config" class="hover:text-on-surface transition-colors focus-ring rounded-full"><span class="material-symbols-outlined text-[16px] text-outline">tune</span></button>' +
                '</div>' +
                '</div>';
        },
        security() {
            const enc = !!cryptoKey;
            return '<div class="h-full flex flex-col justify-between p-space-md rounded-2xl acrylic rim">' +
                '<div>' +
                '<div class="flex items-center justify-between mb-3">' +
                '<div class="flex items-center gap-2"><span class="material-symbols-outlined text-tertiary text-[18px]">vpn_key</span>' +
                '<span class="font-label-md text-label-md text-on-surface font-medium">Security &amp; Network</span></div>' +
                '<span class="font-label-sm text-label-sm ' + (enc ? 'text-secondary' : 'text-tertiary') + ' bg-surface-container-highest/60 px-2 py-0.5 rounded-full" id="sec-badge">' + (enc ? 'Encrypted' : 'Local only') + '</span>' +
                '</div>' +
                '<div class="grid grid-cols-2 gap-3 mb-3">' +
                '<button class="p-2.5 rounded-xl bg-surface-container-high/50 text-left hover:bg-surface-container-high/80 transition-colors focus-ring" id="sec-dns">' +
                '<div class="font-body-sm text-body-sm text-on-surface-variant">DNS Resolver</div>' +
                '<div class="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-1.5 mt-0.5"><span class="w-1.5 h-1.5 rounded-full bg-secondary"></span><span id="sec-dns-val">' + esc(state.security.dns) + '</span></div>' +
                '</button>' +
                '<div class="p-2.5 rounded-xl bg-surface-container-high/50">' +
                '<div class="font-body-sm text-body-sm text-on-surface-variant">Bookmarks saved</div>' +
                '<div class="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-1.5 mt-0.5"><span class="w-1.5 h-1.5 rounded-full bg-secondary-container"></span><span id="sec-bm-count">' + state.bookmarks.length + '</span> stored locally</div>' +
                '</div>' +
                '</div>' +
                '<div class="p-2.5 rounded-xl bg-surface-container-high/50 flex items-center justify-between gap-2">' +
                '<div class="flex items-center gap-2 min-w-0">' +
                '<span class="material-symbols-outlined ' + (enc ? 'text-secondary' : 'text-on-surface-variant') + ' text-[20px]">' + (enc ? 'lock' : 'lock_open') + '</span>' +
                '<div class="min-w-0"><div class="font-label-md text-label-md text-on-surface font-medium">Encrypted Vault</div>' +
                '<div class="font-body-sm text-body-sm text-on-surface-variant truncate" id="sec-vault-sub">' + (enc ? 'AES-GCM 256 · unlocked' : 'AES-GCM 256 available') + '</div></div>' +
                '</div>' +
                '<button id="sec-vault-btn" class="shrink-0 px-3 h-7 rounded-full text-[11px] font-label-sm font-semibold ' + (enc ? 'bg-surface-container-highest text-on-surface' : 'bg-primary-container text-on-primary-container') + ' transition hover:brightness-110">' + (enc ? 'Lock' : 'Enable') + '</button>' +
                '</div>' +
                '</div>' +
                '<div class="flex items-center justify-between pt-3 font-label-sm text-label-sm text-on-surface-variant">' +
                '<span class="flex items-center gap-1" id="sec-signals"><span class="material-symbols-outlined text-[14px]">lock</span>Checking…</span>' +
                '<button id="sec-audit" class="hover:text-on-surface transition-colors focus-ring rounded-full">Audit log →</button>' +
                '</div>' +
                '</div>';
        }
    };

    /* ── Weather ── */
    let weatherData = null;
    const weatherCacheKey = 'fluent-weather-cache-v2';

    async function fetchWeather(force) {
        try {
            if (!force) {
                const c = sessionStorage.getItem(weatherCacheKey);
                if (c) { const p = JSON.parse(c); if (Date.now() - p.ts < 10 * 60 * 1000) { weatherData = p.data; paintWeather(); return; } }
            }
            const lat = state.weather.lat, lon = state.weather.lon, unit = state.weather.unit;
            const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
                '&current=temperature_2m,apparent_temperature,precipitation_probability,weather_code,is_day' +
                '&hourly=temperature_2m,weather_code&forecast_days=2' +
                '&temperature_unit=' + (unit === 'f' ? 'fahrenheit' : 'celsius') + '&timezone=auto';
            const ctrl = new AbortController();
            const tid = setTimeout(() => ctrl.abort(), 12000);
            const r = await fetch(url, { signal: ctrl.signal });
            clearTimeout(tid);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            weatherData = await r.json();
            sessionStorage.setItem(weatherCacheKey, JSON.stringify({ ts: Date.now(), data: weatherData }));
            paintWeather();
        } catch (e) {
            const c = $('#w-cond'); if (c) c.textContent = 'Offline';
        }
    }
    function paintWeather() {
        if (!weatherData) return;
        const c = weatherData.current;
        if (!c) return;
        const info = wmo(c.weather_code, c.is_day);
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('w-city', state.weather.city);
        set('w-cond', info.label);
        set('w-temp', Math.round(c.temperature_2m) + '°' + (state.weather.unit === 'f' ? 'F' : 'C'));
        set('w-feels', 'Feels like ' + Math.round(c.apparent_temperature) + '° • Precip ' + (c.precipitation_probability ?? 0) + '%');
        set('w-icon', info.icon);
        const hourly = weatherData.hourly;
        if (!hourly) return;
        const nowIso = new Date().toISOString().slice(0, 13) + ':00';
        let nowIdx = hourly.time.findIndex(t => t.slice(0, 13) + ':00' >= nowIso);
        if (nowIdx < 0) nowIdx = 0;
        const box = $('#w-hourly');
        if (!box) return;
        const frag = document.createDocumentFragment();
        for (let k = 1; k <= 3; k++) {
            const i = nowIdx + k;
            if (i >= hourly.time.length) break;
            const d = new Date(hourly.time[i]);
            const hi = wmo(hourly.weather_code[i], d.getHours() >= 6 && d.getHours() < 19);
            const div = document.createElement('div');
            div.className = 'flex flex-col items-center';
            div.innerHTML = '<span class="font-label-sm text-label-sm text-on-surface-variant">' + pad(d.getHours()) + ':00</span>' +
                '<span class="text-[16px] leading-none my-0.5 select-none">' + hi.icon + '</span>' +
                '<span class="font-label-sm text-label-sm text-on-surface font-medium">' + Math.round(hourly.temperature_2m[i]) + '°</span>';
            frag.appendChild(div);
        }
        box.innerHTML = '';
        if (frag.childNodes.length) box.appendChild(frag);
        else box.innerHTML = '<div class="col-span-3 text-center font-label-sm text-label-sm text-on-surface-variant py-1">No hourly data</div>';
    }

    function openCityPicker() {
        const m = openModal({
            title: 'Weather location', icon: 'location_on', width: 'max-w-md', footer: false,
            body: '<div class="space-y-4">' +
                '<div class="flex gap-2"><input id="city-q" placeholder="Search a city…" class="flex-1 h-10 px-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:border-secondary/70"/>' +
                '<button id="city-search" class="h-10 px-4 rounded-xl bg-primary-container text-on-primary-container font-label-md text-label-md font-semibold">Search</button></div>' +
                '<button id="city-geo" class="w-full h-10 rounded-xl bg-surface-container-high/60 text-on-surface font-label-md text-label-md hover:bg-surface-container-highest transition flex items-center justify-center gap-2">' +
                '<span class="material-symbols-outlined text-[18px] text-secondary">my_location</span>Use my current location</button>' +
                '<div class="flex items-center gap-2"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Units</span>' +
                '<div class="flex p-0.5 rounded-full bg-surface-container-high/60" id="unit-switch">' +
                '<button data-u="f" class="px-3 py-1 rounded-full font-label-sm text-label-sm ' + (state.weather.unit === 'f' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant') + '">°F</button>' +
                '<button data-u="c" class="px-3 py-1 rounded-full font-label-sm text-label-sm ' + (state.weather.unit === 'c' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant') + '">°C</button>' +
                '</div></div>' +
                '<div id="city-results" class="space-y-1.5"></div></div>'
        });
        m.body.querySelector('#unit-switch').addEventListener('click', e => {
            const b = e.target.closest('[data-u]'); if (!b) return;
            state.weather.unit = b.dataset.u; persist();
            m.body.querySelectorAll('#unit-switch button').forEach(x => {
                const on = x.dataset.u === state.weather.unit;
                x.className = 'px-3 py-1 rounded-full font-label-sm text-label-sm ' + (on ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant');
            });
            fetchWeather(true);
        });
        async function searchCity(q) {
            const res = m.body.querySelector('#city-results');
            res.innerHTML = '<div class="text-center py-4 text-on-surface-variant font-label-sm text-label-sm">Searching…</div>';
            try {
                const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q) + '&count=6&language=en&format=json');
                const j = await r.json();
                if (!j.results || !j.results.length) { res.innerHTML = '<div class="text-center py-4 text-on-surface-variant font-label-sm text-label-sm">No results</div>'; return; }
                res.innerHTML = j.results.map((c, i) =>
                    '<button data-i="' + i + '" class="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-container-high/70 transition text-left">' +
                    '<span class="material-symbols-outlined text-secondary text-[18px]">location_on</span>' +
                    '<span class="flex-1 min-w-0"><span class="block font-label-md text-label-md text-on-surface truncate">' + esc(c.name) + '</span>' +
                    '<span class="block font-body-sm text-body-sm text-on-surface-variant truncate">' + esc([c.admin1, c.country].filter(Boolean).join(', ')) + '</span></span></button>').join('');
                res.onclick = (e) => {
                    const b = e.target.closest('[data-i]'); if (!b) return;
                    const c = j.results[+b.dataset.i];
                    state.weather.lat = c.latitude; state.weather.lon = c.longitude;
                    state.weather.city = c.name + (c.country_code ? ', ' + c.country_code : '');
                    state.weather.auto = false;
                    persist(); fetchWeather(true); m.close();
                    toast('Location updated', 'success');
                };
            } catch (err) { res.innerHTML = '<div class="text-center py-4 text-error font-label-sm text-label-sm">Lookup failed</div>'; }
        }
        m.body.querySelector('#city-search').onclick = () => { const v = m.body.querySelector('#city-q').value.trim(); if (v) searchCity(v); };
        m.body.querySelector('#city-q').addEventListener('keydown', e => { if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) searchCity(v); } });
        m.body.querySelector('#city-geo').onclick = () => {
            if (!navigator.geolocation) { toast('Geolocation unavailable', 'warn'); return; }
            toast('Requesting location…');
            navigator.geolocation.getCurrentPosition(async pos => {
                state.weather.lat = pos.coords.latitude; state.weather.lon = pos.coords.longitude;
                state.weather.auto = true; state.weather.city = 'Current location';
                try {
                    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + state.weather.lat + '&longitude=' + state.weather.lon + '&current=temperature_2m&timezone=auto');
                    const j = await r.json();
                    state.weather.city = (j.timezone || '').split('/').pop().replace(/_/g, ' ') || 'Current location';
                } catch (e) { }
                persist(); fetchWeather(true); m.close(); toast('Location set', 'success');
            }, () => toast('Permission denied', 'warn'));
        };
    }

    /* ── Schedule ── */
    function todayEvents() {
        const today = new Date().toDateString();
        return state.events.filter(e => new Date(e.ts).toDateString() === today).sort((a, b) => a.ts - b.ts);
    }
    function renderEvents() {
        const list = $('#ev-list'); if (!list) return;
        const evs = todayEvents();
        const c = $('#ev-count'); if (c) c.textContent = evs.length + (evs.length === 1 ? ' event' : ' events');
        if (!evs.length) {
            list.innerHTML = '<div class="flex flex-col items-center justify-center py-6 text-center gap-1">' +
                '<span class="material-symbols-outlined text-outline text-[28px]">event_available</span>' +
                '<span class="font-label-sm text-label-sm text-on-surface-variant">Nothing scheduled today</span>' +
                '<button id="ev-add-empty" class="mt-1 font-label-sm text-label-sm text-secondary hover:underline">Add an event</button></div>';
            const b = $('#ev-add-empty'); if (b) b.onclick = () => openEventEditor(null);
            return;
        }
        list.innerHTML = evs.map(e =>
            '<div class="p-2 rounded-xl bg-surface-container-high/60 flex items-start gap-2.5 group cursor-pointer hover:bg-surface-container-high/90 transition" data-id="' + e.id + '">' +
            '<div class="w-1.5 h-7 rounded-full mt-0.5 shrink-0" style="background:' + (e.color || '#90dbff') + '"></div>' +
            '<div class="min-w-0 flex-1"><div class="font-label-md text-label-md text-on-surface font-medium truncate">' + esc(e.title) + '</div>' +
            '<div class="font-body-sm text-body-sm text-on-surface-variant truncate">' + esc(e.time + (e.place ? ' • ' + e.place : '')) + '</div></div>' +
            '<button data-del="' + e.id + '" class="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error transition"><span class="material-symbols-outlined text-[16px]">close</span></button>' +
            '</div>').join('');
        list.onclick = (e) => {
            const del = e.target.closest('[data-del]');
            if (del) { e.stopPropagation(); state.events = state.events.filter(x => x.id !== del.dataset.del); persist(); renderEvents(); toast('Event removed', 'success'); return; }
            const row = e.target.closest('[data-id]');
            if (row) openEventEditor(state.events.find(x => x.id === row.dataset.id));
        };
    }
    function openEventEditor(ev) {
        const isNew = !ev;
        const now = new Date();
        const draft = ev ? Object.assign({}, ev) : {
            id: uid(), title: '', time: '09:00', place: '',
            ts: new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0).getTime(),
            color: '#90dbff'
        };
        const m = openModal({
            title: isNew ? 'New event' : 'Edit event', icon: 'event', width: 'max-w-md',
            onOk: () => {
                const title = m.panel.querySelector('#e-title').value.trim();
                const time = m.panel.querySelector('#e-time').value;
                if (!title) { toast('Title required', 'warn'); return false; }
                draft.title = title; draft.time = time;
                draft.place = m.panel.querySelector('#e-place').value.trim();
                draft.color = m.panel.querySelector('#e-color').value;
                const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const t = time.split(':');
                d.setHours(+t[0], +t[1], 0, 0);
                draft.ts = d.getTime();
                if (isNew) state.events.push(draft); else Object.assign(ev, draft);
                persist(); renderEvents(); toast(isNew ? 'Event added' : 'Event updated', 'success');
            }
        });
        m.body.innerHTML =
            '<div class="space-y-4">' +
            '<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Title</span>' +
            '<input id="e-title" value="' + esc(draft.title) + '" placeholder="Product Core Review" class="mt-1 w-full h-10 px-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:border-secondary/70"/></label>' +
            '<div class="grid grid-cols-2 gap-3">' +
            '<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Time</span>' +
            '<input id="e-time" type="time" value="' + esc(draft.time) + '" class="mt-1 w-full h-10 px-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:border-secondary/70"/></label>' +
            '<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Location</span>' +
            '<input id="e-place" value="' + esc(draft.place) + '" placeholder="Room Delta-4" class="mt-1 w-full h-10 px-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:border-secondary/70"/></label>' +
            '</div>' +
            '<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Accent</span>' +
            '<input id="e-color" type="color" value="' + esc(draft.color) + '" class="mt-1 w-full h-10 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 cursor-pointer"/></label>' +
            '</div>';
    }

    /* ── Scratchpad ── */
    function renderTodos() {
        const list = $('#todo-list'); if (!list) return;
        const done = state.todos.filter(t => t.done).length;
        const c = $('#todo-count'); if (c) c.textContent = done + '/' + state.todos.length;
        if (!state.todos.length) {
            list.innerHTML = '<div class="text-center py-5 font-label-sm text-label-sm text-on-surface-variant">No tasks yet — add one below.</div>';
            return;
        }
        list.innerHTML = state.todos.map(t =>
            '<div class="flex items-center gap-3 p-2 rounded-xl bg-surface-container-high/40 hover:bg-surface-container-high/70 transition-colors group" data-id="' + t.id + '">' +
            '<input type="checkbox" ' + (t.done ? 'checked' : '') + ' class="w-4 h-4 rounded bg-surface-container-highest text-primary-container focus:ring-0 accent-primary-container cursor-pointer shrink-0"/>' +
            '<span class="flex-1 font-body-md text-body-md ' + (t.done ? 'text-on-surface line-through opacity-55' : 'text-on-surface') + ' break-words min-w-0">' + esc(t.text) + '</span>' +
            '<button data-del class="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error transition shrink-0"><span class="material-symbols-outlined text-[16px]">close</span></button>' +
            '</div>').join('');
        list.onchange = (e) => {
            const cb = e.target.closest('input[type=checkbox]'); if (!cb) return;
            const row = cb.closest('[data-id]');
            const t = state.todos.find(x => x.id === row.dataset.id);
            if (t) { t.done = cb.checked; persist(); renderTodos(); }
        };
        list.onclick = (e) => {
            const del = e.target.closest('[data-del]');
            if (!del) return;
            const row = del.closest('[data-id]');
            state.todos = state.todos.filter(x => x.id !== row.dataset.id);
            persist(); renderTodos();
        };
    }
    function addTodo() {
        const inp = $('#todo-input'); if (!inp) return;
        const v = inp.value.trim(); if (!v) return;
        state.todos.push({ id: uid(), text: v, done: false });
        inp.value = ''; persist(); renderTodos();
    }

    /* ── Feeds ── */
    let feedItems = [];
    let feedLoading = false;

    async function loadFeeds(force) {
        if (feedLoading) return;
        const cacheKey = 'fluent-feeds-cache-v2';
        if (!force) {
            const c = sessionStorage.getItem(cacheKey);
            if (c) { const p = JSON.parse(c); if (Date.now() - p.ts < 5 * 60 * 1000) { feedItems = p.items; paintFeeds(p.ts); return; } }
        }
        feedLoading = true;
        const el = $('#feeds-list');
        if (el && !feedItems.length) el.innerHTML = '<div class="h-16 rounded-lg shimmer"></div><div class="h-16 rounded-lg shimmer"></div><div class="h-16 rounded-lg shimmer"></div>';

        const tasks = [];
        if (state.feeds.find(f => f.id === 'hn' && f.enabled)) tasks.push(fetchHN());
        if (state.feeds.find(f => f.id === 'devto' && f.enabled)) tasks.push(fetchDevTo());

        try {
            const results = await Promise.allSettled(tasks);
            let items = [];
            results.forEach(r => { if (r.status === 'fulfilled') items = items.concat(r.value); });
            items.sort((a, b) => b.ts - a.ts);
            feedItems = items.slice(0, 12);
            sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), items: feedItems }));
            paintFeeds(Date.now());
        } catch (e) {
            if (el) el.innerHTML = '<div class="text-center py-6 font-label-sm text-label-sm text-on-surface-variant">Could not load feeds.</div>';
        }
        feedLoading = false;
    }

    async function fetchHN() {
        try {
            const r = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
            const ids = (await r.json()).slice(0, 6);
            const items = await Promise.all(ids.map(async id => {
                try {
                    const i = await (await fetch('https://hacker-news.firebaseio.com/v0/item/' + id + '.json')).json();
                    return { source: 'Hacker News', title: i.title, url: i.url || ('https://news.ycombinator.com/item?id=' + id), ts: (i.time || 0) * 1000 };
                } catch (e) { return null; }
            }));
            return items.filter(Boolean);
        } catch (e) { return []; }
    }
    async function fetchDevTo() {
        try {
            const r = await fetch('https://dev.to/api/articles?per_page=5&top=1');
            const j = await r.json();
            return j.map(a => ({ source: 'Dev.to', title: a.title, url: a.url, ts: new Date(a.published_at).getTime() }));
        } catch (e) { return []; }
    }
    function paintFeeds(ts) {
        const list = $('#feeds-list'); if (!list) return;
        if (!feedItems.length) {
            list.innerHTML = '<div class="text-center py-6 font-label-sm text-label-sm text-on-surface-variant">No signals available.</div>';
        } else {
            list.innerHTML = feedItems.slice(0, 4).map(f =>
                '<a class="block group" href="' + esc(f.url) + '" target="_blank" rel="noopener">' +
                '<div class="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm mb-0.5">' +
                '<span>' + esc(f.source) + '</span><span>' + timeAgo(f.ts) + '</span></div>' +
                '<div class="font-label-md text-label-md text-on-surface group-hover:text-secondary transition-colors line-clamp-2">' + esc(f.title) + '</div>' +
                '</a>').join('');
        }
        const up = $('#feeds-updated'); if (up) up.textContent = ts ? timeAgo(ts) : '—';
        const meta = $('#feeds-meta');
        if (meta) meta.textContent = 'Aggregating ' + state.feeds.filter(f => f.enabled).length + ' feed source' + (state.feeds.filter(f => f.enabled).length === 1 ? '' : 's');
    }
    function openFeedConfig() {
        const m = openModal({
            title: 'Feed sources', icon: 'rss_feed', width: 'max-w-md',
            onOk: () => { persist(); loadFeeds(true); toast('Feeds refreshed', 'success'); }
        });
        m.body.innerHTML = '<div class="space-y-2">' + state.feeds.map(f =>
            '<div class="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-container-high/50">' +
            '<div><div class="font-label-md text-label-md text-on-surface">' + esc(f.name) + '</div>' +
            '<div class="font-body-sm text-body-sm text-on-surface-variant">' + esc(f.type === 'hn' ? 'Top stories, live' : 'Trending developer articles') + '</div></div>' +
            '<div class="switch ' + (f.enabled ? 'on' : '') + '" data-id="' + f.id + '"></div>' +
            '</div>').join('') + '</div>';
        m.body.querySelectorAll('.switch').forEach(sw => sw.onclick = () => {
            const f = state.feeds.find(x => x.id === sw.dataset.id);
            f.enabled = !f.enabled; sw.classList.toggle('on', f.enabled); persist();
        });
    }

    /* ── Telemetry ── */
    let telemetryBuilt = false;
    const tRefs = {};
    function buildTelemetry() {
        const card = $('#telemetry-card');
        if (!card) return false;
        const small = card.querySelector('#t-small');
        if (small && !small.dataset.built) {
            small.innerHTML =
                '<div class="p-2 rounded-lg bg-surface-container-high/40 text-center"><div class="font-label-sm text-label-sm text-on-surface-variant">Cores</div>' +
                '<div class="font-label-md text-label-md text-on-surface font-semibold truncate" id="t-cores">—</div></div>' +
                '<div class="p-2 rounded-lg bg-surface-container-high/40 text-center"><div class="font-label-sm text-label-sm text-on-surface-variant">Battery</div>' +
                '<div class="font-label-md text-label-md text-on-surface font-semibold truncate" id="t-batt">—</div></div>' +
                '<div class="p-2 rounded-lg bg-surface-container-high/40 text-center"><div class="font-label-sm text-label-sm text-on-surface-variant">Platform</div>' +
                '<div class="font-label-md text-label-md text-on-surface font-semibold truncate" id="t-plat">—</div></div>';
            small.dataset.built = '1';
        }
        tRefs.cpuVal = card.querySelector('[data-t-row="cpu"] [data-t-val]');
        tRefs.cpuSub = card.querySelector('[data-t-row="cpu"] [data-t-sub]');
        tRefs.cpuBar = card.querySelector('[data-t-row="cpu"] [data-t-bar]');
        tRefs.memVal = card.querySelector('[data-t-row="mem"] [data-t-val]');
        tRefs.memSub = card.querySelector('[data-t-row="mem"] [data-t-sub]');
        tRefs.memBar = card.querySelector('[data-t-row="mem"] [data-t-bar]');
        tRefs.netVal = card.querySelector('[data-t-row="net"] [data-t-val]');
        tRefs.netSub = card.querySelector('[data-t-row="net"] [data-t-sub]');
        tRefs.netBar = card.querySelector('[data-t-row="net"] [data-t-bar]');
        tRefs.status = card.querySelector('#t-status');
        telemetryBuilt = true;
        return true;
    }
    async function paintTelemetry() {
        const card = $('#telemetry-card');
        if (!card) { telemetryBuilt = false; return; }
        if (!telemetryBuilt || !document.contains(card)) buildTelemetry();
        const setBar = (el, pct, color) => { if (el) el.style.width = pct + '%'; if (el && color) el.className = color + ' h-full rounded-full transition-all duration-700'; };

        const cores = navigator.hardwareConcurrency || 4;
        const cpuPct = clamp(6 + (cores <= 4 ? 12 : 6) + (Math.random() * 8 | 0), 4, 45);
        if (tRefs.cpuVal) tRefs.cpuVal.textContent = cpuPct + '%';
        if (tRefs.cpuSub) tRefs.cpuSub.textContent = cores + ' threads';
        setBar(tRefs.cpuBar, cpuPct, 'bg-secondary-container');

        let memUsed = null, memTotal = null, memPct = 0;
        if (performance.memory && performance.memory.jsHeapSizeLimit) {
            memUsed = performance.memory.usedJSHeapSize;
            memTotal = performance.memory.jsHeapSizeLimit;
            memPct = clamp(Math.round((memUsed / memTotal) * 100), 2, 98);
        } else if (navigator.deviceMemory) {
            memTotal = navigator.deviceMemory * 1024 * 1024 * 1024;
            memUsed = memTotal * (0.28 + Math.random() * 0.06);
            memPct = Math.round((memUsed / memTotal) * 100);
        }
        if (tRefs.memVal) tRefs.memVal.textContent = memPct + '%';
        if (tRefs.memSub) tRefs.memSub.textContent = memTotal ? bytes(memUsed) + ' / ' + bytes(memTotal) : 'Unavailable';
        setBar(tRefs.memBar, memPct, 'bg-primary');

        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const down = conn && conn.downlink ? conn.downlink : null;
        const netPct = down ? clamp(Math.round((down / 100) * 100), 4, 100) : 55;
        const netLabel = down ? down.toFixed(1) + ' Mbps' : (navigator.onLine ? 'Online' : 'Offline');
        if (tRefs.netVal) tRefs.netVal.textContent = netLabel;
        if (tRefs.netSub) tRefs.netSub.textContent = (conn && conn.effectiveType ? conn.effectiveType.toUpperCase() : 'link');
        setBar(tRefs.netBar, netPct, 'bg-tertiary');

        if (tRefs.status) tRefs.status.textContent = navigator.onLine ? 'Live' : 'Offline';

        const coresEl = $('#t-cores'); if (coresEl) coresEl.textContent = String(cores);
        const platEl = $('#t-plat'); if (platEl) platEl.textContent = ((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '—').split(' ')[0];

        const mem = $('#footer-mem');
        if (mem) mem.textContent = 'Memory: ' + (memUsed ? bytes(memUsed) : '—');
    }
    let batteryRef = null;
    async function refreshBattery() {
        try {
            if (navigator.getBattery) {
                batteryRef = batteryRef || await navigator.getBattery();
                const el = $('#t-batt');
                if (el) el.textContent = Math.round(batteryRef.level * 100) + '%' + (batteryRef.charging ? ' ⚡' : '');
            }
        } catch (e) { }
    }

    /* ── Security ── */
    async function paintSecurity() {
        // Storage size — cached on the function, refreshed once per minute
        const now = Date.now();
        if (!paintSecurity._lastSizeCheck || now - paintSecurity._lastSizeCheck > 60000) {
            let used = 0;
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    used += (localStorage.getItem(localStorage.key(i)) || '').length;
                }
            } catch (e) { }
            paintSecurity._cachedSize = bytes(used);
            paintSecurity._lastSizeCheck = now;
        }
        const usedStr = paintSecurity._cachedSize || '0 B';

        const enc = !!cryptoKey;
        const badge = $('#sec-badge');
        if (badge) { badge.textContent = enc ? 'Encrypted' : 'Local only'; badge.className = 'font-label-sm text-label-sm ' + (enc ? 'text-secondary' : 'text-tertiary') + ' bg-surface-container-highest/60 px-2 py-0.5 rounded-full'; }
        const dnsEl = $('#sec-dns-val'); if (dnsEl) dnsEl.textContent = state.security.dns;
        const bmEl = $('#sec-bm-count'); if (bmEl) bmEl.textContent = state.bookmarks.length;
        const btn = $('#sec-vault-btn');
        if (btn) {
            btn.textContent = enc ? 'Lock' : 'Enable';
            btn.className = 'shrink-0 px-3 h-7 rounded-full text-[11px] font-label-sm font-semibold transition hover:brightness-110 ' + (enc ? 'bg-surface-container-highest text-on-surface' : 'bg-primary-container text-on-primary-container');
        }
        const sub = $('#sec-vault-sub');
        if (sub) sub.textContent = enc ? 'AES-GCM 256 · unlocked' : 'AES-GCM 256 available';
        const sig = $('#sec-signals');
        if (sig) {
            const secure = location.protocol === 'https:' ||
                location.hostname === 'localhost' ||
                location.protocol === 'file:' ||
                location.protocol === 'chrome-extension:';

            // Cache storage size — recompute at most once per 60s
            const now = Date.now();
            if (!paintSecurity._lastSizeCheck || now - paintSecurity._lastSizeCheck > 60000) {
                let used = 0;
                try {
                    for (let i = 0; i < localStorage.length; i++) {
                        used += (localStorage.getItem(localStorage.key(i)) || '').length;
                    }
                } catch (e) { }
                paintSecurity._cachedSize = bytes(used);
                paintSecurity._lastSizeCheck = now;
            }
            const usedStr = paintSecurity._cachedSize || '0 B';

            // Build the DOM structure once; only update text nodes afterwards
            if (!sig.dataset.built) {
                sig.innerHTML = '<span class="material-symbols-outlined text-[14px]">lock</span><span data-sig></span>';
                sig.dataset.built = '1';
            }
            const lockIcon = sig.querySelector('.material-symbols-outlined');
            const sigText = sig.querySelector('[data-sig]');
            if (lockIcon) {
                lockIcon.textContent = secure ? 'lock' : 'lock_open';
                lockIcon.className = 'material-symbols-outlined text-[14px] ' + (secure ? 'text-secondary' : 'text-error');
            }
            if (sigText) {
                sigText.textContent = (secure ? 'Secure context' : 'Insecure context') + ' · ' + usedStr;
            }
        }
        const strip = $('#vault-strip');
        if (strip) strip.textContent = enc ? 'Vault Encrypted' : 'Local Vault Online';
    }

    function openVaultDialog() {
        if (cryptoKey) {
            cryptoKey = null; persistNow();
            toast('Vault locked — data stored unencrypted', 'warn');
            paintSecurity(); return;
        }
        if (!window.crypto || !crypto.subtle) { toast('Web Crypto unavailable', 'error'); return; }
        const m = openModal({
            title: 'Encrypt your vault', icon: 'lock', width: 'max-w-md',
            onOk: async () => {
                const p1 = m.panel.querySelector('#v-pass').value;
                const p2 = m.panel.querySelector('#v-pass2').value;
                if (p1.length < 6) { toast('Use at least 6 characters', 'warn'); return false; }
                if (p1 !== p2) { toast('Passphrases do not match', 'warn'); return false; }
                const dk = await deriveKey(p1, null);
                cryptoKey = dk.key;
                localStorage.setItem('fluent-start-salt', dk.salt);
                await encryptAndStore(serialize());
                toast('Vault encrypted (AES-GCM 256)', 'success');
                paintSecurity();
            }
        });
        m.body.innerHTML =
            '<div class="space-y-4">' +
            '<div class="flex items-start gap-3 p-3 rounded-xl bg-surface-container-high/50">' +
            '<span class="material-symbols-outlined text-secondary text-[20px]">info</span>' +
            '<p class="font-body-sm text-body-sm text-on-surface-variant">Settings, apps, bookmarks and notes will be encrypted with AES-GCM 256 (PBKDF2, 200 000 iterations). <strong class="text-on-surface">There is no recovery.</strong></p>' +
            '</div>' +
            '<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Passphrase</span>' +
            '<input id="v-pass" type="password" class="mt-1 w-full h-10 px-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:border-secondary/70"/></label>' +
            '<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Confirm</span>' +
            '<input id="v-pass2" type="password" class="mt-1 w-full h-10 px-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:border-secondary/70"/></label>' +
            '</div>';
    }

    function openAuditLog() {
        const rows = [
            { t: 'Vault initialised', d: 'Plain local storage' },
            { t: 'Wallpaper set', d: state.wallpaper.type + ' · ' + state.wallpaper.id },
            { t: 'Apps managed', d: state.apps.length + ' shortcuts' },
            { t: 'Bookmarks saved', d: state.bookmarks.length + ' items across ' + state.bmFolders.length + ' folders' },
            { t: 'Storage encrypted', d: cryptoKey ? 'AES-GCM 256 active' : 'Not enabled' },
            { t: 'Session start', d: new Date(sessionStart).toLocaleString() }
        ];
        openModal({
            title: 'Audit log', icon: 'receipt_long', width: 'max-w-md', footer: false,
            body: '<div class="space-y-2">' + rows.map(r =>
                '<div class="flex items-center justify-between p-3 rounded-xl bg-surface-container-high/50 gap-4">' +
                '<span class="font-label-md text-label-md text-on-surface">' + esc(r.t) + '</span>' +
                '<span class="font-mono text-[11px] text-on-surface-variant truncate">' + esc(r.d) + '</span>' +
                '</div>').join('') + '</div>'
        });
    }

    /* ══════════════════════════════════════════════════════════════════════════
       MUSIC PLAYER
       ══════════════════════════════════════════════════════════════════════════ */
    const player = {
        el: null, playing: false,
        init() {
            this.el = new Audio();
            this.el.preload = 'none';
            this.el.volume = state.player.volume;
            this.el.addEventListener('timeupdate', throttle(() => this.onTime(), 400));
            this.el.addEventListener('loadedmetadata', () => this.onMeta());
            this.el.addEventListener('ended', () => this.next(true));
            this.el.addEventListener('error', () => { if (this.el.src) toast('Could not play this track', 'warn'); });
            // Do NOT call load() here. We'll lazy-load on first play.
            this.updateUI();
        },

        ensureLoaded() {
            if (this.el.src) return;
            this.load(state.player.index, false);
        },
        load(i, autoplay) {
            if (!state.tracks.length) return;
            state.player.index = ((i % state.tracks.length) + state.tracks.length) % state.tracks.length;
            const t = state.tracks[state.player.index];
            if (!t) return;
            if (t.local && t.blobKey) {
                idb.get('media', t.blobKey).then(blob => {
                    if (blob) { this.el.src = URL.createObjectURL(blob); if (autoplay) this.play(); }
                });
            } else {
                this.el.src = t.src;
                if (autoplay) this.play();
            }
            this.updateUI();
            persist();
        },
        play() {
            this.ensureLoaded();
            const p = this.el.play();
            if (p && p.catch) p.catch(() => toast('Playback blocked by browser', 'warn'));
            this.playing = true; this.updateUI();
        },
        pause() { this.el.pause(); this.playing = false; this.updateUI(); },
        toggle() { this.ensureLoaded(); this.playing ? this.pause() : this.play(); },
        next(auto) {
            if (state.player.repeat === 'one' && auto) { this.el.currentTime = 0; this.play(); return; }
            if (state.player.shuffle) {
                let n = state.player.index;
                if (state.tracks.length > 1) while (n === state.player.index) n = Math.floor(Math.random() * state.tracks.length);
                this.load(n, true);
            } else {
                if (state.player.repeat === 'off' && auto && state.player.index === state.tracks.length - 1) { this.pause(); return; }
                this.load(state.player.index + 1, true);
            }
        },
        prev() { this.load(state.player.index - 1, this.playing); },
        onTime() {
            const cur = $('#p-cur'), seek = $('#p-seek');
            if (cur) cur.textContent = fmtDur(this.el.currentTime);
            if (seek && this.el.duration) seek.value = String(Math.round((this.el.currentTime / this.el.duration) * 1000));
        },
        onMeta() { const d = $('#p-dur'); if (d) d.textContent = fmtDur(this.el.duration); },
        updateUI() {
            const card = $('#player-card'); if (!card) return;
            const btn = $('#p-play');
            if (btn) btn.innerHTML = '<span class="material-symbols-outlined text-[20px] filled">' + (this.playing ? 'pause' : 'play_arrow') + '</span>';
            const t = state.tracks[state.player.index];
            if (t) {
                const ti = $('#p-title'), su = $('#p-sub');
                if (ti) ti.textContent = t.title;
                if (su) su.textContent = t.artist + ' • ' + t.album;
                const art = card.querySelector('#p-art') && card.querySelector('#p-art').parentElement;
                if (art) art.style.background = 'linear-gradient(135deg,' + t.c1 + ',' + t.c2 + ')';
            }
            const sh = $('#p-shuffle'), rp = $('#p-repeat');
            if (sh) sh.className = 'transition-colors focus-ring rounded-full ' + (state.player.shuffle ? 'text-secondary' : 'text-on-surface-variant hover:text-on-surface');
            if (rp) {
                const ic = state.player.repeat === 'one' ? 'repeat_one' : 'repeat';
                rp.innerHTML = '<span class="material-symbols-outlined text-[18px]">' + ic + '</span>';
                rp.className = 'transition-colors focus-ring rounded-full ' + (state.player.repeat !== 'off' ? 'text-secondary' : 'text-on-surface-variant hover:text-on-surface');
            }
        }
    };
    function fmtDur(s) {
        if (!isFinite(s) || s == null) return '0:00';
        const m = Math.floor(s / 60), ss = Math.floor(s % 60);
        return m + ':' + pad(ss);
    }
    function bindPlayer() {
        const card = $('#player-card'); if (!card) return;
        const bind = (id, fn) => { const el = card.querySelector('#' + id); if (el) el.onclick = fn; };
        bind('p-play', () => player.toggle());
        bind('p-next', () => player.next(false));
        bind('p-prev', () => player.prev());
        bind('p-shuffle', () => { state.player.shuffle = !state.player.shuffle; persist(); player.updateUI(); });
        bind('p-repeat', () => {
            const order = ['off', 'all', 'one'];
            state.player.repeat = order[(order.indexOf(state.player.repeat) + 1) % 3];
            persist(); player.updateUI();
            toast('Repeat: ' + state.player.repeat);
        });
        bind('p-add', addLocalAudio);
        bind('player-list-btn', openPlaylist);
        const seek = card.querySelector('#p-seek');
        if (seek) seek.oninput = (e) => { if (player.el.duration) player.el.currentTime = (e.target.value / 1000) * player.el.duration; };
        const vol = card.querySelector('#p-vol');
        if (vol) vol.oninput = (e) => {
            state.player.volume = e.target.value / 100;
            player.el.volume = state.player.volume;
            const ic = $('#p-vol-icon');
            if (ic) ic.textContent = state.player.volume === 0 ? 'volume_off' : state.player.volume < 0.5 ? 'volume_down' : 'volume_up';
            persist();
        };
    }
    function addLocalAudio() {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'audio/*'; inp.multiple = true;
        inp.onchange = async () => {
            for (const f of Array.from(inp.files)) {
                const key = uid();
                await idb.set('media', key, f);
                state.tracks.push({
                    id: uid(), title: f.name.replace(/\.[^.]+$/, ''), artist: 'Local file', album: 'Your library',
                    src: '', local: true, blobKey: key, c1: '#0d6f8f', c2: '#90dbff'
                });
            }
            persist(); toast(inp.files.length + ' track(s) added', 'success');
            player.updateUI();
        };
        inp.click();
    }
    function openPlaylist() {
        const m = openModal({ title: 'Playlist', icon: 'queue_music', width: 'max-w-lg', footer: false });
        const render = () => {
            m.body.innerHTML = '<div class="space-y-1.5">' + state.tracks.map((t, i) =>
                '<div class="flex items-center gap-3 p-2.5 rounded-xl transition cursor-pointer ' + (i === state.player.index ? 'bg-primary-container/25 border border-secondary/40' : 'hover:bg-surface-container-high/60') + '" data-i="' + i + '">' +
                '<div class="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center" style="background:linear-gradient(135deg,' + t.c1 + ',' + t.c2 + ')">' +
                '<span class="material-symbols-outlined text-white/90 text-[18px]">' + (i === state.player.index && player.playing ? 'graphic_eq' : 'music_note') + '</span></div>' +
                '<div class="min-w-0 flex-1"><div class="font-label-md text-label-md text-on-surface truncate">' + esc(t.title) + '</div>' +
                '<div class="font-body-sm text-body-sm text-on-surface-variant truncate">' + esc(t.artist) + (t.local ? ' • Local' : '') + '</div></div>' +
                (t.local ? '<button data-del="' + t.id + '" class="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:text-error transition"><span class="material-symbols-outlined text-[16px]">delete</span></button>' : '') +
                '</div>').join('') + '</div>' +
                '<button id="pl-add" class="mt-3 w-full h-10 rounded-xl bg-surface-container-high/60 text-on-surface font-label-md text-label-md hover:bg-surface-container-highest transition flex items-center justify-center gap-2">' +
                '<span class="material-symbols-outlined text-[18px]">library_add</span>Add local audio files</button>';

            m.body.querySelectorAll('[data-i]').forEach(row => row.onclick = (e) => {
                if (e.target.closest('[data-del]')) {
                    const id = e.target.closest('[data-del]').dataset.del;
                    const t = state.tracks.find(x => x.id === id);
                    if (t && t.blobKey) idb.del('media', t.blobKey);
                    state.tracks = state.tracks.filter(x => x.id !== id);
                    if (state.player.index >= state.tracks.length) state.player.index = 0;
                    persist(); render();
                    return;
                }
                player.load(+row.dataset.i, true); render();
            });
            m.body.querySelector('#pl-add').onclick = () => { addLocalAudio(); setTimeout(render, 800); };
        };
        render();
    }

    /* ══════════════════════════════════════════════════════════════════════════
       LIBRARY (APPS)
       ══════════════════════════════════════════════════════════════════════════ */
    let libraryFilter = 'all';
    let libraryQuery = '';

    function renderLibrary() {
        const list = $('#library-list'); if (!list) return;
        const items = state.apps.filter(a =>
            (libraryFilter === 'all' || a.cat === libraryFilter) &&
            (!libraryQuery || a.name.toLowerCase().includes(libraryQuery) || a.url.toLowerCase().includes(libraryQuery))
        );
        $('#library-filters').innerHTML = CATEGORIES.map(c => {
            const on = c.id === libraryFilter;
            return '<button class="lib-filter px-4 py-1.5 rounded-full font-label-md text-label-md transition-all ' +
                (on ? 'text-on-surface bg-surface-container-high shadow-sm' : 'text-on-surface-variant hover:text-on-surface bg-surface-container/50') +
                '" data-cat="' + c.id + '">' + c.label + '</button>';
        }).join('');

        if (!items.length) {
            list.innerHTML = '<div class="py-14 text-center text-on-surface-variant font-label-md text-label-md">No apps match this filter.</div>';
        } else {
            list.innerHTML = items.map(a =>
                '<div class="grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-5 py-3 hover:bg-surface-container-high/40 transition group" data-id="' + a.id + '">' +
                '<div class="w-10 h-10 rounded-xl bg-surface-container-high/70 flex items-center justify-center shrink-0 border border-white/5">' + tileIconHTML(a) + '</div>' +
                '<div class="min-w-0"><div class="font-label-lg text-label-lg text-on-surface truncate">' + esc(a.name) + '</div>' +
                '<div class="font-body-sm text-body-sm text-on-surface-variant truncate md:hidden">' + esc(a.url) + '</div></div>' +
                '<div class="hidden md:block font-mono text-[11px] text-on-surface-variant truncate max-w-[320px]">' + esc(a.url) + '</div>' +
                '<div class="font-label-sm text-label-sm text-on-surface-variant bg-surface-container-high/60 px-2 py-0.5 rounded-full whitespace-nowrap">' + esc((CATEGORIES.find(c => c.id === a.cat) || { label: 'Other' }).label) + '</div>' +
                '<div class="hidden md:block font-mono text-[11px] text-on-surface-variant w-12 text-right">' + (a.launches || 0) + '</div>' +
                '</div>').join('');
            list.querySelectorAll('[data-id]').forEach(row => {
                const a = state.apps.find(x => x.id === row.dataset.id);
                row.addEventListener('dblclick', () => openApp(a));
                row.addEventListener('contextmenu', e => {
                    e.preventDefault();
                    showCtxMenu(e.clientX, e.clientY, [
                        { icon: 'open_in_new', label: 'Open', action: () => openApp(a) },
                        { icon: 'edit', label: 'Edit…', action: () => openAppEditor(a) },
                        { icon: 'bookmark_add', label: 'Save to bookmarks', action: () => saveBookmark({ title: a.name, url: a.url, folder: 'Tools' }) },
                        { icon: 'content_copy', label: 'Copy URL', action: () => { navigator.clipboard.writeText(a.url); toast('Copied', 'success'); } },
                        '-',
                        { icon: 'delete', label: 'Delete', danger: true, action: () => { state.apps = state.apps.filter(x => x.id !== a.id); persist(); renderLibrary(); renderDock(); renderFilters(); toast('Deleted', 'success'); } }
                    ]);
                });
            });
        }
        const sa = $('#stat-apps'); if (sa) sa.textContent = state.apps.length;
        const sl = $('#stat-launches'); if (sl) sl.textContent = state.apps.reduce((s, a) => s + (a.launches || 0), 0);
        let used = 0;
        try { for (let i = 0; i < localStorage.length; i++) used += (localStorage.getItem(localStorage.key(i)) || '').length; } catch (e) { }
        const ss = $('#stat-size'); if (ss) ss.textContent = bytes(used);
    }

    /* ══════════════════════════════════════════════════════════════════════════
       WIDGET MANAGER
       ══════════════════════════════════════════════════════════════════════════ */
    function renderWidgetManager() {
        const box = $('#widget-manager'); if (!box) return;
        box.innerHTML = state.widgets.map(w => {
            const meta = WIDGETS.find(x => x.id === w.id) || {};
            return '<div class="flex items-center gap-4 p-4 rounded-2xl acrylic rim" data-w="' + w.id + '" draggable="true">' +
                '<span class="material-symbols-outlined text-outline cursor-grab active:cursor-grabbing select-none">drag_indicator</span>' +
                '<div class="w-10 h-10 rounded-xl bg-surface-container-high/70 flex items-center justify-center shrink-0">' +
                '<span class="material-symbols-outlined text-secondary text-[20px]">' + (meta.icon || 'widgets') + '</span></div>' +
                '<div class="flex-1 min-w-0"><div class="font-label-lg text-label-lg text-on-surface">' + esc(meta.name || w.id) + '</div>' +
                '<div class="font-body-sm text-body-sm text-on-surface-variant truncate">' + esc(meta.desc || '') + '</div></div>' +
                '<div class="switch ' + (w.on ? 'on' : '') + '" data-toggle="' + w.id + '"></div>' +
                '</div>';
        }).join('');
        box.querySelectorAll('[data-toggle]').forEach(sw => sw.onclick = () => {
            const w = state.widgets.find(x => x.id === sw.dataset.toggle);
            w.on = !w.on; sw.classList.toggle('on', w.on);
            persist(); renderWidgetGrid();
        });
        let dragId = null;
        box.querySelectorAll('[data-w]').forEach(row => {
            row.addEventListener('dragstart', () => { dragId = row.dataset.w; row.style.opacity = '.4'; });
            row.addEventListener('dragend', () => { row.style.opacity = ''; });
            row.addEventListener('dragover', e => e.preventDefault());
            row.addEventListener('drop', e => {
                e.preventDefault();
                const target = row.dataset.w;
                if (!dragId || dragId === target) return;
                const from = state.widgets.findIndex(x => x.id === dragId);
                const to = state.widgets.findIndex(x => x.id === target);
                const [mv] = state.widgets.splice(from, 1);
                state.widgets.splice(to, 0, mv);
                persist(); renderWidgetGrid();
            });
        });
    }

    /* ══════════════════════════════════════════════════════════════════════════
       WIDGET GRID
       ══════════════════════════════════════════════════════════════════════════ */
    const WIDGET_AFTER = {
        weather: () => { paintWeather(); },
        player: () => { player.updateUI(); bindPlayer(); },
        telemetry: () => { buildTelemetry(); paintTelemetry(); },
        schedule: () => { renderEvents(); },
        scratchpad: () => { renderTodos(); },
        feeds: () => { paintFeeds(); },
        security: () => { paintSecurity(); }
    };

    function renderWidgetGrid() {
        const grid = $('#widget-grid');
        if (!grid) return;
        const enabled = state.widgets.filter(w => w.on);
        const frag = document.createDocumentFragment();
        enabled.forEach(w => {
            const meta = WIDGETS.find(x => x.id === w.id) || {};
            const shell = document.createElement('div');
            shell.className = 'widget-shell ' + widgetColClass(meta.col || 3);
            shell.dataset.widget = w.id;
            frag.appendChild(shell);
        });
        grid.innerHTML = '';
        grid.appendChild(frag);
        enabled.forEach(w => {
            const el = grid.querySelector('[data-widget="' + w.id + '"]');
            if (!el) return;
            el.innerHTML = WIDGET_RENDER[w.id] ? WIDGET_RENDER[w.id]() : '';
            if (WIDGET_AFTER[w.id]) WIDGET_AFTER[w.id]();
        });
        renderWidgetManager();
    }

    /* ══════════════════════════════════════════════════════════════════════════
       SETTINGS
       ══════════════════════════════════════════════════════════════════════════ */
    function openSettings(tab) {
        tab = tab || 'general';
        const m = openModal({ title: 'Settings', icon: 'settings', width: 'max-w-3xl', footer: false });
        m.body.innerHTML =
            '<div class="flex flex-col sm:flex-row gap-5">' +
            '<div class="sm:w-44 shrink-0 flex sm:flex-col gap-1 overflow-x-auto no-scrollbar" id="settings-tabs">' +
            tabBtn('general', 'General', 'tune') +
            tabBtn('appearance', 'Appearance', 'palette') +
            tabBtn('search', 'Search', 'search') +
            tabBtn('data', 'Data', 'database') +
            tabBtn('about', 'About', 'info') +
            '</div>' +
            '<div class="flex-1 min-w-0" id="settings-panel"></div>' +
            '</div>';
        function tabBtn(id, label, icon) {
            return '<button data-tab="' + id + '" class="set-tab shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl font-label-md text-label-md transition ' +
                (id === tab ? 'bg-primary-container/25 text-on-surface border border-secondary/30' : 'text-on-surface-variant hover:bg-surface-container-high/60') + '">' +
                '<span class="material-symbols-outlined text-[18px]">' + icon + '</span>' + label + '</button>';
        }
        const panel = m.body.querySelector('#settings-panel');
        const draw = () => {
            panel.innerHTML = SETTINGS_TABS[tab]();
            if (SETTINGS_BIND[tab]) SETTINGS_BIND[tab](panel, m);
            m.body.querySelectorAll('.set-tab').forEach(b => b.onclick = () => {
                tab = b.dataset.tab;
                m.body.querySelectorAll('.set-tab').forEach(x => x.className = 'set-tab shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl font-label-md text-label-md transition ' + (x.dataset.tab === tab ? 'bg-primary-container/25 text-on-surface border border-secondary/30' : 'text-on-surface-variant hover:bg-surface-container-high/60'));
                draw();
            });
        };
        draw();
    }

    function row(label, sub, control) {
        return '<div class="flex items-center justify-between gap-4 py-3 border-b border-outline-variant/20 last:border-0">' +
            '<div class="min-w-0"><div class="font-label-md text-label-md text-on-surface">' + label + '</div>' +
            (sub ? '<div class="font-body-sm text-body-sm text-on-surface-variant">' + sub + '</div>' : '') + '</div>' +
            '<div class="shrink-0">' + control + '</div></div>';
    }
    function field(id, label, value, type, ph) {
        return '<label class="block mb-3"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">' + label + '</span>' +
            '<input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '" placeholder="' + esc(ph || '') + '" class="mt-1 w-full h-10 px-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:border-secondary/70"/></label>';
    }
    function select(id, label, value, opts) {
        return '<label class="block mb-3"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">' + label + '</span>' +
            '<select id="' + id + '" class="mt-1 w-full h-10 px-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:border-secondary/70">' +
            opts.map(o => '<option value="' + o.v + '"' + (o.v === value ? ' selected' : '') + '>' + esc(o.l) + '</option>').join('') + '</select></label>';
    }
    function sw(id, on) { return '<div class="switch ' + (on ? 'on' : '') + '" id="' + id + '"></div>'; }
    function btn(id, label, icon, style) {
        return '<button id="' + id + '" class="h-9 px-4 rounded-full font-label-md text-label-md transition flex items-center gap-1.5 ' +
            (style === 'primary' ? 'bg-primary-container text-on-primary-container font-semibold hover:brightness-110'
                : style === 'danger' ? 'bg-error-container/70 text-on-error-container hover:bg-error-container'
                    : 'bg-surface-container-high/70 text-on-surface hover:bg-surface-container-highest') + '">' +
            (icon ? '<span class="material-symbols-outlined text-[18px]">' + icon + '</span>' : '') + label + '</button>';
    }

    const SETTINGS_TABS = {
        general: () => '<div class="space-y-1">' +
            field('s-name', 'Your name', state.user.name, 'text', 'Alex') +
            select('s-theme', 'Theme', state.theme, [{ v: 'dark', l: 'Dark' }, { v: 'light', l: 'Light' }, { v: 'auto', l: 'Match system' }]) +
            row('Show greeting', 'Personalised greeting above the clock', sw('s-greet', state.greetingEnabled)) +
            row('24-hour clock', 'Use a 24-hour time format', sw('s-clock24', state.clock24)) +
            row('Show seconds', 'Display the seconds counter', sw('s-secs', state.showSeconds)) +
            row('Reduce motion', 'Disable interface animations', sw('s-motion', state.reduceMotion)) +
            row('Performance mode', 'Reduces blur & visual effects on low-end devices', sw('s-lowperf', perf.lowEnd)) +
            '</div>',
        appearance: () => '<div class="space-y-1">' +
            row('Wallpaper', 'Current: ' + esc($('#wallpaper-name') ? $('#wallpaper-name').textContent : '—'), btn('s-wall', 'Change', 'wallpaper')) +
            row('Glass blur', 'Adjust acrylic translucency strength',
                '<input id="s-blur" type="range" min="0" max="40" value="' + (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--glass-blur')) || 22) + '" class="w-40"/>') +
            row('Reset appearance', 'Restore default wallpaper and theme', btn('s-reset-app', 'Reset', 'restart_alt')) +
            '</div>',
        search: () => '<div class="space-y-1">' +
            select('s-engine', 'Default search engine', state.engine, Object.keys(ENGINES).map(k => ({ v: k, l: ENGINES[k].name }))) +
            row('Open results in a new tab', 'Keep your start page in place', sw('s-newtab', state.searchInNewTab)) +
            '<div class="pt-4"><div class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">Search history (' + state.history.length + ')</div>' +
            '<div class="max-h-48 overflow-y-auto space-y-1 mb-3">' +
            (state.history.length ? state.history.slice(0, 30).map((h, i) =>
                '<div class="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-surface-container-high/40">' +
                '<span class="font-body-sm text-body-sm text-on-surface truncate">' + esc(h.q) + '</span>' +
                '<button data-h="' + i + '" class="text-on-surface-variant hover:text-error transition"><span class="material-symbols-outlined text-[16px]">close</span></button>' +
                '</div>').join('') : '<div class="font-body-sm text-body-sm text-on-surface-variant px-1">No history yet.</div>') +
            '</div>' + btn('s-clear-history', 'Clear history', 'delete_sweep') + '</div>' +
            '<div class="pt-4 mt-4 border-t border-outline-variant/20"><div class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">Bang shortcuts</div>' +
            '<div class="flex flex-wrap gap-1.5">' + Object.keys(BANGS).map(b => '<span class="px-2 py-0.5 rounded-md bg-surface-container-high/60 font-mono text-[11px] text-on-surface">!' + b + ' → ' + ENGINES[BANGS[b]].name + '</span>').join('') + '</div></div>' +
            '</div>',
        data: () => '<div class="space-y-1">' +
            row('Export data', 'Download a JSON backup of everything', btn('s-export', 'Export', 'download')) +
            row('Import data', 'Restore from a JSON backup', btn('s-import', 'Import', 'upload')) +
            row('Export bookmarks (HTML)', 'Netscape format readable by all browsers', btn('s-export-bm', 'Export', 'bookmark')) +
            row('Encrypted vault', cryptoKey ? 'Currently encrypting your local data' : 'Encrypt everything with a passphrase', btn('s-vault', cryptoKey ? 'Lock' : 'Enable', 'lock')) +
            row('Storage used', 'Local storage footprint', '<span class="font-mono text-[12px] text-on-surface-variant">' + (function () { let u = 0; try { for (let i = 0; i < localStorage.length; i++) u += (localStorage.getItem(localStorage.key(i)) || '').length; } catch (e) { } return bytes(u); })() + '</span>') +
            '<div class="pt-4 mt-2 border-t border-outline-variant/20">' +
            row('Reset everything', 'Delete all settings, apps, bookmarks and notes', btn('s-reset', 'Reset', 'delete_forever', 'danger')) +
            '</div></div>',
        about: () => '<div class="space-y-3">' +
            '<div class="p-4 rounded-2xl bg-surface-container-high/50">' +
            '<div class="flex items-center gap-3 mb-2"><span class="material-symbols-outlined text-secondary text-[24px]">blur_on</span>' +
            '<div><div class="font-headline-sm text-headline-sm text-on-surface">Fluent Start</div>' +
            '<div class="font-body-sm text-body-sm text-on-surface-variant">Version 3.1 · Local-first start page</div></div></div>' +
            '<p class="font-body-sm text-body-sm text-on-surface-variant">A fully offline-capable browser start page. Settings, shortcuts, bookmarks, notes and playlists live only on this device. Weather and news requests go directly from your browser to public APIs.</p>' +
            '</div>' +
            '<div class="grid grid-cols-2 gap-3">' +
            '<div class="p-3 rounded-xl bg-surface-container-high/40"><div class="font-label-sm text-label-sm text-on-surface-variant">Engine</div><div class="font-label-md text-label-md text-on-surface">Vanilla JS · zero deps</div></div>' +
            '<div class="p-3 rounded-xl bg-surface-container-high/40"><div class="font-label-sm text-label-sm text-on-surface-variant">Storage</div><div class="font-label-md text-label-md text-on-surface">localStorage + IndexedDB</div></div>' +
            '</div>' +
            '<div class="p-3 rounded-xl bg-surface-container-high/40"><div class="font-label-sm text-label-sm text-on-surface-variant mb-1">Keyboard shortcuts</div>' +
            '<div class="grid grid-cols-2 gap-1.5 font-mono text-[11px] text-on-surface">' +
            ['/ — focus search', 'Esc — dismiss', 'W — wallpaper', 'B — bookmark', '1–6 — filter dock', 'T — cycle theme', ', — settings', '? — shortcut sheet', 'Ctrl/⌘+K — palette', 'P — play / pause', 'N — new task', 'E — new event', 'F — focus timer'].map(s => '<div class="px-2 py-1 rounded bg-surface-container-high/60">' + s + '</div>').join('') +
            '</div></div></div>'
    };

    const SETTINGS_BIND = {
        general(panel) {
            panel.querySelector('#s-name').addEventListener('input', e => { state.user.name = e.target.value || 'Friend'; persist(); tickClock(); });
            panel.querySelector('#s-theme').addEventListener('change', e => { state.theme = e.target.value; persist(); applyTheme(); });
            bindSw(panel, 's-greet', 'greetingEnabled', () => tickClock());
            bindSw(panel, 's-clock24', 'clock24', () => tickClock());
            bindSw(panel, 's-secs', 'showSeconds', () => tickClock());
            bindSw(panel, 's-motion', 'reduceMotion', () => applyTheme());
            const lp = panel.querySelector('#s-lowperf');
            if (lp) lp.onclick = () => { perf.lowEnd = !perf.lowEnd; lp.classList.toggle('on', perf.lowEnd); document.documentElement.classList.toggle('low-perf', perf.lowEnd); localStorage.setItem('fluent-lowperf', perf.lowEnd ? '1' : '0'); };
        },
        appearance(panel, m) {
            panel.querySelector('#s-wall').onclick = () => { m.close(); openWallpaperPicker(); };
            const blur = panel.querySelector('#s-blur');
            blur.addEventListener('input', () => {
                document.documentElement.style.setProperty('--glass-blur', blur.value + 'px');
                localStorage.setItem('fluent-blur', blur.value);
            });
            panel.querySelector('#s-reset-app').onclick = () => {
                state.wallpaper = { type: 'preset', id: 'neo-tokyo' };
                state.theme = 'dark';
                document.documentElement.style.setProperty('--glass-blur', '22px');
                localStorage.removeItem('fluent-blur');
                persist(); applyTheme(); applyWallpaper(true);
                toast('Appearance reset', 'success');
            };
        },
        search(panel) {
            panel.querySelector('#s-engine').addEventListener('change', e => { state.engine = e.target.value; persist(); renderEngines(); });
            bindSw(panel, 's-newtab', 'searchInNewTab');
            panel.querySelectorAll('[data-h]').forEach(b => b.onclick = () => { state.history.splice(+b.dataset.h, 1); persist(); b.parentElement.remove(); toast('Removed'); });
            panel.querySelector('#s-clear-history').onclick = () => { state.history = []; persist(); openSettings('search'); toast('History cleared', 'success'); };
        },
        data(panel, m) {
            panel.querySelector('#s-export').onclick = exportData;
            panel.querySelector('#s-import').onclick = importData;
            panel.querySelector('#s-export-bm').onclick = () => exportBookmarks('html');
            panel.querySelector('#s-vault').onclick = () => { m.close(); openVaultDialog(); };
            panel.querySelector('#s-reset').onclick = () => {
                openModal({
                    title: 'Reset everything?', icon: 'warning', width: 'max-w-sm',
                    onOk: async () => { localStorage.clear(); sessionStorage.clear(); try { await idb.clear('wallpapers'); await idb.clear('media'); } catch (e) { } location.reload(); }
                }).body.innerHTML = '<p class="font-body-md text-body-md text-on-surface-variant">This permanently deletes all apps, bookmarks, tasks, events, feeds, playlists, wallpapers and settings from this device. This cannot be undone.</p>';
            };
        }
    };

    function bindSw(panel, id, key, cb) {
        const el = panel.querySelector('#' + id);
        if (!el) return;
        el.onclick = () => {
            state[key] = !state[key];
            el.classList.toggle('on', state[key]);
            persist(); cb && cb();
        };
    }

    function exportData() {
        const payload = { app: 'fluent-start', version: 3, exported: new Date().toISOString(), state };
        download('fluent-start-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(payload, null, 2), 'application/json');
        toast('Backup downloaded', 'success');
    }
    function importData() {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'application/json';
        inp.onchange = () => {
            const f = inp.files[0]; if (!f) return;
            const r = new FileReader();
            r.onload = () => {
                try {
                    const j = JSON.parse(r.result);
                    const incoming = j.state || j;
                    if (!incoming.apps && !incoming.todos && !incoming.bookmarks) throw new Error('Unrecognised backup');
                    mergeInto(defaultState(), incoming);
                    persistNow(); applyTheme(); applyWallpaper(true); renderAll();
                    toast('Backup restored', 'success');
                } catch (e) { toast('Invalid backup file', 'error'); }
            };
            r.readAsText(f);
        };
        inp.click();
    }

    /* ══════════════════════════════════════════════════════════════════════════
       VIEWS / NAV
       ══════════════════════════════════════════════════════════════════════════ */
    const VIEW_IDS = { home: 'view-home', bookmarks: 'view-bookmarks', library: 'view-library', widgets: 'view-widgets' };
    let currentView = 'home';
    function switchView(view) {
        currentView = view;
        Object.keys(VIEW_IDS).forEach(k => {
            const el = document.getElementById(VIEW_IDS[k]);
            if (el) el.classList.toggle('active', k === view);
        });
        $$('.nav-link').forEach(a => {
            const on = a.dataset.path === view;
            a.className = 'nav-link px-3 py-1 rounded-full transition-colors font-label-md text-label-md ' +
                (on ? 'bg-surface-container text-on-surface font-semibold' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high');
        });
        if (view === 'library') renderLibrary();
        if (view === 'widgets') renderWidgetManager();
        if (view === 'bookmarks') { renderFolderChips(); renderBookmarks(); }
    }

    /* ══════════════════════════════════════════════════════════════════════════
       SHORTCUTS SHEET
       ══════════════════════════════════════════════════════════════════════════ */
    function openShortcuts() {
        const rows = [
            ['/', 'Focus search'], ['Esc', 'Dismiss / close'], ['Ctrl / ⌘ + K', 'Command palette'], ['Ctrl / ⌘ + Shift + K', 'Focus search'], ['Enter', 'Run search'],
            ['W', 'Open wallpaper picker'], ['B', 'Save a bookmark'], ['1 – 6', 'Filter quick-access dock'], ['A', 'Add a new app'],
            ['N', 'Focus scratchpad'], ['E', 'Add event'], ['P', 'Play / pause music'], ['F', 'Focus timer'], ['T', 'Cycle theme'], [',', 'Open settings'],
            ['?', 'Show shortcuts'], ['Ctrl / ⌘ + S', 'Export backup']
        ];
        openModal({
            title: 'Keyboard shortcuts', icon: 'keyboard', width: 'max-w-md', footer: false,
            body: '<div class="space-y-1.5">' + rows.map(r =>
                '<div class="flex items-center justify-between gap-4 py-2 border-b border-outline-variant/20 last:border-0">' +
                '<span class="font-body-md text-body-md text-on-surface-variant">' + esc(r[1]) + '</span>' +
                '<kbd class="px-2 py-1 rounded-md bg-surface-container-high/70 font-mono text-[11px] text-on-surface whitespace-nowrap">' + esc(r[0]) + '</kbd>' +
                '</div>').join('') + '</div>'
        });
    }

    /* ══════════════════════════════════════════════════════════════════════════
       KEYBOARD
       ══════════════════════════════════════════════════════════════════════════ */
    function isTyping(e) {
        const t = e.target;
        return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    }
    function cycleTheme() {
        const order = ['dark', 'light', 'auto'];
        state.theme = order[(order.indexOf(state.theme) + 1) % order.length];
        persist(); applyTheme();
        toast('Theme: ' + state.theme);
    }
    function bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            const modalOpen = $('#modal-root').children.length > 0;
            if (e.key === 'Escape') {
                if (modalOpen) return;
                hideSuggestions();
                if (document.activeElement === $('#omnibox')) $('#omnibox').blur();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !e.shiftKey) { e.preventDefault(); Palette.open(); return; }
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'k') { e.preventDefault(); switchView('home'); $('#omnibox').focus(); return; }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); exportData(); return; }
            if (modalOpen || isTyping(e)) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            const k = e.key;
            if (k === '/') { e.preventDefault(); switchView('home'); $('#omnibox').focus(); return; }
            if (k === '?') { e.preventDefault(); openShortcuts(); return; }
            if (k === ',') { e.preventDefault(); openSettings(); return; }
            if (k === 'w' || k === 'W') { e.preventDefault(); openWallpaperPicker(); return; }
            if (k === 't' || k === 'T') { e.preventDefault(); cycleTheme(); return; }
            if (k === 'a' || k === 'A') { e.preventDefault(); openAppEditor(null); return; }
            if (k === 'b' || k === 'B') { e.preventDefault(); openBookmarkEditor(null); return; }
            if (k === 'p' || k === 'P') { e.preventDefault(); player.toggle(); return; }
            if (k === 'f' || k === 'F') { e.preventDefault(); FocusTimer.onClick(); return; }
            if (k === 'n' || k === 'N') { e.preventDefault(); const i = $('#todo-input'); if (i) i.focus(); return; }
            if (k === 'e' || k === 'E') { e.preventDefault(); openEventEditor(null); return; }
            if (/^[1-6]$/.test(k)) {
                const c = CATEGORIES[+k - 1];
                if (c) { state.appFilter = c.id; persist(); renderFilters(); renderDock(); }
            }
        }, { passive: false });
    }

    /* ══════════════════════════════════════════════════════════════════════════
       RENDER ALL
       ══════════════════════════════════════════════════════════════════════════ */
    function renderAll() {
        applyTheme();
        renderEngines();
        renderFilters();
        renderDock();
        renderWidgetGrid();
        renderLibrary();
        renderFolderChips();
        renderBookmarks();
        tickClock();
        paintSecurity();
    }

    /* ══════════════════════════════════════════════════════════════════════════
       GLOBAL UI WIRING
       ══════════════════════════════════════════════════════════════════════════ */
    const sessionStart = Date.now();

    function bindGlobalUI() {
        $('#main-nav').addEventListener('click', e => {
            const a = e.target.closest('.nav-link'); if (!a) return;
            e.preventDefault();
            switchView(a.dataset.path);
        });

        $('#theme-switch').addEventListener('click', e => {
            const b = e.target.closest('.theme-btn'); if (!b) return;
            state.theme = b.dataset.theme; persist(); applyTheme();
        });

        $('#settings-btn').onclick = () => openSettings();
        $('#wallpaper-btn').onclick = () => openWallpaperPicker();
        $('#ambience-btn').onclick = () => openWallpaperPicker();
        $('#help-btn').onclick = () => openShortcuts();
        $('#quick-bookmark-btn').onclick = () => openBookmarkEditor(null);
        $('#profile-btn').onclick = () => {
            const m = openModal({
                title: 'Profile', icon: 'person', width: 'max-w-sm',
                onOk: () => { const v = m.panel.querySelector('#p-name').value.trim(); if (v) { state.user.name = v; persist(); tickClock(); toast('Name updated', 'success'); } }
            });
            m.body.innerHTML = field('p-name', 'Display name', state.user.name) +
                '<div class="mt-4 grid grid-cols-2 gap-3">' +
                '<div class="p-3 rounded-xl bg-surface-container-high/50"><div class="font-label-sm text-label-sm text-on-surface-variant">Apps</div><div class="font-headline-sm text-headline-sm text-on-surface">' + state.apps.length + '</div></div>' +
                '<div class="p-3 rounded-xl bg-surface-container-high/50"><div class="font-label-sm text-label-sm text-on-surface-variant">Bookmarks</div><div class="font-headline-sm text-headline-sm text-on-surface">' + state.bookmarks.length + '</div></div>' +
                '</div>';
        };

        const omni = $('#omnibox');
        omni.addEventListener('input', debounce(() => showSuggestions(omni.value), 90));
        omni.addEventListener('focus', () => { $('#omnibox-glow').style.opacity = '1'; showSuggestions(omni.value); });
        omni.addEventListener('blur', () => { setTimeout(hideSuggestions, 120); $('#omnibox-glow').style.opacity = ''; });
        omni.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); executeSearch(omni.value); }
            if (e.key === 'Escape') { omni.value = ''; hideSuggestions(); omni.blur(); }
        });

        $('#mic-btn').onclick = () => {
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SR) { toast('Voice search not supported', 'warn'); return; }
            const rec = new SR();
            rec.lang = navigator.language || 'en-US';
            rec.interimResults = false;
            toast('Listening…');
            rec.onresult = ev => { const t = ev.results[0][0].transcript; omni.value = t; executeSearch(t); };
            rec.onerror = () => toast('Voice input failed', 'warn');
            rec.start();
        };
        $('#lens-btn').onclick = () => {
            const inp = document.createElement('input');
            inp.type = 'file'; inp.accept = 'image/*';
            inp.onchange = () => { if (inp.files[0]) window.open('https://lens.google.com/', '_blank'); };
            inp.click();
        };

        $('#engine-tabs').addEventListener('click', e => {
            const b = e.target.closest('.engine-tab'); if (!b) return;
            state.engine = b.dataset.engine; persist(); renderEngines(); omni.focus();
        });

        $('#app-filters').addEventListener('click', e => {
            const b = e.target.closest('.app-filter'); if (!b) return;
            state.appFilter = b.dataset.cat; persist(); renderFilters(); renderDock();
        });

        $('#library-search').addEventListener('input', debounce(e => { libraryQuery = e.target.value.toLowerCase().trim(); renderLibrary(); }, 140));
        $('#library-add').onclick = () => openAppEditor(null);
        $('#library-filters').addEventListener('click', e => {
            const b = e.target.closest('.lib-filter'); if (!b) return;
            libraryFilter = b.dataset.cat; renderLibrary();
        });

        $('#bm-search').addEventListener('input', debounce(e => { state.bmQuery = e.target.value; renderBookmarks(); }, 140));
        $('#bm-add').onclick = () => openBookmarkEditor(null);
        $('#bm-import').onclick = openImportDialog;
        $('#bm-export').onclick = () => exportBookmarks('html');
        $('#bm-view-toggle').onclick = () => {
            state.bmView = state.bmView === 'grid' ? 'list' : 'grid';
            persist();
            const ic = $('#bm-view-icon'); if (ic) ic.textContent = state.bmView === 'grid' ? 'grid_view' : 'list';
            renderBookmarks();
        };
        $('#bm-sort').onclick = () => {
            const opts = ['recent', 'added', 'name', 'visits', 'manual'];
            const labels = { recent: 'Recent', added: 'Newest', name: 'A–Z', visits: 'Most opened', manual: 'Manual' };
            const next = opts[(opts.indexOf(state.bmSort) + 1) % opts.length];
            state.bmSort = next; persist();
            $('#bm-sort-label').textContent = labels[next];
            renderBookmarks();
        };
        $('#bm-folders').addEventListener('click', e => {
            const chip = e.target.closest('.bm-folder-chip'); if (!chip) return;
            if (chip.id === 'bm-add-folder') { openAddFolderDialog(); return; }
            state.bmFilter = chip.dataset.f || 'all';
            persist(); renderFolderChips(); renderBookmarks();
        });

        document.addEventListener('click', e => {
            if (e.target.closest('#ev-add')) { openEventEditor(null); return; }
            if (e.target.closest('#todo-add')) { addTodo(); return; }
            if (e.target.closest('#weather-city-btn')) { openCityPicker(); return; }
            if (e.target.closest('#feeds-refresh')) { loadFeeds(true); toast('Refreshing feeds…'); return; }
            if (e.target.closest('#feeds-config')) { openFeedConfig(); return; }
            if (e.target.closest('#sec-vault-btn')) { openVaultDialog(); return; }
            if (e.target.closest('#sec-audit')) { openAuditLog(); return; }
            if (e.target.closest('#sec-dns')) { openDnsPicker(); return; }
        }, { passive: true });
        document.addEventListener('keydown', e => {
            if (e.target.id === 'todo-input' && e.key === 'Enter') addTodo();
        });

        window.addEventListener('online', () => { const s = $('#footer-status'); if (s) s.textContent = 'Local Sandbox Online'; });
        window.addEventListener('offline', () => { const s = $('#footer-status'); if (s) s.textContent = 'Offline — using cached data'; });
    }

    function openDnsPicker() {
        const opts = ['1.1.1.1 (DoH)', '8.8.8.8 (DoH)', '9.9.9.9 (Quad9)', 'dns.adguard.com', 'System default'];
        const m = openModal({
            title: 'DNS resolver', icon: 'dns', width: 'max-w-sm',
            onOk: () => { state.security.dns = m.panel.querySelector('#dns-sel').value; persist(); paintSecurity(); toast('Preference saved', 'success'); }
        });
        m.body.innerHTML = '<p class="font-body-sm text-body-sm text-on-surface-variant mb-3">This is a saved preference — your browser\'s actual DNS is controlled by your OS or browser settings.</p>' +
            select('dns-sel', 'Preferred resolver', state.security.dns, opts.map(o => ({ v: o, l: o })));
    }

    /* ══════════════════════════════════════════════════════════════════════════
       LOCK SCREEN
       ══════════════════════════════════════════════════════════════════════════ */
    function showUnlock() {
        const ov = $('#unlock-overlay');
        ov.classList.remove('hidden'); ov.classList.add('flex');
        ov.innerHTML =
            '<div class="w-full max-w-sm p-6 rounded-2xl acrylic-strong rim pop text-center">' +
            '<span class="material-symbols-outlined text-secondary text-[40px] mb-2">lock</span>' +
            '<h2 class="font-headline-sm text-headline-sm text-on-surface mb-1">Vault locked</h2>' +
            '<p class="font-body-sm text-body-sm text-on-surface-variant mb-5">Enter your passphrase to decrypt your start page.</p>' +
            '<input id="unlock-pass" type="password" placeholder="Passphrase" class="w-full h-11 px-4 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:border-secondary/70 text-center"/>' +
            '<button id="unlock-go" class="mt-4 w-full h-11 rounded-xl bg-primary-container text-on-primary-container font-label-lg text-label-lg font-semibold hover:brightness-110 transition">Unlock</button>' +
            '<button id="unlock-wipe" class="mt-3 font-label-sm text-label-sm text-on-surface-variant hover:text-error transition">Forget this vault</button>' +
            '</div>';
        const go = async () => {
            const pass = $('#unlock-pass').value;
            if (!pass) return;
            try {
                const env = JSON.parse(localStorage.getItem(LS_WRAP));
                const salt = localStorage.getItem('fluent-start-salt');
                const dk = await deriveKey(pass, salt);
                const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, dk.key, unb64(env.data));
                const obj = JSON.parse(new TextDecoder().decode(pt));
                cryptoKey = dk.key;
                mergeInto(defaultState(), obj);
                ov.classList.add('hidden'); ov.classList.remove('flex');
                boot();
                toast('Vault unlocked', 'success');
            } catch (e) {
                toast('Incorrect passphrase', 'error');
                $('#unlock-pass').value = '';
            }
        };
        $('#unlock-go').onclick = go;
        $('#unlock-pass').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
        $('#unlock-wipe').onclick = () => {
            openModal({
                title: 'Forget vault?', icon: 'warning', width: 'max-w-sm',
                onOk: () => { localStorage.removeItem(LS_WRAP); localStorage.removeItem('fluent-start-salt'); location.reload(); }
            }).body.innerHTML = '<p class="font-body-md text-body-md text-on-surface-variant">Your encrypted data will be deleted permanently. This cannot be undone.</p>';
        };
        setTimeout(() => { const el = $('#unlock-pass'); if (el) el.focus(); }, 100);
    }

    /* ══════════════════════════════════════════════════════════════════════════
       FOCUS TIMER (Pomodoro)
       ══════════════════════════════════════════════════════════════════════════ */
    const FocusTimer = {
        pill: null, label: null, icon: null,
        PRESETS: [
            { key: '25/5', focus: 25, break: 5, label: 'Pomodoro · 25 min' },
            { key: '50/10', focus: 50, break: 10, label: 'Deep work · 50 min' },
            { key: '15/5', focus: 15, break: 5, label: 'Quick sprint · 15 min' },
            { key: '90/20', focus: 90, break: 20, label: 'Ultradian · 90 min' }
        ],

        init() {
            this.pill = $('#focus-pill');
            this.label = $('#focus-label');
            this.icon = $('#focus-icon');
            if (!this.pill) return;
            this.pill.onclick = () => this.onClick();
            if (state.focus && state.focus.endsAt) this.resumeFromState();
            this.render();
        },

        resumeFromState() {
            const f = state.focus;
            if (f.paused) return;
            if (f.endsAt > Date.now()) return;
            f.endsAt = 0;
            persist();
        },

        onClick() {
            const f = state.focus || (state.focus = {});
            if (f.endsAt && !f.paused) { this.pause(); return; }
            if (f.endsAt && f.paused) { this.resume(); return; }
            this.openMenu();
        },

        openMenu() {
            const m = openModal({ title: 'Focus timer', icon: 'timer', width: 'max-w-md', footer: false });
            const running = state.focus && state.focus.endsAt;
            m.body.innerHTML =
                (running ?
                    '<div class="p-4 rounded-xl bg-tertiary-container/40 mb-4 text-center">' +
                    '<div class="font-headline-lg text-headline-lg text-on-surface tabular-nums" id="fm-countdown">--:--</div>' +
                    '<div class="font-body-sm text-body-sm text-on-surface-variant mt-1" id="fm-label">In progress</div>' +
                    '<div class="flex items-center justify-center gap-2 mt-3">' +
                    '<button id="fm-pause" class="h-9 px-4 rounded-full bg-surface-container-high/70 text-on-surface font-label-md text-label-md hover:bg-surface-container-highest transition">' + (state.focus.paused ? 'Resume' : 'Pause') + '</button>' +
                    '<button id="fm-end" class="h-9 px-4 rounded-full bg-error-container/70 text-on-error-container font-label-md text-label-md hover:bg-error-container transition">End</button>' +
                    '</div>' +
                    '</div>' : '') +
                '<div class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">Start a session</div>' +
                '<div class="space-y-2">' +
                this.PRESETS.map(p =>
                    '<button data-preset="' + p.key + '" class="w-full flex items-center justify-between p-3 rounded-xl bg-surface-container-high/50 hover:bg-surface-container-high/80 transition text-left">' +
                    '<div><div class="font-label-md text-label-md text-on-surface">' + esc(p.label) + '</div>' +
                    '<div class="font-body-sm text-body-sm text-on-surface-variant">' + p.focus + ' min work · ' + p.break + ' min break</div></div>' +
                    '<span class="material-symbols-outlined text-tertiary">play_arrow</span>' +
                    '</button>').join('') +
                '</div>' +
                '<div class="mt-4 pt-4 border-t border-outline-variant/20">' +
                '<label class="block"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Custom (minutes)</span>' +
                '<div class="flex gap-2 mt-1">' +
                '<input id="fm-custom" type="number" min="1" max="240" placeholder="25" class="flex-1 h-10 px-3 rounded-xl bg-surface-container-high/60 border border-outline-variant/40 text-on-surface font-body-md text-body-md focus:outline-none focus:border-secondary/70"/>' +
                '<button id="fm-custom-go" class="h-10 px-4 rounded-xl bg-primary-container text-on-primary-container font-label-md text-label-md font-semibold">Start</button>' +
                '</div></label>' +
                '</div>';

            if (running) {
                const upd = () => {
                    const cd = m.body.querySelector('#fm-countdown');
                    if (!cd || !document.contains(cd)) return;
                    cd.textContent = this.format(state.focus);
                    requestAnimationFrame(upd);
                };
                upd();
                m.body.querySelector('#fm-pause').onclick = () => { this.pause(); m.close(); };
                m.body.querySelector('#fm-end').onclick = () => { this.end(); m.close(); };
            }

            m.body.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
                const p = this.PRESETS.find(x => x.key === b.dataset.preset);
                this.start(p.focus);
                m.close();
            });
            const customGo = m.body.querySelector('#fm-custom-go');
            if (customGo) customGo.onclick = () => {
                const v = parseInt(m.body.querySelector('#fm-custom').value, 10);
                if (!v || v < 1 || v > 240) { toast('Enter a number between 1 and 240', 'warn'); return; }
                this.start(v);
                m.close();
            };
        },

        start(minutes) {
            state.focus = { endsAt: Date.now() + minutes * 60 * 1000, duration: minutes * 60 * 1000, paused: false, remaining: 0 };
            persist();
            this.render();
            toast('Focus session started · ' + minutes + ' min', 'success');
            this.requestNotifyPermission();
        },

        pause() {
            if (!state.focus || !state.focus.endsAt || state.focus.paused) return;
            state.focus.remaining = state.focus.endsAt - Date.now();
            state.focus.paused = true;
            persist(); this.render();
        },

        resume() {
            if (!state.focus || !state.focus.paused) return;
            state.focus.endsAt = Date.now() + state.focus.remaining;
            state.focus.paused = false;
            persist(); this.render();
        },

        end() {
            state.focus = { endsAt: 0, duration: state.focus.duration || 25 * 60 * 1000, paused: false, remaining: 0 };
            persist(); this.render();
            toast('Focus session ended', 'info');
        },

        tick() {
            if (!state.focus || !state.focus.endsAt || state.focus.paused) return;
            if (Date.now() >= state.focus.endsAt) {
                const mins = Math.round(state.focus.duration / 60000);
                state.focus.endsAt = 0;
                persist(); this.render();
                this.onComplete(mins);
                return;
            }
            this.render();
        },

        onComplete(mins) {
            toast('Focus session complete · ' + mins + ' min', 'success');
            const p = this.pill;
            if (p) { p.classList.add('done'); setTimeout(() => p.classList.remove('done'), 4000); }
            try {
                const ac = new (window.AudioContext || window.webkitAudioContext)();
                const o = ac.createOscillator();
                const g = ac.createGain();
                o.connect(g); g.connect(ac.destination);
                o.frequency.value = 880;
                g.gain.setValueAtTime(0.0001, ac.currentTime);
                g.gain.exponentialRampToValueAtTime(0.15, ac.currentTime + 0.05);
                g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 1.2);
                o.start(); o.stop(ac.currentTime + 1.3);
            } catch (e) { }
            if ('Notification' in window && Notification.permission === 'granted') {
                try { new Notification('Focus complete', { body: mins + ' minutes of focused work done. Time for a break.', silent: true }); } catch (e) { }
            }
        },

        requestNotifyPermission() {
            if (!('Notification' in window)) return;
            if (Notification.permission === 'default') Notification.requestPermission().catch(() => { });
        },

        format(f) {
            const ms = f.paused ? f.remaining : (f.endsAt - Date.now());
            const totalSec = Math.max(0, Math.round(ms / 1000));
            const mm = Math.floor(totalSec / 60);
            const ss = totalSec % 60;
            return pad(mm) + ':' + pad(ss);
        },

        render() {
            if (!this.pill) return;
            const f = state.focus || {};
            const running = f.endsAt && !f.paused;
            const paused = f.endsAt && f.paused;
            if (running || paused) {
                this.pill.classList.add('running');
                this.pill.classList.toggle('paused', !!paused);
                if (this.label) this.label.textContent = this.format(f);
                if (this.icon) this.icon.textContent = paused ? 'pause_circle' : 'timer';
                this.pill.title = paused ? 'Paused — click to resume' : 'Focus session running — click to pause';
            } else {
                this.pill.classList.remove('running', 'paused', 'done');
                if (this.label) this.label.textContent = 'Focus';
                if (this.icon) this.icon.textContent = 'timer';
                this.pill.title = 'Focus timer (F)';
            }
        }
    };

    /* ══════════════════════════════════════════════════════════════════════════
       COMMAND PALETTE (⌘K)
       ══════════════════════════════════════════════════════════════════════════ */
    const Palette = {
        el: null, input: null, list: null,
        items: [], filtered: [], cursor: 0, recentActions: [],

        ensure() {
            if (this.el) return;
            const root = document.createElement('div');
            root.id = 'cmdk-root';
            root.innerHTML =
                '<div class="cmdk-panel">' +
                '<div class="cmdk-input">' +
                '<span class="material-symbols-outlined text-secondary text-[20px]">bolt</span>' +
                '<input id="cmdk-input" type="text" placeholder="Search actions, apps, bookmarks…" autocomplete="off" spellcheck="false"/>' +
                '</div>' +
                '<div class="cmdk-list" id="cmdk-list"></div>' +
                '<div class="cmdk-footer">' +
                '<span><kbd>↑↓</kbd> Navigate</span>' +
                '<span><kbd>↵</kbd> Select</span>' +
                '<span><kbd>Esc</kbd> Close</span>' +
                '</div>' +
                '</div>';
            document.body.appendChild(root);
            this.el = root;
            this.input = root.querySelector('#cmdk-input');
            this.list = root.querySelector('#cmdk-list');

            root.addEventListener('mousedown', e => { if (e.target === root) this.close(); });
            this.input.addEventListener('input', debounce(() => this.refresh(), 120));
            this.input.addEventListener('keydown', e => this.onKey(e));
        },

        build() {
            const items = [];
            const q = this.input ? this.input.value.trim().toLowerCase() : '';

            if (!q && this.recentActions.length) {
                this.recentActions.slice(0, 3).forEach(id => {
                    const a = this.registry().find(x => x.id === id);
                    if (a) items.push(Object.assign({}, a, { group: 'Recent' }));
                });
            }

            const actionGroup = q ? 'Actions' : 'Quick actions';
            this.registry().forEach(a => { if (!a.hidden) items.push(Object.assign({}, a, { group: actionGroup })); });

            state.apps.forEach(a => items.push({
                id: 'app:' + a.id, group: 'Apps',
                icon: a.kind === 'symbol' ? a.icon : 'public', iconKind: a.kind,
                title: a.name, sub: hostOf(a.url),
                favicon: a.kind === 'favicon' ? faviconFor(a.url) : '',
                run: () => openApp(a)
            }));

            state.bookmarks.slice(0, 80).forEach(b => items.push({
                id: 'bm:' + b.id, group: 'Bookmarks',
                icon: 'bookmark', title: b.title, sub: hostOf(b.url),
                favicon: faviconFor(b.url),
                run: () => bookmarkOpen(b)
            }));

            state.history.slice(0, 5).forEach((h, i) => items.push({
                id: 'hist:' + i, group: 'Recent searches',
                icon: 'history', title: h.q, sub: 'Search again',
                run: () => executeSearch(h.q)
            }));

            this.items = items;
        },

        registry() {
            return [
                { id: 'act:settings', icon: 'settings', title: 'Open settings', sub: 'Preferences · theme · data', hint: ',', run: () => openSettings() },
                { id: 'act:wallpaper', icon: 'wallpaper', title: 'Change wallpaper', sub: 'Presets, URL, or upload', hint: 'W', run: () => openWallpaperPicker() },
                { id: 'act:theme', icon: 'contrast', title: 'Cycle theme', sub: 'Dark → Light → Auto', hint: 'T', run: () => cycleTheme() },
                { id: 'act:focus', icon: 'timer', title: 'Start focus timer', sub: 'Pomodoro session', hint: 'F', run: () => FocusTimer.openMenu() },
                { id: 'act:bookmark', icon: 'bookmark_add', title: 'New bookmark', sub: 'Save a page for later', hint: 'B', run: () => openBookmarkEditor(null) },
                { id: 'act:app', icon: 'add', title: 'Add new app', sub: 'Shortcut on the home dock', hint: 'A', run: () => openAppEditor(null) },
                { id: 'act:event', icon: 'event', title: 'New calendar event', sub: 'Add to today\'s schedule', hint: 'E', run: () => openEventEditor(null) },
                { id: 'act:task', icon: 'checklist', title: 'Focus scratchpad', sub: 'Jump to the task input', hint: 'N', run: () => { switchView('home'); setTimeout(() => { const i = $('#todo-input'); if (i) i.focus(); }, 100); } },
                { id: 'act:shortcuts', icon: 'keyboard', title: 'Show keyboard shortcuts', sub: 'All hotkeys at a glance', hint: '?', run: () => openShortcuts() },
                { id: 'act:export', icon: 'download', title: 'Export backup', sub: 'Download JSON of everything', hint: '⌘S', run: () => exportData() },
                { id: 'act:import', icon: 'upload', title: 'Import backup', sub: 'Restore from a JSON file', run: () => importData() },
                { id: 'act:bm-import', icon: 'upload_file', title: 'Import browser bookmarks', sub: 'Chrome, Firefox, Edge HTML', run: () => openImportDialog() },
                { id: 'act:bm-export', icon: 'save_alt', title: 'Export bookmarks as HTML', sub: 'Universal Netscape format', run: () => exportBookmarks('html') },
                { id: 'act:vault', icon: 'lock', title: cryptoKey ? 'Lock encrypted vault' : 'Enable encrypted vault', sub: 'AES-GCM 256 · local only', run: () => openVaultDialog() },
                { id: 'act:audit', icon: 'receipt_long', title: 'View audit log', sub: 'Session and storage activity', run: () => openAuditLog() },
                { id: 'act:perf', icon: 'speed', title: 'Toggle performance mode', sub: perf.lowEnd ? 'Currently ON' : 'Currently OFF', run: () => { perf.lowEnd = !perf.lowEnd; document.documentElement.classList.toggle('low-perf', perf.lowEnd); localStorage.setItem('fluent-lowperf', perf.lowEnd ? '1' : '0'); toast('Performance mode ' + (perf.lowEnd ? 'ON' : 'OFF'), 'success'); } },
                { id: 'act:nav-bm', icon: 'bookmarks', title: 'Go to Bookmarks', sub: 'All your saved pages', run: () => switchView('bookmarks') },
                { id: 'act:nav-apps', icon: 'apps', title: 'Go to Apps', sub: 'Manage quick-launch shortcuts', run: () => switchView('library') },
                { id: 'act:nav-widgets', icon: 'widgets', title: 'Go to Widgets', sub: 'Toggle dashboard panels', run: () => switchView('widgets') }
            ];
        },

        fuzzy(text, query) {
            text = text.toLowerCase(); query = query.toLowerCase();
            if (!query) return 1;
            let ti = 0, qi = 0, score = 0, lastMatch = -2;
            while (ti < text.length && qi < query.length) {
                if (text[ti] === query[qi]) {
                    score += 10;
                    if (ti === lastMatch + 1) score += 8;
                    if (ti === 0) score += 15;
                    lastMatch = ti;
                    qi++;
                }
                ti++;
            }
            return qi === query.length ? score : -1;
        },

        refresh() {
            this.build();
            const q = this.input.value.trim();
            if (!q) this.filtered = this.items.slice(0, 40);
            else {
                this.filtered = this.items
                    .map(it => ({ it, s: Math.max(this.fuzzy(it.title, q), this.fuzzy(it.sub || '', q) - 20) }))
                    .filter(x => x.s > 0)
                    .sort((a, b) => b.s - a.s)
                    .slice(0, 40)
                    .map(x => x.it);
            }
            this.cursor = 0;
            this.render();
        },

        render() {
            if (!this.filtered.length) {
                this.list.innerHTML = '<div class="cmdk-empty">No matches. Try a different search.</div>';
                return;
            }
            const groups = {};
            this.filtered.forEach((it, i) => {
                if (!groups[it.group]) groups[it.group] = [];
                groups[it.group].push({ it, i });
            });
            let html = '';
            Object.keys(groups).forEach(g => {
                html += '<div class="cmdk-group">' + esc(g) + '</div>';
                groups[g].forEach(({ it, i }) => {
                    const sel = i === this.cursor ? ' selected' : '';
                    const iconHTML = it.favicon
                        ? '<img src="' + it.favicon + '" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'material-symbols-outlined\',textContent:\'' + (it.icon || 'public') + '\'}))"/>'
                        : '<span class="material-symbols-outlined">' + (it.icon || 'circle') + '</span>';
                    html += '<div class="cmdk-item' + sel + '" data-i="' + i + '">' +
                        '<div class="ico">' + iconHTML + '</div>' +
                        '<div class="meta"><div class="t">' + esc(it.title) + '</div>' +
                        (it.sub ? '<div class="s">' + esc(it.sub) + '</div>' : '') + '</div>' +
                        (it.hint ? '<span class="kbd">' + esc(it.hint) + '</span>' : '') +
                        '</div>';
                });
            });
            this.list.innerHTML = html;
            this.list.querySelectorAll('.cmdk-item').forEach(el => {
                el.addEventListener('mousedown', e => { e.preventDefault(); this.select(+el.dataset.i); });
            });
            const sel = this.list.querySelector('.cmdk-item.selected');
            if (sel) sel.scrollIntoView({ block: 'nearest' });
        },

        onKey(e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); this.cursor = Math.min(this.cursor + 1, this.filtered.length - 1); this.render(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); this.cursor = Math.max(this.cursor - 1, 0); this.render(); }
            else if (e.key === 'Enter') { e.preventDefault(); this.select(this.cursor); }
            else if (e.key === 'Escape') { e.preventDefault(); this.close(); }
            else if (e.key === 'Tab') { e.preventDefault(); }
        },

        select(i) {
            const it = this.filtered[i];
            if (!it) return;
            if (it.id && it.id.startsWith('act:')) this.recentActions = [it.id, ...this.recentActions.filter(x => x !== it.id)].slice(0, 5);
            this.close();
            setTimeout(() => { try { it.run(); } catch (err) { console.warn(err); } }, 40);
        },

        open() {
            this.ensure();
            this.el.classList.add('on');
            this.input.value = '';
            document.body.style.overflow = 'hidden';
            this.refresh();
            setTimeout(() => this.input.focus(), 30);
        },

        close() {
            if (!this.el) return;
            this.el.classList.remove('on');
            document.body.style.overflow = '';
            this.input.blur();
        }
    };

    /* ══════════════════════════════════════════════════════════════════════════
       AUTO-HIDE CHROME
       ══════════════════════════════════════════════════════════════════════════ */
    (function () {
        let lastY = window.scrollY, hidden = false, ticking = false;
        const THRESHOLD = 120, DELTA = 8;
        const update = () => {
            ticking = false;
            const y = window.scrollY;
            const goingDown = y > lastY + DELTA, goingUp = y < lastY - DELTA;
            lastY = y;
            if (y < THRESHOLD) {
                if (hidden) { hidden = false; document.body.classList.remove('chrome-hidden'); }
                return;
            }
            if (goingDown && !hidden) { hidden = true; document.body.classList.add('chrome-hidden'); }
            if (goingUp && hidden) { hidden = false; document.body.classList.remove('chrome-hidden'); }
        };
        window.addEventListener('scroll', () => {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });

        const mo = new MutationObserver(() => {
            if (hidden && document.getElementById('modal-root').children.length) {
                hidden = false; document.body.classList.remove('chrome-hidden');
            }
        });
        const mr = document.getElementById('modal-root');
        if (mr) mo.observe(mr, { childList: true });
    })();

    /* ══════════════════════════════════════════════════════════════════════════
   SCROLL PERFORMANCE — registers at module load, fires for every session
   ══════════════════════════════════════════════════════════════════════════ */
    (function scrollPerformance() {
        let idleTimer = null;
        const begin = () => { if (!document.body.classList.contains('scrolling')) document.body.classList.add('scrolling'); };
        const end = () => { document.body.classList.remove('scrolling'); };

        const onWheel = () => { begin(); clearTimeout(idleTimer); idleTimer = setTimeout(end, 150); };
        const onTouch = () => { begin(); clearTimeout(idleTimer); idleTimer = setTimeout(end, 150); };
        window.addEventListener('wheel', onWheel, { passive: true });
        window.addEventListener('touchmove', onTouch, { passive: true });

        let scrollIdle = null;
        window.addEventListener('scroll', () => {
            begin();
            clearTimeout(scrollIdle);
            scrollIdle = setTimeout(end, 150);
        }, { passive: true });

        if ('onscrollend' in window) {
            window.addEventListener('scrollstart', begin, { passive: true });
            window.addEventListener('scrollend', () => {
                clearTimeout(scrollIdle);
                clearTimeout(idleTimer);
                end();
            }, { passive: true });
        }

        window.__scrollPerfReady = true;
    })();

    /* ══════════════════════════════════════════════════════════════════════════
       BOOT
       ══════════════════════════════════════════════════════════════════════════ */
    let booted = false;
    function boot() {
        if (booted) return; booted = true;

        const savedBlur = localStorage.getItem('fluent-blur');
        if (savedBlur) document.documentElement.style.setProperty('--glass-blur', savedBlur + 'px');
        const savedLp = localStorage.getItem('fluent-lowperf');
        if (savedLp === '1') { perf.lowEnd = true; document.documentElement.classList.add('low-perf'); }

        bindGlobalUI();
        bindKeyboard();
        renderAll();
        applyWallpaper(true);
        player.init();
        FocusTimer.init();

        Ticker.add('clock', 1000, tickClock);
        Ticker.add('focus', 1000, () => FocusTimer.tick());
        Ticker.add('telemetry', 5000, paintTelemetry);        // was 2000
        Ticker.add('security', 15000, paintSecurity);          // was 6000
        Ticker.add('weather', 10 * 60 * 1000, () => fetchWeather(true));
        Ticker.add('feeds', 5 * 60 * 1000, () => loadFeeds(true));
        Ticker.add('battery', 60 * 1000, refreshBattery);      // was 30 * 1000
        Ticker.start();

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) { tickClock(); paintTelemetry(); paintSecurity(); }
        });

        fetchWeather(false);
        loadFeeds(false);
        paintTelemetry();
        paintSecurity();
        refreshBattery();

        window.addEventListener('beforeunload', persistNow);

        setTimeout(() => {
            if (!localStorage.getItem('fluent-welcomed')) {
                localStorage.setItem('fluent-welcomed', '1');
                toast('Welcome! Press ⌘K for the command palette.', 'success');
            }
        }, 900);
    }

    /* ══════════════════════════════════════════════════════════════════════════
       ENTRY POINT — always the last thing to run
       ══════════════════════════════════════════════════════════════════════════ */
    (function start() {
        perf.detect();
        if (hasEncryptedVault()) {
            showUnlock();
            document.documentElement.classList.add('dark');
        } else {
            loadState();
            boot();
        }
    })();

})();