from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('blog_app.urls')),
    # DRF session auth (login/logout for the frontend)
    path('api/auth/', include('rest_framework.urls', namespace='rest_framework')),
    # Serve the SPA for every non-API route
    path('', TemplateView.as_view(template_name='index.html'), name='home'),
]
