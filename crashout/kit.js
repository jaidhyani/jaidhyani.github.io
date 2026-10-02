// Crash-out Court kit. Runs inside a logged-in x.com tab. It never judges; judgment comes from whatever
// AI drives it (an agent's own reasoning, or the Claude artifact for people without one).
//
// Reading is passive: the kit records the timeline responses X's own client fetches while the person
// (or their agent) scrolls a tweet's replies and its /quotes page. It makes no read requests itself,
// so there is nothing for X's request signing to reject and nothing that looks like a scraper.
//
//   crashout.people()            -> {tweet, viewer, people[]} for the tweet on screen, from what's loaded
//   await crashout.sentence(v)   -> blocks / timed mutes, paced; records mutes in the jail
//   await crashout.parole()      -> unmutes everyone whose jail term is up
//   crashout.jail()              -> current jail records
//
// The jail lives in this browser's localStorage on x.com. X has no timed mute for accounts, so a term
// ends when parole() runs; loading the kit and sentence() both run it.
(() => {
  if (window.crashout) return 'crashout kit already loaded';

  // The public bearer token every x.com web session sends; the session itself is the ct0/auth cookies.
  const BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
  const JAIL_KEY = 'crashout.jail.v1';
  const WATCH = /\/(TweetDetail|SearchTimeline)\?/;

  const cookie = (name) => document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const viewerId = () => decodeURIComponent(cookie('twid') ?? '').replace('u=', '');

  // tweetId -> raw Tweet object, for every tweet X's client has loaded since the kit was installed.
  const seen = new Map();

  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.__typename === 'Tweet' && node.legacy && node.core) seen.set(node.rest_id, node);
    else if (node.__typename === 'TweetWithVisibilityResults' && node.tweet) walk(node.tweet);
    for (const [k, v] of Object.entries(node)) if (k !== 'quoted_status_result' || !seen.has(v?.result?.rest_id)) walk(v);
  }

  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (WATCH.test(String(url))) {
      this.addEventListener('load', () => { try { walk(JSON.parse(this.responseText)); } catch {} });
    }
    return open.apply(this, arguments);
  };

  function person(t) {
    const u = t.core.user_results.result;
    const rel = u.relationship_perspectives ?? u.legacy ?? {};
    return {
      userId: u.rest_id,
      handle: u.core?.screen_name ?? u.legacy?.screen_name,
      name: u.core?.name ?? u.legacy?.name,
      youFollow: !!rel.following,
      followsYou: !!rel.followed_by,
      alreadyBlocked: !!rel.blocking,
      alreadyMuted: !!rel.muting,
    };
  }
  const text = (t) => t.note_tweet?.note_tweet_results?.result?.text ?? t.legacy.full_text;
  const quotedId = (t) => t.legacy.quoted_status_id_str ?? t.quoted_status_result?.result?.rest_id;

  function people(tweetUrl = location.href) {
    const tweetId = String(tweetUrl).match(/status\/(\d+)/)?.[1] ?? String(tweetUrl).match(/^(\d+)$/)?.[1];
    if (!tweetId) throw new Error('crashout: open the tweet (or pass its URL) first');
    const focal = seen.get(tweetId);
    if (!focal) throw new Error('crashout: that tweet has not loaded since the kit started; open it and scroll its replies and /quotes');
    const author = person(focal);
    const me = viewerId();
    const out = [];
    for (const t of seen.values()) {
      const kind = t.legacy.in_reply_to_status_id_str === tweetId ? 'reply' : quotedId(t) === tweetId ? 'quote' : null;
      if (!kind) continue;
      const p = person(t);
      if (p.userId === me || p.userId === author.userId) continue;
      out.push({
        ...p, kind, tweetId: t.rest_id, text: text(t), likes: t.legacy.favorite_count,
        media: (t.legacy.extended_entities?.media ?? t.legacy.entities?.media ?? []).map((m) => m.media_url_https),
        mutual: p.youFollow && p.followsYou,
        url: `https://x.com/${p.handle}/status/${t.rest_id}`,
      });
    }
    const q = seen.get(quotedId(focal) ?? '');
    return {
      tweet: {
        id: tweetId, author: author.handle, text: text(focal),
        quoting: q ? { author: person(q).handle, text: text(q) } : null,
        replyCount: focal.legacy.reply_count, quoteCount: focal.legacy.quote_count,
        url: `https://x.com/${author.handle}/status/${tweetId}`,
      },
      viewer: { userId: me, isAuthor: me === author.userId },
      people: out,
    };
  }

  async function rest(path, params) {
    const res = await fetch(`/i/api/1.1/${path}`, {
      method: 'POST', credentials: 'include',
      headers: {
        authorization: `Bearer ${BEARER}`,
        'x-csrf-token': cookie('ct0'),
        'x-twitter-auth-type': 'OAuth2Session',
        'x-twitter-active-user': 'yes',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
    });
    if (!res.ok) throw new Error(`crashout: ${path} HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }

  function jail() {
    try { return JSON.parse(localStorage.getItem(JAIL_KEY) ?? '[]'); } catch { return []; }
  }
  const saveJail = (records) => localStorage.setItem(JAIL_KEY, JSON.stringify(records));

  // verdicts: [{userId, handle, action: 'block' | 'mute', days?}]; anything else is skipped.
  // Paced a few seconds apart: a burst of blocks is what X's anti-spam looks for.
  async function sentence(verdicts, { gapMs = 2500 } = {}) {
    await parole();
    const done = [];
    for (const v of verdicts) {
      if (v.action !== 'block' && v.action !== 'mute') continue;
      try {
        if (v.action === 'block') {
          await rest('blocks/create.json', { user_id: v.userId });
        } else {
          await rest('mutes/users/create.json', { user_id: v.userId });
          const until = Date.now() + (v.days ?? 7) * 864e5;
          saveJail([...jail().filter((r) => r.userId !== v.userId), { userId: v.userId, handle: v.handle, until }]);
        }
        done.push({ ...v, ok: true });
      } catch (e) {
        done.push({ ...v, ok: false, error: e.message });
      }
      await sleep(gapMs + Math.random() * gapMs);
    }
    return done;
  }

  async function parole() {
    const released = [];
    for (const r of jail()) {
      if (r.until > Date.now()) continue;
      try {
        await rest('mutes/users/destroy.json', { user_id: r.userId });
        released.push(r.handle);
        saveJail(jail().filter((x) => x.userId !== r.userId));
      } catch (e) {
        console.warn('crashout: parole failed for', r.handle, e.message);
      }
    }
    return released;
  }

  window.crashout = { people, sentence, parole, jail, seen };
  parole().then((r) => r.length && console.log('crashout: paroled', r));
  return 'crashout kit loaded. Open the tweet, scroll its replies, open /quotes and scroll, then crashout.people()';
})();
