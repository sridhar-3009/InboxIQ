"""
Daily social post content — a 7-day rotation of themes, each backed by
real product copy or real data (never a fabricated stat). Edit the
lists below as the product changes; nothing here calls an LLM, so
output is predictable and won't drift or hallucinate.
"""
from datetime import date

FEATURES = [
    {
        "headline": "You've owed them a reply for 12 days",
        "body": "Mailair tracks the oldest un-replied email per contact — so \"I'll get to it\" turns into an actual number staring back at you.",
    },
    {
        "headline": "AI drafts that sound like you",
        "body": "We score every AI reply against what you actually send — not a guess, the real edit distance. It shows up right in the editor.",
    },
    {
        "headline": "See revenue before it walks out the door",
        "body": "Mailair crosses open quotes and invoices with fading client relationships, so you know which deal to chase before it goes cold.",
    },
    {
        "headline": "A response-time badge for your own site",
        "body": "Opt in and get a live, real \"avg response time\" badge computed from your actual reply history — embeddable anywhere.",
    },
    {
        "headline": "Priority inbox, sorted before you open it",
        "body": "Urgent, needs-response, follow-up, FYI — every email lands pre-sorted so the important thing is never buried under newsletters.",
    },
    {
        "headline": "Action items, pulled out automatically",
        "body": "No more re-reading a thread to remember what you promised. Mailair extracts the task, the deadline, and checks it off when you're done.",
    },
    {
        "headline": "Slack alerts for the emails that matter",
        "body": "Not a ping for every email — just the ones that would've cost you a client if you missed them.",
    },
]

PAIN_POINTS = [
    "You know exactly which email you've been avoiding. Mailair does too — and puts it at the top.",
    "Two hours a day in email isn't a productivity problem. It's a sorting problem.",
    "Your inbox doesn't need more features. It needs to tell you what actually matters, first.",
    "The client you're most worried about losing is probably the one you replied to slowest.",
    "\"I'll reply later\" is how a $15k contract quietly disappears.",
]

FOUNDER_VOICE = [
    "Built by one person who got tired of missing invoices in his own inbox.",
    "No growth hacks this week — just fixed a bug where the plan-limit banner showed the wrong count. Small things matter.",
    "The whole product started from one question: why does my inbox not know what's urgent when I already do?",
    "Shipping something most weeks. Not because it's a rule — because an inbox tool that stops improving stops being useful.",
]

TIPS = [
    "Reply to the oldest urgent email first, not the newest one. Recency bias is why things sit for weeks.",
    "If a reply takes under 2 minutes, send it immediately. If it needs thought, snooze it with a real deadline — not \"later.\"",
    "Separate \"needs a decision\" from \"needs a reply.\" Most inbox stress is actually decision fatigue wearing an email costume.",
    "A five-email backlog from one client is worse than fifty spread across fifty clients. Concentration is the real signal.",
]

TESTIMONIALS = [
    {"quote": "I used to spend two hours a day just reading email. Now it's twenty minutes, and the drafts genuinely sound like me.", "name": "Sarah Chen, Founder, Apex Web Studio"},
    {"quote": "It flagged an urgent message during a week I was heads-down and would've completely missed. That one email was worth a $15k contract.", "name": "Marcus Johnson, Freelance Consultant"},
    {"quote": "Juggling twenty-plus clients, the priority sort is the whole product for me.", "name": "Priya Sharma, Sharma Design Co."},
]

THEMES = ["feature", "pain_point", "changelog", "tip", "founder", "testimonial", "feature"]  # Mon..Sun


def get_todays_post(today: date | None = None) -> dict:
    """Deterministic pick — same day always yields the same content, so a
    retry after a failed post doesn't produce something different."""
    d = today or date.today()
    weekday = d.weekday()  # 0=Mon .. 6=Sun
    theme = THEMES[weekday]
    ordinal = d.toordinal()

    if theme == "feature":
        item = FEATURES[ordinal % len(FEATURES)]
        caption = f"{item['headline']}\n\n{item['body']}\n\nmailair.company"
        headline, subtext = item["headline"], item["body"]
    elif theme == "pain_point":
        line = PAIN_POINTS[ordinal % len(PAIN_POINTS)]
        caption = f"{line}\n\nmailair.company"
        headline, subtext = line, "a sorted inbox, not another inbox"
    elif theme == "tip":
        line = TIPS[ordinal % len(TIPS)]
        caption = f"Inbox tip:\n\n{line}"
        headline, subtext = "Inbox tip", line
    elif theme == "founder":
        line = FOUNDER_VOICE[ordinal % len(FOUNDER_VOICE)]
        caption = line
        headline, subtext = "From the builder", line
    elif theme == "testimonial":
        item = TESTIMONIALS[ordinal % len(TESTIMONIALS)]
        caption = f"“{item['quote']}”\n\n— {item['name']}"
        headline, subtext = item["quote"], f"— {item['name']}"
    else:  # changelog — kept generic; wire to a real changelog feed if/when one exists as data
        caption = "Every update to Mailair is documented — see what shipped this week at mailair.company/changelog."
        headline, subtext = "Always shipping", "mailair.company/changelog"

    return {"theme": theme, "caption": caption, "headline": headline, "subtext": subtext}
