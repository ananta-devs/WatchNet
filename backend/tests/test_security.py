import pytest
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token

def test_password_hashing():
    pwd = "SuperSecretPassword123!"
    hashed = hash_password(pwd)
    assert hashed != pwd
    assert hashed.startswith("$argon2id$")
    assert verify_password(pwd, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False

def test_jwt_tokens():
    user_id = "123e4567-e89b-12d3-a456-426614174000"
    access_token = create_access_token(user_id)
    assert access_token is not None
    payload = decode_token(access_token)
    assert payload.get("sub") == user_id
    assert payload.get("type") == "access"

    refresh_token = create_refresh_token(user_id)
    assert refresh_token is not None
    refresh_payload = decode_token(refresh_token)
    assert refresh_payload.get("sub") == user_id
    assert refresh_payload.get("type") == "refresh"
