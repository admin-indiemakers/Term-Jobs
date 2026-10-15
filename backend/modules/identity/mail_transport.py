"""Credential mail delivery with explicit outcomes and safe SMTP fallback."""
import smtplib
import ssl
import re


def _rejection(error, password):
    """Retain the provider diagnosis without exposing credentials or addresses."""
    detail = error.smtp_error
    if isinstance(detail, bytes):
        detail = detail.decode('utf-8', errors='replace')
    detail = str(detail)
    for secret in (password, ''.join(password.split())):
        if secret:
            detail = detail.replace(secret, '[redacted]')
    detail = re.sub(r'[\w.+-]+@[\w.-]+', '[email]', detail)
    detail = ' '.join(detail.split())[:1000]
    lower = detail.lower()
    if any(word in lower for word in ('limit', 'quota')):
        code = 'sender_limit_exceeded'
        guidance = 'The Gmail sending limit was reached. Wait for the limit to reset or configure another sender.'
    elif any(word in lower for word in ('dkim', 'spf', 'dmarc', 'unauthenticated')):
        code = 'sender_authentication_rejected'
        guidance = 'Check SPF, DKIM and DMARC for the sender domain in Google Workspace.'
    elif any(word in lower for word in ('unsolicited', 'spam', 'suspicious', 'reputation')):
        code = 'message_blocked'
        guidance = 'Gmail blocked the message under its spam policy. Review the sender account and email content before retrying.'
    else:
        code = 'message_rejected'
        guidance = 'Review the Gmail sender account or Workspace mail policy before retrying.'
    return {'status': 'failed', 'code': code, 'reason': f'Gmail rejected the email (SMTP {error.smtp_code}). {guidance} Gmail response: {detail}'}


def _close(smtp):
    if smtp is not None:
        try:
            smtp.quit()
        except Exception:
            try:
                smtp.close()
            except Exception:
                pass


def deliver_credentials_message(message, sender, password, recipient):
    # Retry connection setup only. Once DATA is attempted, never resend blindly.
    failures = []
    for port in (465, 587):
        smtp = None
        try:
            if port == 465:
                smtp = smtplib.SMTP_SSL('smtp.gmail.com', port, timeout=8, context=ssl.create_default_context())
            else:
                smtp = smtplib.SMTP('smtp.gmail.com', port, timeout=8)
                smtp.ehlo()
                smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
            smtp.login(sender, ''.join(password.split()))
        except smtplib.SMTPAuthenticationError:
            _close(smtp)
            return {'status': 'failed', 'code': 'smtp_authentication_failed', 'reason': 'Gmail rejected the server credentials. Configure a valid Gmail app password.'}
        except (OSError, smtplib.SMTPException) as error:
            failures.append(f'{port}: {type(error).__name__}')
            _close(smtp)
            continue
        try:
            refused = smtp.sendmail(sender, [recipient], message.as_string())
            if refused:
                return {'status': 'failed', 'code': 'recipient_refused', 'reason': 'Gmail rejected the candidate email address.'}
            return {'status': 'success', 'transport': f'gmail_smtp_{port}'}
        except smtplib.SMTPRecipientsRefused:
            return {'status': 'failed', 'code': 'recipient_refused', 'reason': 'Gmail rejected the candidate email address.'}
        except smtplib.SMTPDataError as error:
            return _rejection(error, password)
        except smtplib.SMTPSenderRefused as error:
            return _rejection(error, password)
        except (OSError, smtplib.SMTPException):
            return {'status': 'failed', 'code': 'delivery_unconfirmed', 'reason': 'Connection ended during delivery. Delivery could not be confirmed; check the inbox before retrying.'}
        finally:
            _close(smtp)
    return {'status': 'failed', 'code': 'smtp_connection_failed', 'reason': 'The backend cannot connect to Gmail on ports 465 or 587 (' + '; '.join(failures) + '). Allow outbound SMTP on the hosting server.'}
