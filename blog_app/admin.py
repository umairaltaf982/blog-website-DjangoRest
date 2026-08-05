from django.contrib import admin
from .models import Blog, BlogReaction


@admin.register(Blog)
class BlogAdmin(admin.ModelAdmin):
    list_display = ('title', 'author', 'short_content', 'created_at', 'updated_at')
    list_filter = ('created_at', 'author')
    search_fields = ('title', 'content', 'author__username')
    readonly_fields = ('created_at', 'updated_at')

    # Truncate content in list view for a cleaner layout
    @admin.display(description='Content')
    def short_content(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content


@admin.register(BlogReaction)
class BlogReactionAdmin(admin.ModelAdmin):
    list_display = ('user', 'blog', 'reaction', 'created_at')
    list_filter = ('reaction', 'created_at')
    search_fields = ('user__username', 'blog__title')
    readonly_fields = ('created_at',)