"""
Generates a branded 1080x1350 (4:5, Instagram feed's best-engagement
ratio per Zernio's platform guide) image for the day's post using the
same warm-editorial system as the rest of the brand.
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "..", "assets")
FONT_PATH = os.path.join(ASSETS_DIR, "fonts", "Fraunces.ttf")
ICON_PATH = os.path.join(ASSETS_DIR, "images", "icon-transparent.png")

CREAM = (250, 243, 236, 255)
INK = (34, 28, 22, 255)
MUTED = (99, 86, 70, 255)
TERRACOTTA = (176, 71, 35, 255)
GLOW = (245, 197, 172, 110)

W, H = 1080, 1350


def _font(size: int, weight: str = "SemiBold") -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(FONT_PATH, size)
    f.set_variation_by_name(weight)
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


def generate_post_image(headline: str, subtext: str) -> bytes:
    """Returns PNG bytes for a single branded post image."""
    img = Image.new("RGBA", (W, H), CREAM)
    draw = ImageDraw.Draw(img)

    # Pre-measure text so the whole block (icon + headline + subtext) can
    # be vertically centered as one group, with the wordmark pinned below it.
    icon_size = 200
    headline_font = _font(60, "SemiBold")
    max_text_w = W - 160
    lines = _wrap(draw, headline, headline_font, max_text_w)[:4]
    line_height = 74

    subtext_font = _font(32, "Light")
    sub_lines = _wrap(draw, subtext, subtext_font, max_text_w - 80)[:3] if subtext else []
    sub_line_height = 46

    gap_icon_headline = 60
    gap_headline_subtext = 28
    gap_content_wordmark = 70
    wordmark_h = 56

    block_h = (
        icon_size + gap_icon_headline
        + len(lines) * line_height
        + (gap_headline_subtext + len(sub_lines) * sub_line_height if sub_lines else 0)
    )
    total_h = block_h + gap_content_wordmark + wordmark_h

    top = max((H - total_h) / 2, 90)
    icon_cy = top + icon_size / 2

    # Soft glow centered behind the icon
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((W / 2 - 260, icon_cy - 260, W / 2 + 260, icon_cy + 260), fill=GLOW)
    glow = glow.filter(ImageFilter.GaussianBlur(110))
    img.alpha_composite(glow)

    icon = Image.open(ICON_PATH).convert("RGBA").resize((icon_size, icon_size), Image.LANCZOS)
    img.alpha_composite(icon, (int((W - icon_size) / 2), int(top)))

    y = top + icon_size + gap_icon_headline
    for line in lines:
        w = draw.textlength(line, font=headline_font)
        draw.text(((W - w) / 2, y), line, font=headline_font, fill=INK)
        y += line_height

    if sub_lines:
        y += gap_headline_subtext
        for line in sub_lines:
            w = draw.textlength(line, font=subtext_font)
            draw.text(((W - w) / 2, y), line, font=subtext_font, fill=MUTED)
            y += sub_line_height

    # Wordmark — follows the content block instead of a fixed bottom offset
    word_font = _font(40, "SemiBold")
    mail_w = draw.textlength("Mail", font=word_font)
    air_w = draw.textlength("air", font=word_font)
    wx = (W - (mail_w + air_w)) / 2
    wy = y + gap_content_wordmark
    draw.text((wx, wy), "Mail", font=word_font, fill=INK)
    draw.text((wx + mail_w, wy), "air", font=word_font, fill=TERRACOTTA)

    import io
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="PNG")
    return buf.getvalue()
