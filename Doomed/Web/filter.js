/*
 * Doomed — filter injected into instagram.com and m.youtube.com.
 *
 * - Hides Reels / Explore / Shorts entry points with CSS.
 * - Redirects feed URLs (infinite scroll) to non-scroll pages:
 *     instagram /reels/<id>/  -> /reel/<id>/   (a single reel, e.g. sent in DM)
 *     instagram /reels/       -> /direct/inbox/
 *     youtube   /shorts/<id>  -> /watch?v=<id> (classic player, no swipe)
 * - Same file is loaded by Node for unit tests (see tests/filter.test.js).
 */
(function (root) {
  'use strict';

  var DEFAULTS = {
    hideReels: true,
    hideExplore: true,
    hideHomeFeed: false,
    hideShorts: true
  };

  var IG_INBOX = 'https://www.instagram.com/direct/inbox/';

  function siteOf(hostname) {
    var h = String(hostname || '').toLowerCase();
    if (h === 'instagram.com' || h.slice(-14) === '.instagram.com') return 'instagram';
    if (h === 'youtube.com' || h.slice(-12) === '.youtube.com') return 'youtube';
    return null;
  }

  function withDefaults(cfg) {
    var out = {};
    for (var k in DEFAULTS) out[k] = DEFAULTS[k];
    if (cfg) for (var j in cfg) out[j] = cfg[j];
    return out;
  }

  function decideInstagram(u, cfg) {
    var p = u.pathname;

    if (cfg.hideReels) {
      // Reels feed with an id: keep the content, drop the swipe feed.
      var m = p.match(/^\/reels\/([A-Za-z0-9_-]+)\/?$/);
      if (m && m[1] !== 'audio') return u.origin + '/reel/' + m[1] + '/';
      // Reels tab, reels audio pages, etc.
      if (/^\/reels(\/|$)/.test(p)) return IG_INBOX;
      // Reels grid on a profile: /<user>/reels/
      var prof = p.match(/^\/([^/]+)\/reels\/?$/);
      if (prof) return u.origin + '/' + prof[1] + '/';
    }

    if (cfg.hideExplore && /^\/explore(\/|$)/.test(p)) return IG_INBOX;

    if (cfg.hideHomeFeed && (p === '/' || p === '')) return IG_INBOX;

    return null;
  }

  function decideYouTube(u, cfg) {
    if (!cfg.hideShorts) return null;
    var p = u.pathname;

    var m = p.match(/^\/shorts\/([A-Za-z0-9_-]+)\/?$/);
    if (m) return u.origin + '/watch?v=' + m[1];

    if (/^\/shorts\/?$/.test(p) || /^\/feed\/shorts\/?$/.test(p)) return u.origin + '/';

    var ch = p.match(/^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)\/shorts\/?$/);
    if (ch) return u.origin + '/' + ch[1];

    return null;
  }

  /** Returns a redirect URL for `href`, or null when the page is allowed. */
  function decide(href, cfg) {
    cfg = withDefaults(cfg);
    var u;
    try { u = new URL(href); } catch (e) { return null; }
    var site = siteOf(u.hostname);
    var target = null;
    if (site === 'instagram') target = decideInstagram(u, cfg);
    else if (site === 'youtube') target = decideYouTube(u, cfg);
    return target && target !== u.href ? target : null;
  }

  var HIDE = '{display:none!important}';

  function cssFor(site, cfg) {
    cfg = withDefaults(cfg);
    var rules = [];
    if (site === 'instagram') {
      if (cfg.hideReels) {
        rules.push('a[href="/reels/"],a[href^="/reels/"],a[href$="/reels/"]' + HIDE);
      }
      if (cfg.hideExplore) {
        rules.push('a[href^="/explore"]' + HIDE);
      }
      // hideHomeFeed is handled by the "/" -> inbox redirect only.
    } else if (site === 'youtube' && cfg.hideShorts) {
      rules.push([
        'ytm-reel-shelf-renderer',
        'ytm-shorts-lockup-view-model',
        'ytm-shorts-lockup-view-model-v2',
        'ytm-rich-section-renderer:has(ytm-reel-shelf-renderer)',
        'ytm-rich-section-renderer:has(ytm-shorts-lockup-view-model)',
        'ytm-rich-section-renderer:has(ytm-shorts-lockup-view-model-v2)',
        'ytm-rich-item-renderer:has(a[href^="/shorts/"])',
        'ytm-video-with-context-renderer:has(a[href^="/shorts/"])',
        'ytm-compact-video-renderer:has(a[href^="/shorts/"])',
        'ytm-pivot-bar-item-renderer:has(.pivot-shorts)',
        'a[href^="/shorts"]'
      ].join(',') + HIDE);
    }
    return rules.join('\n');
  }

  // ---------------------------------------------------------------- browser

  /** Stops redirect loops if Instagram/YouTube bounce us back. */
  function redirectAllowed(win, target) {
    try {
      var key = 'doomed:last-redirect';
      var now = Date.now();
      var rec = JSON.parse(win.sessionStorage.getItem(key) || 'null');
      if (rec && rec.t === target && now - rec.at < 10000) rec.n += 1;
      else rec = { t: target, n: 1, at: now };
      win.sessionStorage.setItem(key, JSON.stringify(rec));
      return rec.n <= 3;
    } catch (e) {
      return true;
    }
  }

  function install(win, rawCfg) {
    var cfg = withDefaults(rawCfg);
    var doc = win.document;
    var site = siteOf(win.location.hostname);
    if (!site) return;

    function enforce() {
      var target = decide(win.location.href, cfg);
      if (!target) return;
      if (!redirectAllowed(win, target)) {
        // Loop detected: bail out to a safe page instead of bouncing forever.
        if (site === 'instagram' && win.location.href !== IG_INBOX) win.location.replace(IG_INBOX);
        return;
      }
      win.location.replace(target);
    }

    var css = cssFor(site, cfg);
    function ensureStyle() {
      if (!css || doc.getElementById('doomed-style')) return;
      var s = doc.createElement('style');
      s.id = 'doomed-style';
      s.textContent = css;
      (doc.head || doc.documentElement).appendChild(s);
    }

    // Block clicks on feed links before the SPA router handles them.
    doc.addEventListener('click', function (e) {
      var el = e.target;
      var a = el && el.closest ? el.closest('a[href]') : null;
      if (!a) return;
      var target = decide(a.href, cfg);
      if (!target) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      win.location.assign(target);
    }, true);

    // SPA navigations do not reload the page: hook the History API.
    ['pushState', 'replaceState'].forEach(function (name) {
      var original = win.history[name];
      win.history[name] = function () {
        var ret = original.apply(this, arguments);
        enforce();
        return ret;
      };
    });
    win.addEventListener('popstate', enforce);

    enforce();
    ensureStyle();
    // Safety net: some routers keep a private reference to history methods.
    win.setInterval(function () { enforce(); ensureStyle(); }, 400);
  }

  var api = { decide: decide, siteOf: siteOf, cssFor: cssFor, DEFAULTS: DEFAULTS };

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else if (root && root.document && !root.__DOOMED_INSTALLED__) {
    root.__DOOMED_INSTALLED__ = true;
    install(root, root.__DOOMED_CONFIG__ || {});
  }
})(typeof window !== 'undefined' ? window : this);
