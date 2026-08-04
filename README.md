# Software Requirements Specification (SRS)

# Blog Website

## 1. Introduction

This project is a backend-only blog application developed using **Django REST Framework (DRF)**. It provides REST APIs for blog management, user authentication, and blog reactions (likes/dislikes).

## 2. Functional Requirements

### 2.1 Authentication
- Users can authenticate to access protected endpoints.
- Unauthenticated users can access only public endpoints.

### 2.2 Blog Management
- Only administrators can create blog posts.
- Regular users cannot create, update, or delete blog posts.
- Blog data shall be validated using serializers before being stored.
- All blog posts are publicly accessible.

### 2.3 Blog Viewing
- Anyone can view the list of blogs.
- Anyone can view the details of a blog.
- Each blog shall display its total likes and dislikes.
- Blog data shall be serialized before being returned through the API.

### 2.4 Blog Reactions
- Only authenticated users can like or dislike a blog.
- Each user's like or dislike shall be stored in the database.
- The total number of likes and dislikes shall be publicly visible.
- Reaction data shall be validated using serializers.

### 2.5 Serializers
- Serializers shall validate incoming request data.
- Serializers shall convert model instances into JSON responses.
- Serializers shall deserialize JSON request data into model objects.
- Separate serializers shall be used for blogs and blog reactions.

## 3. Non-Functional Requirements

- The backend shall be developed using **Django REST Framework (DRF)**.
- Data shall be stored in a relational database.
- All API responses shall be returned in JSON format.
- Authentication shall be required only for protected endpoints.

## 4. User Roles

### Guest (Unauthenticated User)
- View all blogs.
- View blog details.
- View the total number of likes and dislikes.

### Authenticated User
- View all blogs.
- Like or dislike blogs.

### Administrator
- Create blog posts.
- View all blogs.
- Like or dislike blogs.
