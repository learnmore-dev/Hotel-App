
import os
import uuid

from django.conf import settings
from django.core.files.storage import default_storage
from rest_framework import status
from rest_framework.decorators import (
    api_view,
    permission_classes,
    parser_classes,
)
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_hotel_images(request):
    # Only hotel partners can upload hotel images.
    if request.user.role != "PARTNER":
        return Response(
            {
                "success": False,
                "message": "Only partners can upload hotel images.",
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    images = request.FILES.getlist("images")

    # Also accept a single file under the field name "image".
    if not images and request.FILES.get("image"):
        images = [request.FILES["image"]]

    if not images:
        return Response(
            {
                "success": False,
                "message": "Please select at least one image.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(images) > 10:
        return Response(
            {
                "success": False,
                "message": "You can upload a maximum of 10 images at once.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    allowed_types = {"image/jpeg", "image/png", "image/webp"}

    uploaded_images = []

    for image in images:
        if image.content_type not in allowed_types:
            return Response(
                {
                    "success": False,
                    "message": "Only JPG, PNG and WebP images are allowed.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if image.size > 5 * 1024 * 1024:
            return Response(
                {
                    "success": False,
                    "message": "Each image must be 5 MB or smaller.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    for image in images:
        extension = os.path.splitext(image.name)[1].lower()

        if extension not in {".jpg", ".jpeg", ".png", ".webp"}:
            extension = ".jpg"

        filename = f"hotel_images/{uuid.uuid4().hex}{extension}"
        saved_path = default_storage.save(filename, image)

        uploaded_images.append({
            "name": image.name,
            "path": saved_path,
            "url": request.build_absolute_uri(
                settings.MEDIA_URL + saved_path
            ),
        })

    return Response(
        {
            "success": True,
            "message": "Images uploaded successfully.",
            "data": {
                "images": uploaded_images,
            },
        },
        status=status.HTTP_201_CREATED,
    )
