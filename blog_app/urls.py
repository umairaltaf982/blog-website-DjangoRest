# urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BlogViewSet, BlogReactionViewSet

router = DefaultRouter()
router.register(
    r'blogs',       # r'blogs' -> This is the URL prefix. So your URLs become
    BlogViewSet,    # This tells the router that Use this ViewSet whenever someone accesses /blogs/
    basename='blog' # This is the base name used by DRF for naming routes. Internally DRF creates names like blog-list, blog-detail. These names are useful when reversing URLs: reverse("blog-list") or reverse("blog-detail")
    )

router.register(
    r'reactions', 
    BlogReactionViewSet, 
    basename='reaction'
    )

urlpatterns = [
    path('', include(router.urls)),
]




"""
Default Router -> DefaultRouter:
This is specifically designed for ViewSets.
When you write:
router.register(
    "blogs",
    BlogViewSet,
    basename="blog"
)

DRF automatically creates these URLs:
URL	                        HTTP Method	                        Action
/blogs/	                        GET	                             list
/blogs/	                        POST	                        create
/blogs/{id}/	                GET	                            retrieve
/blogs/{id}/	                PUT	                            update
/blogs/{id}/	                PATCH	                      partial_update
/blogs/{id}/	                DELETE	                        destroy
You didn't write any of these yourself.
"""