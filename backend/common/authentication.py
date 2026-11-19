from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.settings import api_settings

from apps.core.models import User


class JWTAuthentication(JWTAuthentication):

    def get_user(self, validated_token):
        user_id = validated_token.get(api_settings.USER_ID_CLAIM)

        if not user_id:
            raise AuthenticationFailed("Token does not contain a user ID.")

        try:
            user = User.objects.get(
                id=user_id,
                isActive=True
            )
        except User.DoesNotExist:
            raise AuthenticationFailed("User not found or inactive.")

        return user