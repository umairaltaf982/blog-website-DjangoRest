# permissions.py
from rest_framework import permissions

# SAFE_METHODS are the methods that donot modify data. It contains GET, HEAD, OPTIONS methods

class IsAdminUserOrReadOnly(permissions.BasePermission):
    """
    Blog Permissions:
    - Guests & Regular Authenticated Users: View/Read-only (GET, HEAD, OPTIONS).
    - Admins (is_staff=True): Full CRUD (GET, POST, PUT, PATCH, DELETE).
    """
    def has_permission(self, request, view):
        # Allow read-only access to anyone (Guest & Authenticated User)
        if request.method in permissions.SAFE_METHODS:
            return True
        # Allow write/edit access ONLY if user is an Admin
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class IsNonAdminAuthenticatedOrReadOnly(permissions.BasePermission):
    """
    Reaction Permissions:
    - Guests: View reactions (GET).
    - Regular Authenticated Users (NOT Admin): Can react (POST, PUT, DELETE).
    - Admins (is_staff=True): Blocked from reacting.
    """
    def has_permission(self, request, view):
        # Allow read-only access to anyone
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Must be logged in, but MUST NOT be an admin/staff user
        return bool(
            request.user 
            and request.user.is_authenticated 
            and not request.user.is_staff
        )

        # lets breakdown this return statement first-of-all look at the class name:
        # IsNonAdminAuthenticatedOrReadOnly (Is NonAdmin Authenticated Or ReadOnly), 
        # this means that the the person is not a guest and not an admin its an authenticated user that is logged in.
        # now lets see what this type of user can do. firstly if request.method (method of request like GET, PUT etc) 
        # belongs to SAFE_METHODS (i.e. only GET, HEAD, OPTIONS), then it should have the access to their specified 
        # methods that can only be GET, HEAD, OPTIONS. 
        # now lets discuss another return statement that works when the above one return false.
        # 1. return bool(...) -> it returns turn and false only
        # 2. request.user -> Checks whether a user object exists, that usually does
        # 3. request.user.is_authenticated -> check whether user is logged in or not
        # 4. not request.user.is_staff -> Checks whether user is not an admin/staff.

        # now these conditions are binded with and operator that means if any of these fails, it return false 
        # (that means all the permissions will be denied) else it return true that means the user fulfilling the condition
        # can perform any operation