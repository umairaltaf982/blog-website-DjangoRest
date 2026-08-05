from django.contrib import admin
from .models import Blog, BlogReaction


@admin.register(Blog) # It is a decorator usage is same like admin.site.register(Blog, BlogAdmin)
class BlogAdmin(admin.ModelAdmin): # Class to customize how Blog appear on Admin
    list_display = ('title', 'author', 'short_content', 'created_at', 'updated_at') # This controls the columns shown on the page that lists all blog posts.
    list_filter = ('created_at', 'author') # This creates filters on the right side of the admin page.
    search_fields = ('title', 'content', 'author__username') # This creates the search box.
    readonly_fields = ('created_at', 'updated_at') # These fields appear in the admin panel but cannot be edited.

    # Truncate content in list view for a cleaner layout
    @admin.display(description='Content') # This creates a custom column named Content instead of autogiven name by admin panel e.g. obj

    def short_content(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content


@admin.register(BlogReaction)
class BlogReactionAdmin(admin.ModelAdmin):
    list_display = ('user', 'blog', 'reaction', 'created_at')
    list_filter = ('reaction', 'created_at')
    search_fields = ('user__username', 'blog__title')
    readonly_fields = ('created_at',)