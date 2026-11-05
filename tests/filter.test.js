const test = require('node:test');
const assert = require('node:assert/strict');
const { decide, cssFor, siteOf } = require('../Doomed/Web/filter.js');

test('siteOf', () => {
  assert.equal(siteOf('www.instagram.com'), 'instagram');
  assert.equal(siteOf('instagram.com'), 'instagram');
  assert.equal(siteOf('m.youtube.com'), 'youtube');
  assert.equal(siteOf('evilinstagram.com'), null);
  assert.equal(siteOf('example.com'), null);
});

test('instagram: DMs, single reels and profiles stay allowed', () => {
  assert.equal(decide('https://www.instagram.com/direct/inbox/'), null);
  assert.equal(decide('https://www.instagram.com/direct/t/123456/'), null);
  assert.equal(decide('https://www.instagram.com/reel/C1abc_DEF-2/'), null);
  assert.equal(decide('https://www.instagram.com/p/C1abc/'), null);
  assert.equal(decide('https://www.instagram.com/someone/'), null);
  assert.equal(decide('https://www.instagram.com/stories/someone/123/'), null);
  assert.equal(decide('https://www.instagram.com/'), null);
});

test('instagram: reels feed is cut', () => {
  assert.equal(decide('https://www.instagram.com/reels/'), 'https://www.instagram.com/direct/inbox/');
  assert.equal(decide('https://www.instagram.com/reels'), 'https://www.instagram.com/direct/inbox/');
  assert.equal(decide('https://www.instagram.com/reels/C1abc/'), 'https://www.instagram.com/reel/C1abc/');
  assert.equal(decide('https://www.instagram.com/reels/audio/123/'), 'https://www.instagram.com/direct/inbox/');
  assert.equal(decide('https://www.instagram.com/someone/reels/'), 'https://www.instagram.com/someone/');
});

test('instagram: explore and optional home feed', () => {
  assert.equal(decide('https://www.instagram.com/explore/'), 'https://www.instagram.com/direct/inbox/');
  assert.equal(decide('https://www.instagram.com/explore/tags/cats/'), 'https://www.instagram.com/direct/inbox/');
  assert.equal(decide('https://www.instagram.com/explore/', { hideExplore: false }), null);
  assert.equal(decide('https://www.instagram.com/', { hideHomeFeed: true }), 'https://www.instagram.com/direct/inbox/');
});

test('instagram: reels allowed when filter disabled', () => {
  assert.equal(decide('https://www.instagram.com/reels/', { hideReels: false }), null);
});

test('youtube: shorts become classic videos', () => {
  assert.equal(decide('https://m.youtube.com/shorts/dQw4w9WgXcQ'), 'https://m.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(decide('https://www.youtube.com/shorts/dQw4w9WgXcQ/'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(decide('https://m.youtube.com/shorts/'), 'https://m.youtube.com/');
  assert.equal(decide('https://m.youtube.com/feed/shorts'), 'https://m.youtube.com/');
  assert.equal(decide('https://m.youtube.com/@creator/shorts'), 'https://m.youtube.com/@creator');
  assert.equal(decide('https://m.youtube.com/shorts/abc', { hideShorts: false }), null);
});

test('youtube: normal pages allowed', () => {
  assert.equal(decide('https://m.youtube.com/'), null);
  assert.equal(decide('https://m.youtube.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(decide('https://m.youtube.com/@creator/videos'), null);
  assert.equal(decide('https://m.youtube.com/results?search_query=shorts'), null);
});

test('other sites and garbage are ignored', () => {
  assert.equal(decide('https://example.com/reels/'), null);
  assert.equal(decide('not a url'), null);
});

test('css', () => {
  assert.match(cssFor('instagram', {}), /\/reels\//);
  assert.match(cssFor('instagram', {}), /\/explore/);
  assert.equal(cssFor('instagram', { hideReels: false, hideExplore: false }), '');
  assert.match(cssFor('youtube', {}), /ytm-reel-shelf-renderer/);
  assert.equal(cssFor('youtube', { hideShorts: false }), '');
});
