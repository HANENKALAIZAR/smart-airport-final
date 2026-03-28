import bcrypt
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
password = "test_password"
hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
verified = pwd_context.verify(password, hashed)

print(f"Hash: {hashed}")
print(f"Verified: {verified}")
