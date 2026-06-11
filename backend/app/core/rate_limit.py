from slowapi import Limiter
from slowapi.util import get_remote_address

# Keyed by client IP. Default is generous; sensitive routes set their own limit.
limiter = Limiter(key_func=get_remote_address, default_limits=[])
