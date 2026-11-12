"""
Cryptographic envelope encryption service for WatchNet secrets.
Uses AES-256-GCM authenticated symmetric encryption with key derivation (HKDF)
from the master secret key or a specified encryption key.
Includes CLI rotation utilities and helpers for encrypting/decrypting sensitive fields.
"""
import os
import base64
import json
import logging
from typing import Optional, Dict, Any, Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from app.core.config import settings

logger = logging.getLogger("watchnet.crypto")

# Magic header prefix to identify WatchNet AES-256-GCM encrypted payloads
ENCRYPTED_PREFIX = "wn:enc:v1:"

class CryptoEngine:
    def __init__(self, master_secret: Optional[str] = None):
        self.master_secret = master_secret or settings.SECRET_KEY

    def _derive_key(self, salt: bytes, info: bytes = b"watchnet-aes-256-gcm-envelope") -> bytes:
        """Derive a 256-bit (32-byte) key using HKDF-SHA256 from master secret."""
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            info=info,
        )
        return hkdf.derive(self.master_secret.encode("utf-8"))

    def encrypt(self, plaintext: str) -> str:
        """
        Encrypts plaintext string with AES-256-GCM.
        Returns a base64-encoded string prefixed with 'wn:enc:v1:' containing:
        [16-byte salt][12-byte IV/nonce][ciphertext + 16-byte GCM tag]
        """
        if not plaintext:
            return ""
        
        salt = os.urandom(16)
        nonce = os.urandom(12)
        key = self._derive_key(salt)
        aesgcm = AESGCM(key)
        
        ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
        envelope = salt + nonce + ciphertext
        encoded = base64.urlsafe_b64encode(envelope).decode("utf-8")
        return f"{ENCRYPTED_PREFIX}{encoded}"

    def decrypt(self, ciphertext_envelope: str) -> str:
        """
        Decrypts an AES-256-GCM ciphertext envelope prefixed with 'wn:enc:v1:'.
        If the string is not encrypted (does not start with prefix), returns it as-is.
        """
        if not ciphertext_envelope:
            return ""
        if not ciphertext_envelope.startswith(ENCRYPTED_PREFIX):
            return ciphertext_envelope
        
        raw_b64 = ciphertext_envelope[len(ENCRYPTED_PREFIX):]
        try:
            envelope = base64.urlsafe_b64decode(raw_b64.encode("utf-8"))
            if len(envelope) < 28: # 16 (salt) + 12 (nonce)
                raise ValueError("Envelope payload too short")
            
            salt = envelope[:16]
            nonce = envelope[16:28]
            ciphertext = envelope[28:]
            
            key = self._derive_key(salt)
            aesgcm = AESGCM(key)
            plaintext_bytes = aesgcm.decrypt(nonce, ciphertext, None)
            return plaintext_bytes.decode("utf-8")
        except Exception as e:
            logger.error(f"Failed to decrypt payload: {e}")
            raise ValueError("Decryption failed or invalid key/corrupted ciphertext") from e

    def rotate_secret(self, old_envelope: str, new_secret_key: str) -> str:
        """Decrypts with current master key and re-encrypts with new_secret_key."""
        decrypted_text = self.decrypt(old_envelope)
        new_engine = CryptoEngine(master_secret=new_secret_key)
        return new_engine.encrypt(decrypted_text)


# Global default instance
crypto_engine = CryptoEngine()

def encrypt_secret(plaintext: str) -> str:
    return crypto_engine.encrypt(plaintext)

def decrypt_secret(ciphertext: str) -> str:
    return crypto_engine.decrypt(ciphertext)


# -------------------------------------------------------------------
# CLI Key Rotation & Secret Management Utility
# -------------------------------------------------------------------
async def rotate_database_secrets(old_secret_key: str, new_secret_key: str) -> Dict[str, int]:
    """
    Scans encrypted fields across database entities (e.g. SystemSetting, Router credentials)
    and re-encrypts them with the new master secret key.
    """
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.entities import SystemSetting
    from app.models.routers import Router

    old_engine = CryptoEngine(master_secret=old_secret_key)
    new_engine = CryptoEngine(master_secret=new_secret_key)

    counts = {"settings": 0, "routers": 0}

    async with AsyncSessionLocal() as session:
        # 1. System Settings marked as is_encrypted
        stmt = select(SystemSetting).where(SystemSetting.is_encrypted.is_(True))
        res = await session.execute(stmt)
        for s in res.scalars():
            if s.value and s.value.startswith(ENCRYPTED_PREFIX):
                plain = old_engine.decrypt(s.value)
                s.value = new_engine.encrypt(plain)
                counts["settings"] += 1

        # 2. Routers password_encrypted
        stmt_r = select(Router).where(Router.password_encrypted.isnot(None))
        res_r = await session.execute(stmt_r)
        for r in res_r.scalars():
            if r.password_encrypted and r.password_encrypted.startswith(ENCRYPTED_PREFIX):
                plain = old_engine.decrypt(r.password_encrypted)
                r.password_encrypted = new_engine.encrypt(plain)
                counts["routers"] += 1

        await session.commit()
    logger.info("Rotated secrets in database: %s", counts)
    return counts


def main():
    """Command-line entrypoint for encryption, decryption, and key rotation."""
    import sys
    import argparse
    import asyncio

    parser = argparse.ArgumentParser(description="WatchNet AES-256-GCM Cryptographic CLI Utility")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # encrypt
    enc_parser = subparsers.add_parser("encrypt", help="Encrypt plaintext secret")
    enc_parser.add_argument("text", help="Plaintext to encrypt")
    enc_parser.add_argument("--key", default=None, help="Master secret key override")

    # decrypt
    dec_parser = subparsers.add_parser("decrypt", help="Decrypt ciphertext envelope")
    dec_parser.add_argument("ciphertext", help="wn:enc:v1:... ciphertext to decrypt")
    dec_parser.add_argument("--key", default=None, help="Master secret key override")

    # rotate-single
    rot_parser = subparsers.add_parser("rotate-secret", help="Rotate single ciphertext to new master key")
    rot_parser.add_argument("ciphertext", help="Current encrypted ciphertext")
    rot_parser.add_argument("--old-key", required=True, help="Current master secret key")
    rot_parser.add_argument("--new-key", required=True, help="New master secret key")

    # rotate-db
    rot_db_parser = subparsers.add_parser("rotate-db", help="Rotate all encrypted secrets stored in database")
    rot_db_parser.add_argument("--old-key", required=True, help="Current master secret key")
    rot_db_parser.add_argument("--new-key", required=True, help="New master secret key")

    args = parser.parse_args()

    if args.command == "encrypt":
        engine = CryptoEngine(master_secret=args.key) if args.key else crypto_engine
        print(engine.encrypt(args.text))
    elif args.command == "decrypt":
        engine = CryptoEngine(master_secret=args.key) if args.key else crypto_engine
        print(engine.decrypt(args.ciphertext))
    elif args.command == "rotate-secret":
        engine = CryptoEngine(master_secret=args.old_key)
        print(engine.rotate_secret(args.ciphertext, args.new_key))
    elif args.command == "rotate-db":
        result = asyncio.run(rotate_database_secrets(args.old_key, args.new_key))
        print(f"Database key rotation completed: {result}")


if __name__ == "__main__":
    main()
