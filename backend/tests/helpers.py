from app.core.security import create_access_token
from app.models.user import User


def auth_header(user: User) -> dict:
    token = create_access_token(subject=str(user.id))
    return {"Authorization": f"Bearer {token}"}
