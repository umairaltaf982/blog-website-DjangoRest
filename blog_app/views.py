# views.py
from rest_framework import viewsets
from .models import Blog, BlogReaction
from .serializers import BlogSerializer, BlogReactionSerializer
from .permissions import IsAdminUserOrReadOnly, IsNonAdminAuthenticatedOrReadOnly

class BlogViewSet(viewsets.ModelViewSet):
    """
    Handles Blog CRUD.
    - Guest & Authenticated User: Read-only
    - Admin: Full CRUD
    """
    queryset = Blog.objects.all().order_by('-created_at')
    serializer_class = BlogSerializer
    permission_classes = [IsAdminUserOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class BlogReactionViewSet(viewsets.ModelViewSet):
    """
    Handles Reactions.
    - Guest: Read-only
    - Authenticated User (Non-Admin): React (Like/Dislike)
    - Admin: Blocked from reacting
    """
    queryset = BlogReaction.objects.all()
    serializer_class = BlogReactionSerializer
    permission_classes = [IsNonAdminAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)