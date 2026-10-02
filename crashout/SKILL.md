---
name: crashout
description: Crash-out court for X/Twitter. Use when the user says "crashout <tweet url>", asks to block or mute the people who "crashed out", "lost it" or "took the bait" over a joke tweet, or says "crashout parole". Reads a tweet's replies and quotes in the user's own logged-in browser, judges who crashed out over the joke, and after the user approves, blocks the non-mutuals and gives mutuals a 7-day mute.
---

# Crash-out court

The user posts (or reads) a joke tweet. Some people take it literally and lose it. This skill finds them,
shows the user a verdict table, and on the user's approval blocks the crash-outs who aren't mutuals and
mutes the mutuals for 7 days ("mute jail"). Nothing is blocked or muted without the user's explicit go.

`kit.js` (next to this file) does the X side, inside the user's own x.com tab with their own session. It
only *listens* to what X's web client loads as the page is scrolled; it makes no read requests of its own.
You do the judging.

## Requirements

A browser tool that drives the user's real, logged-in browser and can (a) run JavaScript in a tab and
(b) send real scroll input: Claude in Chrome (`javascript_tool`, `computer` scroll), the chrome-devtools
MCP (`evaluate_script`, scroll), or equivalent. A headless or logged-out browser won't work. If you have no
such tool, say so and stop.

## Commands

- `crashout <tweet url>`: run the court on that tweet (steps below).
- `crashout parole`: open x.com, load the kit, run `await crashout.parole()`, report who was released.
- `crashout jail`: load the kit and show `crashout.jail()` with release dates.

## Steps for `crashout <tweet url>`

1. **Open x.com** in a tab (any page, e.g. `https://x.com/home`) and wait for it to load. If it shows a
   login page, ask the user to log in and stop.
2. **Load the kit**: read `kit.js` and run its whole contents with your JavaScript tool. It returns
   "crashout kit loaded". Loading it also releases any expired mute-jail terms. The kit lives in the page:
   a full page load (typing a URL, `navigate`) wipes it, so after this step move between pages only with
   in-app navigation (`history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate'))`).
3. **Open the tweet** with in-app navigation to its path (`/<handle>/status/<id>`), wait ~3 seconds.
4. **Load the replies**: send real scroll input (10 wheel ticks), wait ~1.5 s, and repeat; batch several
   scrolls per call if your tool can. Scrolling from JavaScript does not make X load more in a background
   tab; real input does. Check `crashout.people().people.length` every few scrolls and stop when it stops
   growing, or at about 150.
5. **Load the quotes**: in-app navigate to `/<handle>/status/<id>/quotes` and scroll the same way. X's
   quotes tab can show "No Quotes yet" for older tweets that have quotes (`crashout.people().tweet.quoteCount`
   says how many). If it does, use the search route instead:
   `/search?q=quoted_tweet_id%3A<id>&src=typed_query&f=live`, and scroll that.
6. **Collect**: `crashout.people()` (from the quotes page pass the tweet id: `crashout.people('<id>')`).
   It returns `{tweet, viewer, people}`. Each person has `handle`, `userId`, `kind` (reply/quote), `text`,
   `mutual`, `youFollow`, `followsYou`, `alreadyBlocked`, `alreadyMuted`, `media` (image URLs), `url`. If the tool truncates
   long results, read `JSON.stringify(...)` in slices. Drop anyone already blocked (and already-muted
   non-mutuals).
7. **Judge** each person with the rubric below. Group a person's tweets together and judge the person.
8. **Show the verdict table** (format below) and wait. The user answers with something short: "go",
   "go but spare @x", "also block @y", "mute instead". Apply their edits to the list.
9. **Sentence** on the user's go: `await crashout.sentence([{userId, handle, action: 'block'|'mute', days: 7}, ...])`.
   It paces itself (a few seconds per account), so tell the user roughly how long it will take. Report
   what it returns: who was blocked, who is in mute jail until when, and any failures verbatim.
10. **Parole reminder**: X has no timed mute, so jail terms end only when `parole()` runs. If your harness
    can schedule a follow-up, offer to run `crashout parole` in 7 days; otherwise tell the user to say
    "crashout parole" next week.

## The rubric

Start by stating the joke in one line and whether it is an obvious joke. If it is double-edged (a joke
carrying a real jab at someone), say so. Then heated objections to the joke's substance go to borderline at most; a grave verdict on the
author's character, contempt for the person, and bigotry still count as a crash-out.

Judge the person, not the tweet: weigh everything they posted on the thread together. "The author or
their group" includes the people and movement the joke defends or speaks for; it does not include
characters inside the joke (a fictional "friend" being lectured is not the author).

The examples below are invented for a made-up joke ("soup is a beverage and I'll be drinking it through a
straw at my sister's wedding"); match the principle, not the words.

A **crash-out** is out of proportion to a joke. Any one of these is enough:

- **A grave conclusion about the author or their group, drawn from the joke**: their character, sanity,
  morals or "true self" is now revealed. ("This tells me everything about how you were raised." "People
  like you are why this country is falling apart." "Honestly worried about your mental health.")
- **Strong contempt aimed at the person**: insults about intelligence, worth or sanity. ("You absolute
  clown." "Imagine being this stupid in public.")
- **Bigotry**: a negative generalization about the author's ethnicity, religion or other group that the
  joke set off. Using the joke's own framing inside a riff is not bigotry.
- **A literal rebuttal combined with one of the above**: arguing with the joke as a sincere claim *and*
  showing contempt or reaching a grave conclusion. A literal rebuttal with neither is not a crash-out.

**Not a crash-out**, even when critical:

- Riffing, punning or building on the joke, edgy riffs included.
- Defending the joke, or commenting on the people who crashed out.
- Disliking the joke: unfunny, lazy, tasteless, bad optics, "this will backfire on you". Taste and
  strategy critiques are allowed even when blunt.
- Calm literal rebuttals, earnest corrections, pedantry, questions. ("Soup is classified as a food.")
- Fond ribbing of the author.

**Borderline** is listed but never pre-selected; the user can promote it:

- **Mild contempt**: dismissive or condescending lines aimed at the person, short of insults (condescension
  aimed at the joke is a taste critique). ("Log off." "Grow up."
  "Who hurt you." "Not your finest moment." "Delete this.")
- **Heated but substantive objections**, especially to a double-edged joke's jab.
- **Sarcasm**: judge it by where it lands. Sarcasm that ends on a grave conclusion ("wow, so glad you
  showed us what kind of person you are") is a crash-out; sarcasm that just mocks the joke's premise is a riff or a
  critique; when you can't tell, borderline.
- **Joking contempt**: real insults or slurs about real people wrapped in self-aware hyperbole.

**Media**: if the text alone is a crash-out, judge the text. When the text is empty, only a link, or a setup whose meaning depends on the image ("every time",
"them:"), the image is the message. Each person's `media` lists image URLs; if you can view images, open
them and judge; otherwise list the person as "unseen" and don't select them.

When torn between two levels, pick the milder one. A wrongful block costs more than a missed one.

**Mutuals** (`mutual: true`): crash-outs get `mute` for 7 days, never `block`. A borderline mutual is
listed only. Say "mutual" in the table so the user sees why.

## Verdict table

Keep it scannable. Lead with the joke line and counts, then:

```
SENTENCE (pre-selected)
  block  @handle   "short quote of the worst bit"   - why, in a few words
  mute7  @handle   (mutual) "..."                   - why
BORDERLINE (not selected; say "also @x" to add)
  @handle  "..."  - why it's borderline
UNSEEN media-only: @a, @b
CLEARED: 61 people (riffs 22, defenders 9, critics 18, other 12)
```

Then: "Reply 'go' to sentence the pre-selected list, or edit it."
