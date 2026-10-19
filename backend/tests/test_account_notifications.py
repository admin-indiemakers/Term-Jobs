import sys
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from modules.identity.services import account_notifications as notifications


class TestAccountNotifications(unittest.TestCase):
    def setUp(self):
        self.mock_router = SimpleNamespace(_get_gmail_creds=lambda: ("sender@example.com", "app-secret"))
        self.mock_service = SimpleNamespace(_resolve_interview_domain=lambda: "https://termjobs.in")
        sys.modules["modules.identity.router"] = self.mock_router
        sys.modules["modules.interview.services.interview_service"] = self.mock_service
        self.delivery_mock = Mock(return_value={"status": "success"})
        self.patcher = patch.object(notifications, "deliver_credentials_message", self.delivery_mock)
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()

    def test_sends_security_notification_on_email_change(self):
        user = SimpleNamespace(name="Person", email="new@example.com")
        res = notifications.send_account_change_email(user, previous_email="old@example.com", password_changed=False)
        self.assertEqual(res["status"], "success")
        self.assertTrue(self.delivery_mock.called)
        # Check both old and new received notice
        recipients = [c.args[3] for c in self.delivery_mock.call_args_list]
        self.assertIn("new@example.com", recipients)
        self.assertIn("old@example.com", recipients)

    def test_sends_security_notification_on_password_change(self):
        user = SimpleNamespace(name="Person", email="new@example.com")
        res = notifications.send_account_change_email(user, previous_email="new@example.com", password_changed=True)
        self.assertEqual(res["status"], "success")
        self.assertTrue(self.delivery_mock.called)
        message = self.delivery_mock.call_args.args[0]
        self.assertIn("Password Changed", message["Subject"])

    def test_no_notification_for_unchanged_credentials(self):
        user = SimpleNamespace(name="Person", email="new@example.com")
        res = notifications.send_account_change_email(user, previous_email="NEW@example.com", password_changed=False)
        self.assertEqual(res["status"], "not_requested")
        self.delivery_mock.assert_not_called()

    def test_delivery_failure_returned_gracefully(self):
        self.delivery_mock.side_effect = RuntimeError("network down")
        user = SimpleNamespace(name="Person", email="new@example.com")
        res = notifications.send_account_change_email(user, previous_email=user.email, password_changed=True)
        self.assertEqual(res["status"], "failed")

    def test_missing_credentials_reported(self):
        sys.modules["modules.identity.router"] = SimpleNamespace(_get_gmail_creds=lambda: ("", ""))
        user = SimpleNamespace(name="Person", email="new@example.com")
        res = notifications.send_account_change_email(user, previous_email="old@example.com")
        self.assertEqual(res["status"], "failed")
        self.delivery_mock.assert_not_called()


if __name__ == "__main__":
    unittest.main()

