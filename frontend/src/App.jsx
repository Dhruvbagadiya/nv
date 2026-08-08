import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/layout/Header.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import AnnouncementBar from './components/layout/AnnouncementBar.jsx';
import CourseFinder from './features/courseFinder/CourseFinder.jsx';
import CourseInquiryForm from './features/courseInquiries/CourseInquiryForm.jsx';
import CourseInquiryHistory from './features/courseInquiries/CourseInquiryHistory.jsx';
import NewApplication from './features/applications/NewApplication.jsx';
import ApplicationHistory from './features/applications/ApplicationHistory.jsx';
import MoiAccepted from './features/moiAccepted/MoiAccepted.jsx';
import Commission from './features/commission/Commission.jsx';
import EntryRequirements from './features/entryRequirements/EntryRequirements.jsx';
import ImportantUpdates from './features/importantUpdates/ImportantUpdates.jsx';
import DocumentBank from './features/documentBank/DocumentBank.jsx';
import Report from './features/report/Report.jsx';
import HelpSupport from './features/help/HelpSupport.jsx';
import LoginPage from './features/auth/LoginPage.jsx';

// Admin pages
import AdminDashboard from './features/admin/AdminDashboard.jsx';
import AdminInstitutions from './features/admin/AdminInstitutions.jsx';
import AdminCourses from './features/admin/AdminCourses.jsx';
import AdminCommissions from './features/admin/AdminCommissions.jsx';
import AdminEntryRequirements from './features/admin/AdminEntryRequirements.jsx';
import AdminMoiAcceptances from './features/admin/AdminMoiAcceptances.jsx';
import AdminUpdates from './features/admin/AdminUpdates.jsx';
import AdminDocuments from './features/admin/AdminDocuments.jsx';
import AdminAnnouncements from './features/admin/AdminAnnouncements.jsx';
import AdminSupportContacts from './features/admin/AdminSupportContacts.jsx';
import AdminUsers from './features/admin/AdminUsers.jsx';

import ProtectedRoute from './routes/ProtectedRoute.jsx';
import NotFound from './routes/NotFound.jsx';

const ADMIN_ROLES       = ['ADMIN', 'SUPER_ADMIN'];
const SUPER_ADMIN_ROLES = ['SUPER_ADMIN'];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <>
              <Header />
              <div className="layout">
                <Sidebar />
                <main className="main">
                  <AnnouncementBar />
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard"     element={<CourseFinder />} />
                    <Route path="/ask-team"       element={<CourseInquiryForm />} />
                    <Route path="/history"        element={<CourseInquiryHistory />} />
                    <Route path="/add-application" element={<NewApplication />} />
                    <Route path="/app-history"    element={<ApplicationHistory />} />

                    {/* Operations */}
                    <Route path="/moi-accepted"   element={<MoiAccepted />} />
                    <Route path="/commission"     element={<Commission />} />
                    <Route path="/entry-requirements" element={<Navigate to="/entry-requirements/ug" replace />} />
                    <Route path="/entry-requirements/ug" element={<EntryRequirements level="UG" />} />
                    <Route path="/entry-requirements/pg" element={<EntryRequirements level="PG" />} />
                    <Route path="/updates"        element={<ImportantUpdates />} />
                    <Route path="/documents"      element={<Navigate to="/documents/visa" replace />} />
                    <Route path="/documents/visa"         element={<DocumentBank category="VISA_DOCUMENT" />} />
                    <Route path="/documents/refund-forms" element={<DocumentBank category="REFUND_FORM" />} />
                    <Route path="/documents/brochures"    element={<DocumentBank category="INSTITUTE_BROCHURE" />} />
                    <Route path="/documents/sop"          element={<DocumentBank category="SOP" />} />
                    <Route path="/documents/lor"          element={<DocumentBank category="LOR" />} />
                    <Route path="/report"         element={<Report />} />

                    {/* Support */}
                    <Route path="/help"           element={<HelpSupport />} />

                    {/* ── Admin section ─────────────────────────────────── */}
                    <Route path="/admin" element={
                      <ProtectedRoute allowedRoles={ADMIN_ROLES}><AdminDashboard /></ProtectedRoute>
                    } />
                    <Route path="/admin/institutions" element={
                      <ProtectedRoute allowedRoles={ADMIN_ROLES}><AdminInstitutions /></ProtectedRoute>
                    } />
                    <Route path="/admin/courses" element={
                      <ProtectedRoute allowedRoles={ADMIN_ROLES}><AdminCourses /></ProtectedRoute>
                    } />
                    <Route path="/admin/commissions" element={
                      <ProtectedRoute allowedRoles={ADMIN_ROLES}><AdminCommissions /></ProtectedRoute>
                    } />
                    <Route path="/admin/entry-requirements" element={
                      <ProtectedRoute allowedRoles={ADMIN_ROLES}><AdminEntryRequirements /></ProtectedRoute>
                    } />
                    <Route path="/admin/moi" element={
                      <ProtectedRoute allowedRoles={ADMIN_ROLES}><AdminMoiAcceptances /></ProtectedRoute>
                    } />
                    <Route path="/admin/updates" element={
                      <ProtectedRoute allowedRoles={ADMIN_ROLES}><AdminUpdates /></ProtectedRoute>
                    } />
                    <Route path="/admin/documents" element={
                      <ProtectedRoute allowedRoles={ADMIN_ROLES}><AdminDocuments /></ProtectedRoute>
                    } />
                    <Route path="/admin/announcements" element={
                      <ProtectedRoute allowedRoles={ADMIN_ROLES}><AdminAnnouncements /></ProtectedRoute>
                    } />
                    <Route path="/admin/support-contacts" element={
                      <ProtectedRoute allowedRoles={ADMIN_ROLES}><AdminSupportContacts /></ProtectedRoute>
                    } />
                    <Route path="/admin/users" element={
                      <ProtectedRoute allowedRoles={SUPER_ADMIN_ROLES}><AdminUsers /></ProtectedRoute>
                    } />

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </main>
              </div>
            </>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
