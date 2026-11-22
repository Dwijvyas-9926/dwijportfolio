"""Build Dwij_Vyas_Resume.pdf from content.json, in the site's own type and palette.

Run from the repository root after content changes:
    python3 tools/build_resume.py
Needs: reportlab (pip install reportlab). Fonts are in tools/fonts.
"""
import json, os, re, html
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
                                Table, TableStyle, KeepTogether, Flowable)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, 'tools', 'fonts')
SITE = 'https://dwijportfolio-kappa.vercel.app'

INK, INK2, LINE, ACCENT = HexColor('#111214'), HexColor('#5F6166'), HexColor('#DCDBD7'), HexColor('#F05627')

for name, file in [('Barlow', 'Barlow-400.ttf'), ('Barlow-Medium', 'Barlow-500.ttf'), ('Barlow-SemiBold', 'Barlow-600.ttf'),
                   ('Barlow-Italic', 'Barlow-400i.ttf'), ('BarlowCond', 'BarlowCondensed-600.ttf')]:
    pdfmetrics.registerFont(TTFont(name, os.path.join(FONTS, file)))
pdfmetrics.registerFontFamily('Barlow', normal='Barlow', bold='Barlow-SemiBold', italic='Barlow-Italic', boldItalic='Barlow-SemiBold')

ST = {
    'name': ParagraphStyle('name', fontName='BarlowCond', fontSize=34, leading=34, textColor=INK),
    'role': ParagraphStyle('role', fontName='Barlow-Medium', fontSize=10.5, leading=14, textColor=INK2),
    'contact': ParagraphStyle('contact', fontName='Barlow', fontSize=9, leading=13, textColor=INK),
    'h': ParagraphStyle('h', fontName='BarlowCond', fontSize=14, leading=16, textColor=INK, spaceBefore=4),
    'body': ParagraphStyle('body', fontName='Barlow', fontSize=9.4, leading=13.4, textColor=INK),
    'small': ParagraphStyle('small', fontName='Barlow', fontSize=8.6, leading=12, textColor=INK2),
    'title': ParagraphStyle('title', fontName='Barlow-SemiBold', fontSize=10.2, leading=13.4, textColor=INK),
    'meta': ParagraphStyle('meta', fontName='Barlow-Medium', fontSize=8.6, leading=13.4, textColor=INK2, alignment=2),
}

def esc(s):
    return html.escape(re.sub(r'<[^>]+>', '', str(s or '')), quote=False)

class Rule(Flowable):
    """A hairline with a short orange lead-in, as on the site."""
    def __init__(self, width, top=6, bottom=8):
        super().__init__(); self.w, self.top, self.bottom = width, top, bottom
    def wrap(self, *a): return self.w, self.top + self.bottom
    def draw(self):
        c = self.canv; y = self.bottom
        c.setStrokeColor(LINE); c.setLineWidth(0.6); c.line(0, y, self.w, y)
        c.setStrokeColor(ACCENT); c.setLineWidth(1.6); c.line(0, y, 18, y)

def row(left, right, lw):
    t = Table([[left, right]], colWidths=[lw * 0.76, lw * 0.24])
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0),
                           ('RIGHTPADDING', (0, 0), (-1, -1), 0), ('TOPPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 0)]))
    return t

def build():
    c = json.load(open(os.path.join(ROOT, 'content.json'), encoding='utf-8'))
    p = c.get('profile', {})
    out = os.path.join(ROOT, 'Dwij_Vyas_Resume.pdf')
    W, H = A4; M = 16 * mm; LW = W - 2 * M

    def page(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(ACCENT); canvas.rect(0, H - 4, W, 4, stroke=0, fill=1)        # thin accent band
        canvas.setFont('Barlow', 7.5); canvas.setFillColor(INK2)
        canvas.drawString(M, 10 * mm, f"{p.get('name', '').strip()}  |  Résumé")
        canvas.drawRightString(W - M, 10 * mm, f"{SITE.replace('https://', '')}  |  Page {doc.page}")
        canvas.restoreState()

    doc = BaseDocTemplate(out, pagesize=A4, leftMargin=M, rightMargin=M, topMargin=15 * mm, bottomMargin=17 * mm,
                          title=f"{p.get('name', '').strip()} — Résumé", author=p.get('name', '').strip(),
                          subject='Résumé', creator='tools/build_resume.py')
    doc.addPageTemplates([PageTemplate(id='p', frames=[Frame(M, 17 * mm, LW, H - 32 * mm, id='f', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)], onPage=page)])

    s = []
    # header
    s.append(Paragraph(f"{esc(p.get('name')).strip()}<font color='#F05627'>.</font>", ST['name']))
    s.append(Spacer(1, 5))
    s.append(Paragraph(esc(' · '.join(x for x in [p.get('discipline'), p.get('institution'), p.get('location')] if x)), ST['role']))
    links = []
    for ct in c.get('contact', []):
        href, label = ct.get('href', ''), ct.get('label', '')
        if re.match(r'https?://', href):
            label = re.sub(r'^https?://(www\.)?', '', href).rstrip('/')
        links.append(f"<link href='{html.escape(href)}' color='#111214'>{esc(label)}</link>")
    links.append(f"<link href='{SITE}' color='#111214'>{SITE.replace('https://', '')}</link>")
    s.append(Spacer(1, 3))
    s.append(Paragraph('  <font color="#F05627">|</font>  '.join(links), ST['contact']))
    s.append(Rule(LW, 8, 6))

    def section(title):
        s.append(Spacer(1, 6)); s.append(Paragraph(esc(title), ST['h'])); s.append(Rule(LW, 2, 6))

    # summary
    section('Summary')
    summary = ' '.join(esc(x) for x in [p.get('about1'), p.get('about2')] if x)
    if p.get('availability'): summary += f" <font name='Barlow-SemiBold'>{esc(p['availability'])}.</font>"
    s.append(Paragraph(summary, ST['body']))

    # education
    section('Education')
    for e in c.get('education', []):
        s.append(KeepTogether([row(Paragraph(esc(e.get('school')), ST['title']), Paragraph(esc(e.get('years')), ST['meta']), LW),
                               Paragraph(esc(e.get('detail')), ST['small']), Spacer(1, 5)]))

    # experience & recognition, newest first
    section('Experience & recognition')
    ms = sorted(c.get('milestones', []), key=lambda m: str(m.get('when', '')), reverse=True)
    for m in ms:
        title = esc(m.get('title'))
        if m.get('emphasis'): title += f"  <font color='#F05627' name='Barlow-SemiBold'>{esc(m['emphasis'])}</font>"
        blk = [row(Paragraph(title, ST['title']), Paragraph(esc(' · '.join(x for x in [m.get('kind'), m.get('when')] if x)), ST['meta']), LW)]
        if m.get('note'): blk.append(Paragraph(esc(m['note']), ST['small']))
        blk.append(Spacer(1, 6)); s.append(KeepTogether(blk))

    # projects
    section('Projects')
    def year_for(x):
        t = str(x.get('title', '')).lower()
        for m in ms:
            if t and (t in str(m.get('note', '')).lower() or t in str(m.get('title', '')).lower() or (x.get('link') and m.get('link') == x.get('link'))):
                return str(m.get('when', '')).strip()
        return ''
    for x in c.get('projects', []):
        if not x.get('title'): continue
        head = f"{esc(x['title'])}<font name='Barlow' color='#5F6166'>  —  {esc(x.get('sub'))}</font>"
        blk = [row(Paragraph(head, ST['title']), Paragraph(esc(year_for(x)), ST['meta']), LW)]
        if x.get('desc'): blk.append(Paragraph(esc(x['desc']), ST['body']))
        extra = []
        if x.get('tech'): extra.append(f"<font name='Barlow-SemiBold' color='#111214'>Built with</font>  {esc(', '.join(x['tech']))}")
        if x.get('link'):
            short = re.sub(r'^https?://(www\.)?', '', x['link']).rstrip('/')
            short = short if len(short) < 60 else short[:57] + '…'
            extra.append(f"<link href='{html.escape(x['link'])}' color='#5F6166'>{esc(short)}</link>")
        if extra: blk.append(Paragraph('<br/>'.join(extra), ST['small']))
        blk.append(Spacer(1, 7)); s.append(KeepTogether(blk))

    # skills
    section('Skills')
    for d in c.get('domains', []):
        if d.get('id') == 'all' or not d.get('skills'): continue
        s.append(Paragraph(f"<font name='Barlow-SemiBold'>{esc(d.get('label'))}</font>  <font color='#5F6166'>{esc(', '.join(d['skills']))}</font>", ST['body']))
        s.append(Spacer(1, 3))

    doc.build(s)
    print('wrote', os.path.relpath(out, ROOT))

if __name__ == '__main__':
    build()
