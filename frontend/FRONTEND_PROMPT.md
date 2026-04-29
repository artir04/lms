# Frontend Development Context - LMS Project

## Project Overview
Multi-tenant Learning Management System (LMS) frontend built with React 18, TypeScript, Vite, and Tailwind CSS.

## Tech Stack
- **React 18** with TypeScript
- **Vite** for fast development and hot module replacement
- **React Router v6** for routing
- **TanStack Query (React Query)** for data fetching and caching
- **Zustand** for state management
- **Tailwind CSS** for styling (slate color scheme)
- **React Hook Form + Zod** for form validation

## Current State
- Backend running at: http://localhost:8000
- API Documentation: http://localhost:8000/api/docs
- Authentication: JWT tokens (15min access, 7-day refresh)
- Multi-tenant architecture: District → School → Users

## Project Structure
```
frontend/src/
├── pages/              # Route components organized by feature
│   ├── auth/          # Login, register
│   ├── dashboard/      # Main dashboard
│   ├── courses/        # Course management, viewing
│   ├── students/       # Student management
│   ├── teachers/       # Teacher management
│   ├── attendance/     # Attendance tracking (NEW - needs implementation)
│   └── grades/        # Grade management
├── components/
│   ├── layout/         # AppShell, Sidebar, Header
│   ├── ui/            # Generic UI (Button, Card, Input)
│   └── [feature]/     # Feature-specific components
├── router/            # React Router configuration (index.tsx)
├── store/             # Zustand stores (auth, notifications)
├── hooks/             # Custom React hooks
├── config/            # Axios instance, queryClient setup
├── types/             # TypeScript type definitions
└── api/              # API endpoint helpers
```

## Key Patterns & Conventions

### 1. Role-Based Routing
- Routes wrapped in `ProtectedRoute` component
- `ProtectedRoute` accepts `roles` prop: `roles={["teacher", "admin"]}`
- Available role checks via `useAuth()` hook:
  - `isStudent`, `isTeacher`, `isAdmin`, `isSuperAdmin`

### 2. Data Fetching
- Use TanStack Query for all API calls
- Import `api` from `config/axios.ts`
- Example:
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['course', courseId],
  queryFn: () => api.get(`/courses/${courseId}`).then(res => res.data)
});
```

### 3. State Management
- `authStore` manages authentication state
- Available via `useAuth()` hook
- Token refresh handled automatically via axios interceptor
- Keys: `user`, `accessToken`, `refreshToken`, `login()`, `logout()`

### 4. Styling
- Use slate shades for consistent theming
- Pattern: `bg-slate-50`, `text-slate-900`, `border-slate-200`
- Use semantic spacing: `p-4`, `p-6`, `gap-4`
- Responsive design: `md:grid-cols-2`, `lg:grid-cols-3`

### 5. Form Handling
- Use `react-hook-form` with `zod` validation
- Example:
```typescript
const { register, handleSubmit, formState: { errors } } = useForm();
const onSubmit = (data) => api.post('/endpoint', data);
```

## Available Backend API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login with email, password, tenant_slug
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout

### Courses
- `GET /api/v1/courses` - List courses (with filters)
- `GET /api/v1/courses/{id}` - Get course details
- `POST /api/v1/courses` - Create course (admin/teacher)
- `PUT /api/v1/courses/{id}` - Update course
- `DELETE /api/v1/courses/{id}` - Delete course

### Attendance (NEW - Needs Frontend Implementation)
- `POST /api/v1/attendance/courses/{course_id}` - Mark attendance
  - Body: `{ date, records: [{ date, student_id, status, notes }] }`
  - Roles: teacher, admin, superadmin
- `GET /api/v1/attendance/courses/{course_id}` - Get attendance report
  - Query params: `date_from`, `date_to`
  - Returns: `{ course_id, date_range_start, date_range_end, rows: [...] }`
- `GET /api/v1/attendance/courses/{course_id}/date/{date}` - Get attendance for specific date
- `GET /api/v1/attendance/courses/{course_id}/students/{student_id}` - Get student attendance
- `GET /api/v1/attendance/students/me` - Students view own attendance

### Students
- `GET /api/v1/students` - List students (with filters)
- `GET /api/v1/students/{id}` - Get student details
- `POST /api/v1/students` - Create student (admin/teacher)
- `PUT /api/v1/students/{id}` - Update student
- `DELETE /api/v1/students/{id}` - Delete student

## Current TODO / Known Issues

### Attendance Feature (High Priority)
The backend attendance API is fully implemented and tested, but the frontend needs:
1. **Attendance pages/components** - Pages for marking and viewing attendance
2. **Attendance form** - Form to mark attendance for multiple students
3. **Attendance reports** - Display attendance statistics and summaries
4. **Route integration** - Add attendance routes to router
5. **Role-based access** - Ensure teachers can mark, students can view

### Environment Configuration
- Frontend `.env` should have: `VITE_API_BASE_URL=http://localhost:8000`
- Backend is at `http://localhost:8000`
- Database at `localhost:5432`

## Test Data Available
- **Teacher:** sarah.chen@lincoln-unified.edu / Teacher123!
- **Course:** Algebra I (ID: 7c19d74e-7b08-4a29-af05-0f1b2f779283)
- **Students:** 3 enrolled students with IDs available for testing

## Development Commands
```bash
cd frontend
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Build for production
npm run lint       # Run ESLint
npm run preview    # Preview production build
```

## Important Notes
- All API calls go through axios instance in `config/axios.ts`
- JWT refresh is handled automatically on 401 responses
- Use `@/` path alias for imports (configured in vite.config.ts)
- Add new routes in `router/index.tsx`, not in individual files
- Role checks happen at route level via `ProtectedRoute`
