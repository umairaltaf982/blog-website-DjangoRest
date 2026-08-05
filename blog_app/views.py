# views.py: The View is like the manager that coordinates everything.
from rest_framework import viewsets
from .models import Blog, BlogReaction
from .serializers import BlogSerializer, BlogReactionSerializer
from .permissions import IsAdminUserOrReadOnly, IsNonAdminAuthenticatedOrReadOnly

class BlogViewSet(viewsets.ModelViewSet): # ModelViewSet already contains code for GET all objects, GET one object, POST, PUT, PATCH, DELETE. So instead of writing all these methods yourself, DRF gives them to you.
    # Without ModelViewSet You would have to write: def list(), def retrieve(), def create(), def update(), def partial_update(), def destroy() yourself. With ModelViewSet You write almost nothing. DRF handles them automatically.
    """
    Handles Blog CRUD.
    - Guest & Authenticated User: Read-only
    - Admin: Full CRUD
    """

    # They are class attributes, not methods. That's because ModelViewSet looks for them automatically.
    queryset = Blog.objects.all().order_by('-created_at') # It tells DRF "Whenever you need Blog objects, use this queryset."          Blog.objects.all() -> returns every blog. 
    serializer_class = BlogSerializer # Views cannot directly send Django models as JSON. They need a serializer. During POST Serializer also validates incoming data. Serializer checks required fields data types custom validation before saving. Without serializer The ViewSet wouldn't know how to validate how to convert how to save
    permission_classes = [IsAdminUserOrReadOnly] # This line tells DRF: Before doing anything, check this permission.

# Many beginners think this creates the object. It doesn't. DRF has already validated the data. This method exists so that you can add extra information before saving.
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