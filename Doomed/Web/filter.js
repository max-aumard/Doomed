/*
 * Doomed — filter injected into instagram.com and m.youtube.com.
 *
 * - Hides Reels / Explore / Shorts entry points with CSS.
 * - Redirects feed URLs (infinite scroll) to non-scroll pages:
 *     instagram /reels/<id>/  -> /reel/<id>/   (a single reel, e.g. sent in DM)
 *     instagram /reels/       -> /direct/inbox/
 *     youtube   /shorts/<id>  -> /watch?v=<id> (classic player, no swipe)
 * - Blocks ads: strips ad data from YouTube API responses, skips video ads,
 *   hides sponsored posts and ad slots.
 * - Makes the page feel like an app (no zoom, no tap highlight, no callouts).
 * - Same file is loaded by Node for unit tests (see tests/filter.test.js).
 */
(function (root) {
  'use strict';

  var DEFAULTS = {
    hideReels: true,
    hideExplore: true,
    hideHomeFeed: false,
    hideShorts: true,
    blockAds: true
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

  // ------------------------------------------------------------ redirects

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

  // ------------------------------------------------------------------ ads

  var YT_AD_KEYS = ['adPlacements', 'playerAds', 'adSlots', 'adBreakHeartbeatParams'];

  /** Removes ad payloads from YouTube player responses, in place. */
  function pruneAds(obj, depth) {
    depth = depth || 0;
    if (!obj || typeof obj !== 'object' || depth > 4) return obj;
    if (Array.isArray(obj)) {
      for (var i = 0; i < obj.length; i++) pruneAds(obj[i], depth + 1);
      return obj;
    }
    for (var k = 0; k < YT_AD_KEYS.length; k++) {
      if (Object.prototype.hasOwnProperty.call(obj, YT_AD_KEYS[k])) delete obj[YT_AD_KEYS[k]];
    }
    if (obj.playerResponse) pruneAds(obj.playerResponse, depth + 1);
    if (obj.response) pruneAds(obj.response, depth + 1);
    return obj;
  }

  var SPONSORED_LABELS = ['sponsored', 'sponsorisé', 'sponsorisée', 'publicité', 'gesponsert', 'patrocinado', 'sponsorizzato'];

  function isSponsoredLabel(text) {
    var t = String(text || '').trim().toLowerCase();
    return SPONSORED_LABELS.indexOf(t) !== -1;
  }

  // ------------------------------------------------------------------ css

  var HIDE = '{display:none!important}';

  // App feel: no grey tap flash, no long-press callout, no text selection on UI.
  var APP_FEEL_CSS =
    '*{-webkit-tap-highlight-color:transparent!important}' +
    'a,img,svg,video{-webkit-touch-callout:none!important}' +
    'html{-webkit-text-size-adjust:100%!important}';

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
      // "Use the app" banners.
      rules.push('a[href*="apps.apple.com"],a[href*="itunes.apple.com"]' + HIDE);
    } else if (site === 'youtube') {
      if (cfg.hideShorts) {
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
      if (cfg.blockAds) {
        rules.push([
          'ad-slot-renderer',
          'ytm-ad-slot-renderer',
          'ytm-rich-item-renderer:has(ad-slot-renderer)',
          'ytm-rich-item-renderer:has(ytm-ad-slot-renderer)',
          'ytm-item-section-renderer:has(ad-slot-renderer)',
          'ytm-promoted-sparkles-web-renderer',
          'ytm-promoted-sparkles-text-search-renderer',
          'ytm-promoted-video-renderer',
          'ytm-companion-ad-renderer',
          'ytm-in-feed-ad-layout-renderer',
          'ytm-display-ad-renderer',
          'ytm-statement-banner-renderer',
          'ytm-mealbar-promo-renderer',
          'ytm-engagement-panel-section-list-renderer:has(ytm-ads-engagement-panel-content-renderer)',
          '.ytp-ad-module',
          '.ytp-ad-overlay-container',
          '.ytp-ad-text-overlay',
          'ytm-paid-content-overlay-renderer',
          'ytm-upsell-dialog-renderer'
        ].join(',') + HIDE);
      }
    }
    return rules.join('\n');
  }

  // ------------------------------------------------------------- browser

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

  /** Must run before YouTube's own scripts: strips ads from API data. */
  function installYouTubeAdPruning(win) {
    var origParse = win.JSON.parse;
    win.JSON.parse = function () {
      var out = origParse.apply(this, arguments);
      try { pruneAds(out); } catch (e) { /* ignore */ }
      return out;
    };

    if (win.Response && win.Response.prototype && win.Response.prototype.json) {
      var origJson = win.Response.prototype.json;
      win.Response.prototype.json = function () {
        return origJson.apply(this, arguments).then(function (data) {
          try { pruneAds(data); } catch (e) { /* ignore */ }
          return data;
        });
      };
    }

    // `var ytInitialPlayerResponse = {...}` in the page HTML.
    ['ytInitialPlayerResponse', 'ytInitialData'].forEach(function (name) {
      var value;
      try {
        Object.defineProperty(win, name, {
          configurable: true,
          get: function () { return value; },
          set: function (v) { value = pruneAds(v); }
        });
      } catch (e) { /* ignore */ }
    });
  }

  function skipVideoAds(doc) {
    var player = doc.querySelector('.ad-showing video, .ad-interrupting video');
    if (player) {
      player.muted = true;
      if (isFinite(player.duration) && player.duration > 0) player.currentTime = player.duration;
    }
    var skip = doc.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button');
    if (skip) skip.click();
  }

  function hideInstagramSponsored(doc) {
    var articles = doc.querySelectorAll('article:not([data-doomed-checked])');
    for (var i = 0; i < articles.length; i++) {
      var article = articles[i];
      var spans = article.querySelectorAll('span');
      var sponsored = false;
      for (var j = 0; j < spans.length && j < 60; j++) {
        if (isSponsoredLabel(spans[j].textContent)) { sponsored = true; break; }
      }
      if (sponsored) article.style.setProperty('display', 'none', 'important');
      // Header text loads with the article; re-check a few times before giving up.
      var checks = Number(article.getAttribute('data-doomed-n') || 0) + 1;
      article.setAttribute('data-doomed-n', String(checks));
      if (sponsored || checks >= 5) article.setAttribute('data-doomed-checked', '1');
    }
  }

  function ensureViewport(doc) {
    var meta = doc.querySelector('meta[name="viewport"]');
    if (!meta) {
      if (!doc.head) return;
      meta = doc.createElement('meta');
      meta.name = 'viewport';
      doc.head.appendChild(meta);
    }
    var content = meta.getAttribute('content') || 'width=device-width, initial-scale=1';
    if (/maximum-scale=1(\D|$)/.test(content) && /user-scalable=no/.test(content)) return;
    content = content
      .replace(/,?\s*maximum-scale=[^,]*/g, '')
      .replace(/,?\s*user-scalable=[^,]*/g, '');
    meta.setAttribute('content', content + ', maximum-scale=1, user-scalable=no');
  }

  /** "rgb(12, 16, 20)" / "rgba(12, 16, 20, 1)" -> [12, 16, 20], null if transparent. */
  function parseRgb(css) {
    var m = String(css || '').match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?\s*\)/);
    if (!m) return null;
    if (m[4] !== undefined) {
      var alpha = m[4].slice(-1) === '%' ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      if (alpha < 0.5) return null;
    }
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  }

  /** Background color of whatever is drawn at the very top of the page. */
  function topBackgroundColor(win, doc) {
    var el = doc.elementFromPoint ? doc.elementFromPoint(win.innerWidth / 2, 1) : null;
    while (el && el.nodeType === 1) {
      var rgb = parseRgb(win.getComputedStyle(el).backgroundColor);
      if (rgb) return rgb;
      el = el.parentElement;
    }
    var fallback = doc.body && parseRgb(win.getComputedStyle(doc.body).backgroundColor);
    return fallback || parseRgb(win.getComputedStyle(doc.documentElement).backgroundColor);
  }

  /** Tells the app which color to paint behind the status bar. */
  function makeColorReporter(win, doc) {
    var last = '';
    return function () {
      var handler = win.webkit && win.webkit.messageHandlers && win.webkit.messageHandlers.doomedColor;
      if (!handler || !doc.body) return;
      var rgb = topBackgroundColor(win, doc);
      if (!rgb) return;
      var key = rgb.join(',');
      if (key === last) return;
      last = key;
      handler.postMessage(rgb);
    };
  }

  function install(win, rawCfg) {
    var cfg = withDefaults(rawCfg);
    var doc = win.document;
    var site = siteOf(win.location.hostname);
    if (!site) return;

    if (site === 'youtube' && cfg.blockAds) installYouTubeAdPruning(win);

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

    var css = APP_FEEL_CSS + '\n' + cssFor(site, cfg);
    function ensureStyle() {
      if (doc.getElementById('doomed-style')) return;
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

    var reportColor = makeColorReporter(win, doc);

    function tick() {
      enforce();
      ensureStyle();
      ensureViewport(doc);
      try { reportColor(); } catch (e) { /* ignore */ }
      if (cfg.blockAds) {
        if (site === 'youtube') skipVideoAds(doc);
        if (site === 'instagram') hideInstagramSponsored(doc);
      }
    }

    enforce();
    ensureStyle();
    // Safety net: some routers keep a private reference to history methods,
    // and ads / sponsored posts are inserted while scrolling.
    win.setInterval(tick, 300);
  }

  var api = {
    decide: decide,
    siteOf: siteOf,
    cssFor: cssFor,
    pruneAds: pruneAds,
    isSponsoredLabel: isSponsoredLabel,
    parseRgb: parseRgb,
    DEFAULTS: DEFAULTS
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else if (root && root.document && !root.__DOOMED_INSTALLED__) {
    root.__DOOMED_INSTALLED__ = true;
    install(root, root.__DOOMED_CONFIG__ || {});
  }
})(typeof window !== 'undefined' ? window : this);
