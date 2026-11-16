"""
Authentication module for TechDef Agent
Restricts access to localhost clients providing the configured token.
"""
from typing import Optional

class AuthManager:
    def __init__(self, expected_token: str):
        self.expected_token = expected_token

    def verify_token(self, token: Optional[str]) -> bool:
        if not self.expected_token:
            return True
        if not token:
            return False
        # Remove Bearer prefix if provided
        if token.startswith("Bearer "):
            token = token[7:].strip()
        return token == self.expected_token
