import sys
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from modules.notifications.domain.models import Notification, notification_dict
from modules.notifications.router import _matches_user, _is_read_by_user


class TestNotificationReadPersistence(unittest.TestCase):
    def test_user_matches_own_notification(self):
        user = SimpleNamespace(id="user_123", tenant_id="tenant_abc", role="Hiring Manager")
        notif = Notification(id="n1", user_id="user_123", tenant_id="tenant_abc")
        self.assertTrue(_matches_user(notif, user))

    def test_user_does_not_match_other_user_notification(self):
        user = SimpleNamespace(id="user_123", tenant_id="tenant_abc", role="Hiring Manager")
        notif = Notification(id="n1", user_id="user_456", tenant_id="tenant_abc")
        self.assertFalse(_matches_user(notif, user))

    def test_director_matches_director_role_notification(self):
        director = SimpleNamespace(id="user_dir", tenant_id="tenant_abc", role="Director")
        notif = Notification(id="n1", user_id="", tenant_id="tenant_abc", target_role="Director")
        self.assertTrue(_matches_user(notif, director))

        # Other roles should not see Director-only notification
        hm = SimpleNamespace(id="user_hm", tenant_id="tenant_abc", role="Hiring Manager")
        self.assertFalse(_matches_user(notif, hm))

    def test_read_by_user_tracking(self):
        user_1 = "user_1"
        user_2 = "user_2"
        # Shared notification
        notif = Notification(id="n1", user_id="", tenant_id="tenant_abc", read=False, read_by=["user_1"])

        # User 1 has read it
        self.assertTrue(_is_read_by_user(notif, user_1))
        # User 2 has not read it
        self.assertFalse(_is_read_by_user(notif, user_2))

        # notification_dict correctly renders read status per user
        dict_1 = notification_dict(notif, user_id=user_1)
        dict_2 = notification_dict(notif, user_id=user_2)
        self.assertTrue(dict_1["read"])
        self.assertFalse(dict_2["read"])

    def test_personal_notification_read_status(self):
        user_1 = "user_1"
        notif = Notification(id="n1", user_id=user_1, tenant_id="tenant_abc", read=True, status="read")
        self.assertTrue(_is_read_by_user(notif, user_1))
        d = notification_dict(notif, user_id=user_1)
        self.assertTrue(d["read"])


if __name__ == "__main__":
    unittest.main()
