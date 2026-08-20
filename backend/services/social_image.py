"""
Renders branded 1080x1350 (4:5, Instagram feed's best-engagement ratio
per Zernio's platform guide) images for the daily post rotation.

Five distinct templates, dispatched by `slide["template"]`, so the
feed doesn't look like the same card recolored every day:
  card       — icon + headline + subtext (tips, one feature slide)
  statement  — full-bleed dark, large italic line (pain points, founder voice)
  quote      — pull-quote with attribution (not wired into the rotation
               yet — no real customer testimonials to use; ready for
               when there are)
  badge      — "shipped" pill + line (changelog)
  mockup     — stylized priority-inbox illustration (feature carousel closer)
"""
import io
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "..", "assets")
FONT_PATH = os.path.join(ASSETS_DIR, "fonts", "Fraunces.ttf")
ICON_PATH = os.path.join(ASSETS_DIR, "images", "icon-transparent.png")

CREAM = (250, 243, 236, 255)
INK = (34, 28, 22, 255)
MUTED = (99, 86, 70, 255)
TERRACOTTA = (176, 71, 35, 255)
TERRACOTTA_LIGHT = (225, 124, 78, 255)
GLOW = (245, 197, 172, 110)
CREAM_TEXT = (242, 237, 228, 255)
CREAM_MUTED = (176, 164, 148, 255)

W, H = 1080, 1350


def _font(size: int, weight: str = "SemiBold", italic: bool = False) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(FONT_PATH, size)
    axes = {"Weight": {"Thin": 100, "Light": 300, "Regular": 400, "SemiBold": 600, "Bold": 700, "Black": 900}.get(weight, 600)}
    try:
        f.set_variation_by_name(weight)
    except Exception:
        pass
    return f


def _wrap(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if draw.textlength(trial, font=font) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def _draw_centered_lines(draw, lines, font, y, fill, line_height):
    for line in lines:
        w = draw.textlength(line, font=font)
        draw.text(((W - w) / 2, y), line, font=font, fill=fill)
        y += line_height
    return y


def _wordmark(draw, y, on_dark=False):
    word_font = _font(38, "SemiBold")
    mail_color = CREAM_TEXT if on_dark else INK
    air_color = TERRACOTTA_LIGHT if on_dark else TERRACOTTA
    mail_w = draw.textlength("Mail", font=word_font)
    air_w = draw.textlength("air", font=word_font)
    wx = (W - (mail_w + air_w)) / 2
    draw.text((wx, y), "Mail", font=word_font, fill=mail_color)
    draw.text((wx + mail_w, y), "air", font=word_font, fill=air_color)


def _base_glow(img, cy):
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((W / 2 - 260, cy - 260, W / 2 + 260, cy + 260), fill=GLOW)
    glow = glow.filter(ImageFilter.GaussianBlur(110))
    img.alpha_composite(glow)


# ─── Templates ─────────────────────────────────────────────────────────────

def _render_card(headline: str, subtext: str) -> Image.Image:
    img = Image.new("RGBA", (W, H), CREAM)
    draw = ImageDraw.Draw(img)

    icon_size = 200
    headline_font = _font(60, "SemiBold")
    max_text_w = W - 160
    lines = _wrap(draw, headline, headline_font, max_text_w)[:4]
    line_height = 74

    subtext_font = _font(32, "Light")
    sub_lines = _wrap(draw, subtext, subtext_font, max_text_w - 80)[:3] if subtext else []
    sub_line_height = 46

    gap_icon_headline, gap_headline_subtext, gap_content_wordmark = 60, 28, 70
    block_h = icon_size + gap_icon_headline + len(lines) * line_height + (gap_headline_subtext + len(sub_lines) * sub_line_height if sub_lines else 0)
    total_h = block_h + gap_content_wordmark + 56
    top = max((H - total_h) / 2, 90)
    icon_cy = top + icon_size / 2

    _base_glow(img, icon_cy)
    icon = Image.open(ICON_PATH).convert("RGBA").resize((icon_size, icon_size), Image.LANCZOS)
    img.alpha_composite(icon, (int((W - icon_size) / 2), int(top)))

    y = top + icon_size + gap_icon_headline
    y = _draw_centered_lines(draw, lines, headline_font, y, INK, line_height)
    if sub_lines:
        y += gap_headline_subtext
        y = _draw_centered_lines(draw, sub_lines, subtext_font, y, MUTED, sub_line_height)

    _wordmark(draw, y + gap_content_wordmark)
    return img


def _render_statement(text: str, tagline: str | None) -> Image.Image:
    img = Image.new("RGBA", (W, H), INK)
    draw = ImageDraw.Draw(img)

    # Faint terracotta glow, off-center, for depth on the dark ground
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((W - 520, -140, W + 120, 460), fill=(176, 71, 35, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(140))
    img.alpha_composite(glow)
    draw = ImageDraw.Draw(img)

    font = _font(58, "SemiBold")
    max_w = W - 180
    lines = _wrap(draw, text, font, max_w)[:6]
    line_height = 72

    tagline_font = _font(28, "Light")
    tag_h = 50 if tagline else 0

    block_h = len(lines) * line_height + (tag_h if tagline else 0)
    top = (H - block_h) / 2

    y = top
    for line in lines:
        w = draw.textlength(line, font=font)
        draw.text(((W - w) / 2, y), line, font=font, fill=CREAM_TEXT)
        y += line_height

    if tagline:
        y += 10
        w = draw.textlength(tagline.lower(), font=tagline_font)
        draw.text(((W - w) / 2, y), tagline.lower(), font=tagline_font, fill=(TERRACOTTA_LIGHT if False else (176, 164, 148, 255)))

    _wordmark(draw, H - 110, on_dark=True)
    return img


def _render_quote(quote: str, attribution: str) -> Image.Image:
    img = Image.new("RGBA", (W, H), CREAM)
    draw = ImageDraw.Draw(img)

    mark_font = _font(220, "Bold")
    quote_font = _font(48, "SemiBold", italic=True)
    attr_font = _font(26, "Light")
    max_w = W - 200

    lines = _wrap(draw, quote, quote_font, max_w)[:6]
    line_height = 64
    block_h = 150 + len(lines) * line_height + 60 + 40  # mark + quote + gap + attribution

    top = max((H - block_h) / 2, 80)
    _base_glow(img, top + 220)

    # Decorative opening quotation mark
    draw.text((90, top - 40), "“", font=mark_font, fill=(225, 124, 78, 130))

    y = top + 160
    y = _draw_centered_lines(draw, lines, quote_font, y, INK, line_height)

    y += 40
    w = draw.textlength(f"— {attribution}", font=attr_font)
    draw.text(((W - w) / 2, y), f"— {attribution}", font=attr_font, fill=MUTED)

    _wordmark(draw, y + 90)
    return img


def _render_badge(text: str) -> Image.Image:
    img = Image.new("RGBA", (W, H), CREAM)
    draw = ImageDraw.Draw(img)

    badge_font = _font(24, "SemiBold")
    body_font = _font(50, "SemiBold")
    max_w = W - 180
    lines = _wrap(draw, text, body_font, max_w)[:5]
    line_height = 64

    badge_label = "SHIPPED"
    badge_w = draw.textlength(badge_label, font=badge_font) + 56
    badge_h = 56

    block_h = badge_h + 46 + len(lines) * line_height
    top = max((H - block_h) / 2, 120)
    _base_glow(img, top + badge_h / 2)

    bx = (W - badge_w) / 2
    draw.rounded_rectangle((bx, top, bx + badge_w, top + badge_h), radius=badge_h / 2, fill=(92, 122, 74, 255))
    lw = draw.textlength(badge_label, font=badge_font)
    draw.text((bx + (badge_w - lw) / 2, top + (badge_h - 24) / 2 - 2), badge_label, font=badge_font, fill=(244, 245, 238, 255))

    y = top + badge_h + 46
    y = _draw_centered_lines(draw, lines, body_font, y, INK, line_height)

    _wordmark(draw, y + 70)
    return img


def _render_mockup() -> Image.Image:
    """A generic, stylized priority-inbox illustration — not a live
    screenshot (no real user data), used as the closing carousel slide."""
    img = Image.new("RGBA", (W, H), CREAM)
    draw = ImageDraw.Draw(img)

    card_w, card_h = 840, 620
    cx, cy = W / 2, H / 2 - 40
    left, top = cx - card_w / 2, cy - card_h / 2

    _base_glow(img, cy)

    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((left, top + 18, left + card_w, top + card_h + 18), radius=28, fill=(94, 42, 26, 40))
    shadow = shadow.filter(ImageFilter.GaussianBlur(24))
    img.alpha_composite(shadow)

    draw.rounded_rectangle((left, top, left + card_w, top + card_h), radius=28, fill=(255, 255, 255, 255), outline=(231, 224, 212, 255), width=2)

    header_font = _font(28, "SemiBold")
    draw.text((left + 40, top + 34), "Today's priority inbox", font=header_font, fill=INK)

    row_labels = [("Sarah Michaels", "Contract needs your signature", "Urgent", TERRACOTTA),
                  ("Tech Corp Billing", "Invoice #2847 — 12 days overdue", "Needs reply", (179, 129, 44, 255)),
                  ("Mike Reynolds", "Circling back on last week's proposal", "Follow up", (117, 130, 79, 255))]
    name_font = _font(26, "SemiBold")
    sub_font = _font(22, "Light")
    tag_font = _font(18, "SemiBold")

    ry = top + 100
    row_h = 150
    for name, subject, tag, color in row_labels:
        draw.line((left + 40, ry, left + card_w - 40, ry), fill=(238, 232, 222, 255), width=2)
        draw.text((left + 40, ry + 26), name, font=name_font, fill=INK)
        draw.text((left + 40, ry + 64), subject, font=sub_font, fill=MUTED)
        tag_w = draw.textlength(tag, font=tag_font) + 32
        draw.rounded_rectangle((left + card_w - 40 - tag_w, ry + 26, left + card_w - 40, ry + 60), radius=17, outline=color, width=2)
        draw.text((left + card_w - 40 - tag_w + 16, ry + 33), tag, font=tag_font, fill=color)
        ry += row_h

    _wordmark(draw, top + card_h + 70)
    return img


TEMPLATES = {
    "card": lambda s: _render_card(s.get("headline", ""), s.get("subtext", "")),
    "statement": lambda s: _render_statement(s.get("text", ""), s.get("tagline")),
    "quote": lambda s: _render_quote(s.get("quote", ""), s.get("attribution", "")),
    "badge": lambda s: _render_badge(s.get("text", "")),
    "mockup": lambda s: _render_mockup(),
}


def generate_slide_image(slide: dict) -> bytes:
    """Render one slide (dict with a "template" key) to PNG bytes."""
    renderer = TEMPLATES.get(slide.get("template", "card"), TEMPLATES["card"])
    img = renderer(slide)
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="PNG")
    return buf.getvalue()
