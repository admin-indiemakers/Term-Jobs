import unittest
from modules.shared.phone_validator import validate_phone_number


class TestPhoneValidator(unittest.TestCase):
    def test_short_phone_number(self):
        # 5 digits - should fail
        self.assertEqual(
            validate_phone_number("12345"),
            "Mobile number must be at least 10 digits."
        )

    def test_too_long_phone_number(self):
        # > 10 digits without '+' - should fail
        self.assertEqual(
            validate_phone_number("123456789012"),
            "Mobile number cannot exceed 10 digits (use + for country code)."
        )

    def test_valid_ten_digit_phone(self):
        # exactly 10 digits
        self.assertIsNone(validate_phone_number("9876543210"))
        # formatted with dashes/spaces
        self.assertIsNone(validate_phone_number("98765-43210"))
        self.assertIsNone(validate_phone_number("98765 43210"))

    def test_international_phone(self):
        # Valid Indian international number (+91 with 10 digits)
        self.assertIsNone(validate_phone_number("+91 9876543210"))
        # Valid US international number (+1 with 10 digits)
        self.assertIsNone(validate_phone_number("+1 5551234567"))
        # International too short
        self.assertEqual(
            validate_phone_number("+91 12345"),
            "Mobile number must be at least 10 digits."
        )
        # International too long (>15 digits)
        self.assertEqual(
            validate_phone_number("+91 1234567890123456"),
            "Mobile number cannot exceed 15 digits."
        )

    def test_invalid_characters(self):
        self.assertEqual(
            validate_phone_number("98765abcde"),
            "Please enter a valid mobile number (digits and standard formatting only)."
        )

    def test_empty_phone(self):
        self.assertEqual(
            validate_phone_number("", required=True),
            "Phone number is required."
        )
        self.assertIsNone(validate_phone_number("", required=False))
        self.assertIsNone(validate_phone_number(None, required=False))


if __name__ == "__main__":
    unittest.main()
