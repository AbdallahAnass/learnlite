# Learning Platform — Frontend

React frontend for the learning platform, built with Create React App, Tailwind CSS, and React Router.

---

## Prerequisites

| Tool | Version |
| Node.js | 18+ |
| npm | 9+ |

The backend must be running on `http://localhost:8000` before using the app.

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start the development server

```bash
npm start
```

The app opens at `http://localhost:3000`.

---

## API configuration

The backend URL is set in `src/api/client.js`. By default it points to:

```
http://localhost:8000
```

To use a different backend URL, update that file directly.

---

## User roles

The app has three roles, each with its own pages and layout:

| Role           | Access                                                             |
| -------------- | ------------------------------------------------------------------ |
| **Student**    | Course catalog, enrollments, lesson viewer, quizzes, wellness chat |
| **Instructor** | Dashboard, course/module/lesson management, quiz builder           |
| **Admin**      | Platform dashboard, user management, course management             |

---

## Project structure

```
learning-forntend/
├── public/
│   ├── index.html            # HTML shell
│   ├── favicon.svg           # App favicon
│   └── manifest.json         # PWA manifest
├── src/
│   ├── App.js                # Root component with all routes
│   ├── index.js              # Entry point
│   ├── index.css             # Global Tailwind styles
│   ├── api/
│   │   ├── client.js         # Base HTTP client (auth headers, error handling)
│   │   ├── auth.js           # Login / register
│   │   ├── courses.js        # Course CRUD
│   │   ├── enrollment.js     # Enrollment
│   │   ├── instructor.js     # Instructor endpoints
│   │   ├── quiz.js           # Quiz endpoints
│   │   ├── reviews.js        # Course reviews
│   │   ├── users.js          # User profiles
│   │   ├── wellness.js       # Wellness chatbot
│   │   └── admin.js          # Admin endpoints
│   ├── pages/
│   │   ├── LandingPage.js
│   │   ├── LoginPage.js
│   │   ├── RegisterPage.js
│   │   ├── ProfilePage.js
│   │   ├── student/          # Student pages
│   │   ├── instructor/       # Instructor pages
│   │   └── admin/            # Admin pages
│   ├── components/
│   │   ├── Navbar.js
│   │   ├── ProtectedRoute.js # Role-based route guard
│   │   ├── StudentLayout.js
│   │   ├── InstructorLayout.js
│   │   ├── AdminLayout.js
│   │   └── ui/               # Shared UI components
│   └── lib/
│       ├── auth.js           # JWT token storage (localStorage)
│       └── utils.js          # Utility functions
├── craco.config.js           # CRA config override (@/ path alias)
├── tailwind.config.js        # Tailwind configuration
└── jsconfig.json             # Path alias for editor support
```
