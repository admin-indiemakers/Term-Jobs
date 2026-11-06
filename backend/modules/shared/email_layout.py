"""Light-only, table-based email components shared by invitations and outreach."""
from datetime import datetime, timezone
from html import escape

FONT = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"


def email_paragraph(content, *, secondary=False):
    color = '#525252' if secondary else '#171717'
    return f'<p style="margin:0 0 20px;font-family:{FONT};font-size:14px;line-height:1.75;background-color:#FFFFFF;color:{color};">{content}</p>'


def email_details(rows):
    cells = ''.join(
        f'<tr><td width="35%" valign="top" bgcolor="#FFFFFF" style="padding:12px 16px;border-bottom:1px solid #E5E7EB;background-color:#FFFFFF;color:#525252;font-size:12px;line-height:1.6;">{escape(str(label))}</td>'
        f'<td valign="top" bgcolor="#FFFFFF" style="padding:12px 16px;border-bottom:1px solid #E5E7EB;background-color:#FFFFFF;color:#171717;font-size:13px;font-weight:600;line-height:1.6;word-break:break-word;">{escape(str(value))}</td></tr>'
        for label, value in rows
    )
    return f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="width:100%;margin:4px 0 24px;border:1px solid #E5E7EB;border-radius:8px;background-color:#FFFFFF;color:#171717;font-family:{FONT};">{cells}</table>'


def email_link(label, url):
    return f'<a href="{escape(str(url), quote=True)}" target="_blank" style="color:#1E3A8A;background-color:#FFFFFF;text-decoration:underline;word-break:break-word;">{escape(str(label))}</a>'


def email_button(label, url, *, primary=True):
    background, color = ('#1E3A8A', '#FFFFFF') if primary else ('#FFFFFF', '#1E3A8A')
    return f'''<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;background-color:#FFFFFF;color:#171717;max-width:100%;"><tr>
<td bgcolor="{background}" align="left" style="background-color:{background};color:{color};border:1px solid #1E3A8A;border-radius:6px;mso-padding-alt:14px 22px;">
<a href="{escape(str(url), quote=True)}" target="_blank" style="display:inline-block;box-sizing:border-box;padding:14px 22px;border-radius:6px;font-family:{FONT};font-size:13px;font-weight:600;line-height:1.5;text-align:left;text-decoration:none;background-color:{background};color:{color};-webkit-text-fill-color:{color};mso-line-height-rule:exactly;">
<span style="background-color:{background};color:{color};-webkit-text-fill-color:{color};">{escape(str(label))}</span></a></td></tr></table>'''


def email_note(title, text):
    return f'''<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F9FAFB" style="margin:0 0 24px;border:1px solid #E5E7EB;border-radius:8px;background-color:#F9FAFB;color:#525252;"><tr>
<td bgcolor="#F9FAFB" style="padding:16px;background-color:#F9FAFB;color:#525252;font-family:{FONT};font-size:12px;line-height:1.75;">
<strong style="background-color:#F9FAFB;color:#171717;">{escape(title)}</strong><br>{escape(text).replace(chr(10), '<br>')}</td></tr></table>'''


def light_email(*, title, category, content, preheader, footer):
    return f'''<!DOCTYPE html>
<html lang="en" style="color-scheme:light only;background-color:#F4F6F8;color:#171717;">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<title>{escape(title)} · TermJobs</title>
<style>
:root {{ color-scheme:light only; supported-color-schemes:light; }}
body {{ margin:0!important;padding:0!important;background-color:#F4F6F8!important;color:#171717!important; }}
table {{ border-spacing:0;mso-table-lspace:0pt;mso-table-rspace:0pt; }}
a {{ color:#1E3A8A; }}
@media (max-width:600px) {{ .email-outer {{ padding:16px 8px!important; }} .email-padding {{ padding:24px!important; }} .email-title {{ font-size:24px!important; }} }}
@media (prefers-color-scheme:dark) {{ .email-canvas,.email-white {{ background-color:#FFFFFF!important;color:#171717!important; }} .email-footer {{ background-color:#F9FAFB!important;color:#737373!important; }} }}
[data-ogsc] .email-canvas {{ background-color:#FFFFFF!important;color:#171717!important; }}
</style></head>
<body bgcolor="#F4F6F8" style="margin:0;padding:0;background-color:#F4F6F8;color:#171717;font-family:{FONT};color-scheme:light only;">
<span style="display:none!important;visibility:hidden;mso-hide:all;max-height:0;max-width:0;overflow:hidden;background-color:#F4F6F8;color:#525252;">{escape(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F4F6F8" style="width:100%;background-color:#F4F6F8;color:#171717;"><tr>
<td class="email-outer" align="center" bgcolor="#F4F6F8" style="padding:40px 16px;background-color:#F4F6F8;color:#171717;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="background-color:#FFFFFF;color:#171717;"><tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;color:#171717;"><![endif]-->
<table class="email-canvas" role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="width:100%;max-width:600px;border:1px solid #E5E7EB;border-radius:12px;background-color:#FFFFFF;color:#171717;text-align:left;">
<tr><td class="email-padding email-white" bgcolor="#FFFFFF" style="padding:30px 40px 26px;border-bottom:1px solid #E5E7EB;background-color:#FFFFFF;color:#171717;">
<p style="margin:0;font-family:{FONT};font-size:17px;font-weight:700;letter-spacing:-0.5px;line-height:1.5;background-color:#FFFFFF;color:#171717;">TermJobs<span style="background-color:#FFFFFF;color:#1E3A8A;">.</span></p>
<p style="margin:8px 0 0;font-size:10px;font-weight:600;letter-spacing:1.4px;line-height:1.5;text-transform:uppercase;background-color:#FFFFFF;color:#525252;">{escape(category)}</p></td></tr>
<tr><td class="email-padding email-white" bgcolor="#FFFFFF" style="padding:32px 40px 36px;background-color:#FFFFFF;color:#171717;">
<h1 class="email-title" style="margin:0 0 24px;font-family:{FONT};font-size:26px;font-weight:650;letter-spacing:-0.7px;line-height:1.3;background-color:#FFFFFF;color:#171717;">{escape(title)}</h1>
{content}
</td></tr>
<tr><td class="email-footer email-padding" bgcolor="#F9FAFB" style="padding:24px 40px;border-top:1px solid #E5E7EB;background-color:#F9FAFB;color:#737373;">
<p style="margin:0 0 8px;font-family:{FONT};font-size:11px;line-height:1.75;background-color:#F9FAFB;color:#737373;">{escape(footer)}</p>
<p style="margin:0;font-family:{FONT};font-size:11px;line-height:1.75;background-color:#F9FAFB;color:#737373;">© {datetime.now(timezone.utc).year} TermJobs · Contract workforce platform</p>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>'''
