from django.db import models
from django.contrib.auth.models import User

class Blog(models.Model):
    title = models.CharField(max_length=50)
    content = models.TextField()
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    # Helper properties for DRF Serializers (Req 2.3 & 2.4)
    @property
    def likes_count(self):
        return self.reactions.filter(reaction='L').count()

    @property
    def dislikes_count(self):
        return self.reactions.filter(reaction='D').count()


class BlogReaction(models.Model):
    REACTION_CHOICES = [
        ('L', 'Like'),
        ('D', 'Dislike')
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    blog = models.ForeignKey(Blog, on_delete=models.CASCADE, related_name='reactions')
    reaction = models.CharField(
        max_length=1,
        choices=REACTION_CHOICES,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'blog')

    def __str__(self):
        return f"{self.user.username} - {self.get_reaction_display()} on {self.blog.title}"