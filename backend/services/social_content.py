"""
Daily social post content — a 7-day rotation of themes, each backed by
real product copy or real data (never a fabricated stat, never an
invented testimonial). Edit the lists below as the product changes;
nothing here calls an LLM, so output is predictable and won't drift or
hallucinate.

No testimonial theme yet — there are no real customer quotes to use,
and made-up ones aren't going up. social_image.py still has the
pull-quote template ready to switch on the day there's real ones.

Each theme also maps to a distinct visual template (see social_image.py)
so the feed doesn't look like the same card recolored every day.
"""
from datetime import date

# Each feature carries a `problem` line (what it's like without Mailair)
# and a `fix` line (what Mailair does) — used as a 3-slide carousel:
# problem -> feature -> "how it looks" mockup. Deliberately NOT all
# phrased the same way — some are blunt, some are a question, some
# just state the fact — so twelve in a row don't read like a template.
FEATURES = [
    {
        "problem": "You've been meaning to reply to someone for two weeks and you know it.",
        "headline": "You've owed them a reply for 12 days",
        "body": "Mailair tracks the oldest un-replied email per contact — so \"I'll get to it\" turns into an actual number staring back at you.",
    },
    {
        "problem": "Every AI reply tool writes like it's from customer support.",
        "headline": "AI drafts that sound like you",
        "body": "Score is the real edit distance between what AI drafted and what you actually sent — not a vibe, an actual number, and it climbs the more you use it.",
    },
    {
        "problem": "A great client goes quiet, and the invoice quietly dies with the relationship.",
        "headline": "See revenue before it walks out the door",
        "body": "Open quotes and invoices, crossed with which relationships are fading. The deal you should chase first is usually not the biggest one — it's the coldest one.",
    },
    {
        "problem": "\"What's your average response time?\" Honestly, no idea.",
        "headline": "A response-time badge for your own site",
        "body": "Turn it on and it's a real, live number computed from your actual reply history — not a marketing claim.",
    },
    {
        "problem": "The important email is buried under eleven newsletters.",
        "headline": "Priority inbox, sorted before you open it",
        "body": "Urgent, needs-response, follow-up, FYI. Sorted before you've had coffee.",
    },
    {
        "problem": "Re-reading a whole thread just to remember what you promised — again.",
        "headline": "Action items, pulled out automatically",
        "body": "Task and deadline, lifted straight out of the email. Check it off when it's done, forget it existed otherwise.",
    },
    {
        "problem": "Every email pings your phone, so eventually you stop looking at any of them.",
        "headline": "Slack alerts for the emails that matter",
        "body": "Not a ping for every email. Just the one that would've cost you a client.",
    },
    {
        "problem": "Email, calls, WhatsApp — three channels with the same client, and none of them talk to each other.",
        "headline": "Log calls and texts alongside email",
        "body": "One relationship score, built from all of it. Not three partial pictures.",
    },
    {
        "problem": "A client who used to email weekly has gone quiet for a month. Nobody noticed until now.",
        "headline": "A health score for every client relationship",
        "body": "Recency, frequency, tone — tracked so the quiet ones get flagged before they're gone for good.",
    },
    {
        "problem": "SLAs live in your head. Which means they live nowhere, really.",
        "headline": "Response-time SLAs that actually alert you",
        "body": "Set a tier per client. Mailair watches the clock so you don't have to.",
    },
    {
        "problem": "A rough project quote takes twenty minutes to draft, every single time.",
        "headline": "Quotes drafted from the request itself",
        "body": "Reads the ask, drafts the scope — deliverables, timeline, the works. You edit, you send.",
    },
    {
        "problem": "Clients ask the same three questions. You keep answering from memory.",
        "headline": "A knowledge base that answers for you",
        "body": "Save the answer once. It surfaces itself next time, right while you're drafting.",
    },
]

PAIN_POINTS = [
    # Deliberately mixed lengths — a one-liner next to a real paragraph,
    # so the rotation doesn't settle into one rhythm.
    "You know exactly which email you've been avoiding. Mailair does too — and puts it at the top.",
    "Two hours a day in email isn't a productivity problem. It's a sorting problem.",
    "\"I'll reply later\" is how a $15k contract quietly disappears.",
    "The client you're most worried about losing is probably the one you replied to slowest.",
    "Inbox zero was never the goal.",
    "You don't have an email problem. You have a hundred tiny decisions dressed up as email, and no system for telling which ones actually matter before you've read all of them.",
    "The scariest part of vacation isn't leaving. It's the inbox waiting when you're back.",
    "Silence from a client isn't the same as satisfaction. It's usually the opposite, and it's the easiest signal in the world to miss.",
]

FOUNDER_VOICE = [
    "Built by one person who got tired of missing invoices in his own inbox.",
    "No growth hacks this week — just fixed a bug where the plan-limit banner showed the wrong count. Small things matter.",
    "Still the only person on support.",
    "Shipping something most weeks. Not because it's a rule — because an inbox tool that stops improving stops being useful.",
    "The feature I use the most is the one I built last, out of spite, after missing a client email for the third time.",
    "I don't want Mailair to feel clever. I want it to feel like it noticed the thing you were about to miss.",
    "Spent today's build time on something nobody will ever screenshot: making the sync job stop double-counting emails. It had been wrong for weeks and nobody, including me, caught it until a support email pointed it out.",
    "If you've emailed and I was slow, that's on me, not a policy.",
    "Every feature in here exists because I hit the problem myself first, usually while annoyed.",
    "Wrote three versions of the pricing page before one didn't sound like every other SaaS pricing page. Still not sure I nailed it.",
]

TIPS = [
    "Reply to the oldest urgent email first, not the newest one. Recency bias is why things sit for weeks.",
    "If a reply takes under 2 minutes, just send it. If it needs real thought, snooze it with an actual deadline — not \"later.\"",
    "Unsubscribe from anything you've deleted unread three times in a row. That's the tell.",
    "Five unanswered emails from one client beats fifty spread across fifty. Concentration is the real signal, not count.",
    "One hour a day for email. Not zero, not eight.",
    "Drafting the same reply for the third time this month? That's not an email anymore, it's a template you haven't made yet — go write it down properly and stop retyping it.",
    "\"Needs a decision\" and \"needs a reply\" are not the same pile.",
    "The client who emails the least is often the one closest to leaving.",
]

# Real shipped changelog entries — mirrors frontend/pages/changelog.tsx.
# Update this list when that page's `releases` array changes.
CHANGELOG = [
    "Platform admin dashboard at /admin — view MRR, users, usage, and webhook logs.",
    "Manual AI processing per email — click \"Process with AI\" to control your own usage.",
    "Email body renders as HTML inside a sandboxed iframe, like Gmail.",
    "Cancel-subscription button that actually cancels at the end of the billing period, via the Razorpay API.",
    "A plan-limit banner in the inbox the moment free users hit 5/5 AI-processed emails.",
    "Razorpay integration — accept subscription payments from India.",
    "Billing errors now show the exact reason, not a generic failure message.",
    "Webhook handlers for the full subscription lifecycle: activated, charged, halted, invoice paid, invoice expired.",
    "Email usage now only counts AI-processed emails, not every email that arrives.",
    "HMAC-SHA256 signed OAuth state on the Gmail connect flow, closing a CSRF gap.",
    "Fernet encryption for stored CRM credentials (HubSpot, Salesforce).",
    "Team internal notes now check org membership before granting access.",
    "AI email categorization shipped: Urgent, Needs Response, Follow Up, FYI, Newsletter, Spam.",
    "Smart reply drafts using Claude, tuned to your tone preference.",
    "Google Calendar integration that detects meeting requests inside emails.",
]

THEMES = ["feature", "pain_point", "changelog", "tip", "founder", "founder", "feature"]  # Mon..Sun


def get_todays_post(today: date | None = None) -> dict:
    """
    Deterministic pick — same day always yields the same content, so a
    retry after a failed post doesn't produce something different.

    Returns either a single-image post ({"slides": [one dict]}) or a
    carousel ({"slides": [2-3 dicts]}) — feature days are carousels.
    """
    d = today or date.today()
    weekday = d.weekday()  # 0=Mon .. 6=Sun
    theme = THEMES[weekday]
    ordinal = d.toordinal()

    if theme == "feature":
        item = FEATURES[ordinal % len(FEATURES)]
        # Alternate whether the CTA line shows up — not every post needs one.
        caption = f"{item['headline']}\n\n{item['body']}"
        if ordinal % 2 == 0:
            caption += "\n\nmailair.company"
        slides = [
            {"template": "statement", "text": item["problem"], "tagline": None},
            {"template": "card", "headline": item["headline"], "subtext": item["body"]},
            {"template": "mockup", "headline": None, "subtext": None},
        ]
    elif theme == "pain_point":
        line = PAIN_POINTS[ordinal % len(PAIN_POINTS)]
        caption = line
        slides = [{"template": "statement", "text": line, "tagline": "a sorted inbox, not another inbox"}]
    elif theme == "tip":
        line = TIPS[ordinal % len(TIPS)]
        # Only prefix "Inbox tip:" about half the time — a bare line reads
        # less like a recurring content slot and more like a thought.
        caption = f"Inbox tip:\n\n{line}" if ordinal % 3 != 0 else line
        slides = [{"template": "card", "headline": "Inbox tip", "subtext": line}]
    elif theme == "founder":
        line = FOUNDER_VOICE[ordinal % len(FOUNDER_VOICE)]
        caption = line
        slides = [{"template": "statement", "text": line, "tagline": "from the builder"}]
    else:  # changelog
        line = CHANGELOG[ordinal % len(CHANGELOG)]
        # Same: the "every update documented" line doesn't need to run every week.
        caption = f"Shipped: {line}"
        if ordinal % 2 == 0:
            caption += "\n\nEvery update, documented at mailair.company/changelog."
        slides = [{"template": "badge", "text": line}]

    return {"theme": theme, "caption": caption, "slides": slides}
