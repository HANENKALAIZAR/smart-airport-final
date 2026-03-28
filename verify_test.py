import bcrypt
# Passlib 1.7.4 compatibility with bcrypt 4.0+
if not hasattr(bcrypt, "__about__"):
    bcrypt.__about__ = type('about', (object,), {'__version__': bcrypt.__version__})

_original_hashpw = bcrypt.hashpw
def _patched_hashpw(password, salt):
    if isinstance(password, str):
        p_bytes = password.encode('utf-8')
    else:
        p_bytes = password
    if len(p_bytes) > 72:
        p_bytes = p_bytes[:72]
    return _original_hashpw(p_bytes, salt)
bcrypt.hashpw = _patched_hashpw

from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

password = "Admin@2024"
hash_in_db = "$2b$12$LQv3c1yqBwEHFX4tsAJIFuCrCL7l/3x3czxT7aME87XdIuLN7KBXW"

try:
    match = pwd_context.verify(password, hash_in_db)
    print(f"Match: {match}")
except Exception as e:
    import traceback
    traceback.print_exc()
