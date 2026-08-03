import { Routes, Route } from 'react-router-dom';
import Header from './components/layout/Header.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import CourseFinder from './features/courseFinder/CourseFinder.jsx';
import CourseInquiryForm from './features/courseInquiries/CourseInquiryForm.jsx';
import CourseInquiryHistory from './features/courseInquiries/CourseInquiryHistory.jsx';
import NewApplication from './features/applications/NewApplication.jsx';
import ApplicationHistory from './features/applications/ApplicationHistory.jsx';
import MoiAccepted from './features/moiAccepted/MoiAccepted.jsx';
import LoginPage from './features/auth/LoginPage.jsx';
import AdminInstitutions from './features/admin/AdminInstitutions.jsx';
import AdminCourses from './features/admin/AdminCourses.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

// /login is the one public route. Everything else renders inside the
// app shell (Header + Sidebar) and is wrapped in ProtectedRoute, which
// bounces unauthenticated visitors to /login and remembers where they
// were headed so they land back there after signing in. Admin routes
// get a second, nested ProtectedRoute with allowedRoles — an Agent who
// is logged in but not an Admin gets redirected to /dashboard instead.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div className="app-shell">
              <Header />
              <div className="layout">
                <Sidebar />
                <main className="main">
                  <Routes>
                    <Route path="/" element={<CourseFinder />} />
                    <Route path="/dashboard" element={<CourseFinder />} />
                    <Route path="/ask-team" element={<CourseInquiryForm />} />
                    <Route path="/history" element={<CourseInquiryHistory />} />
                    <Route path="/add-application" element={<NewApplication />} />
                    <Route path="/app-history" element={<ApplicationHistory />} />
                    <Route path="/moi-accepted" element={<MoiAccepted />} />
                    <Route
                      path="/admin/institutions"
                      element={
                        <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                          <AdminInstitutions />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/courses"
                      element={
                        <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                          <AdminCourses />
                        </ProtectedRoute>
                      }
                    />
                  </Routes>
                </main>
              </div>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
