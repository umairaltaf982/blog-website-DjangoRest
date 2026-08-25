from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Blog, BlogReaction


class UserSerializer(serializers.ModelSerializer):
    """User serializer to display author/user details nicely."""
    class Meta:
        model = User
        fields = ['id', 'username']


class BlogSerializer(serializers.ModelSerializer):
    """Serializer for Blog management and public viewing (Req 2.2, 2.3, 2.5)."""
    author = UserSerializer(read_only=True)
    likes_count = serializers.SerializerMethodField()
    dislikes_count = serializers.SerializerMethodField()

    def get_likes_count(self, obj):
        return obj.likes_count

    def get_dislikes_count(self, obj):
        return obj.dislikes_count

    class Meta:
        model = Blog
        fields = [
            'id', 
            'title', 
            'content', 
            'author', 
            'likes_count', 
            'dislikes_count', 
            'created_at', 
            'updated_at'
        ]
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']


class BlogReactionSerializer(serializers.ModelSerializer):
    """
    Serializer for Blog Reactions (Req 2.4, 2.5).
    Handles liking/disliking and toggling/updating reactions.
    """
    user = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = BlogReaction
        fields = ['id', 'user', 'blog', 'reaction', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']

    def validate(self, attrs):
        """Ensure choice validation (handled by model choices) and payload safety."""
        reaction = attrs.get('reaction')
        if reaction not in ['L', 'D']:
            raise serializers.ValidationError({"reaction": "Reaction must be either 'L' (Like) or 'D' (Dislike)."})
        return attrs

    def create(self, validated_data):  # This method is automatically called when you do: serializer.save()
        """
        Handles reaction creation OR updating if the user changes their vote 
        (e.g., changing from Like to Dislike).
        """
        user = self.context['request'].user  # Gets the currently logged-in user from the request. No need for the client to send the user ID.
        blog = validated_data['blog']                   # Retrieves the blog the user is reacting to.
        reaction_choice = validated_data['reaction']    # Retrieves whether the reaction is "Like" or "Dislike".

        # update_or_create prevents database duplicate errors and allows changing votes
        reaction_obj, created = BlogReaction.objects.update_or_create(
            user=user,
            blog=blog,
            defaults={'reaction': reaction_choice}
        )
        return reaction_obj