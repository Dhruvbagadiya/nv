import { Routes, Route, Navigate } from 'react-router-dom';

// ── Public marketing site ──────────────────────────────────────────────
import LandingPage from './features/landing/LandingPage.jsx';

// ── Partner portal ─────────────────────────────────────────────────────
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
import PartnerLoginPage from './features/auth/PartnerLoginPage.jsx';
import AgencySettings from './features/partner/AgencySettings.jsx';
import ProfilePage    from './features/profile/ProfilePage.jsx';

// ── Admin panel ────────────────────────────────────────────────────────
import AdminLoginPage from './features/auth/AdminLoginPage.jsx';
import ForgotPasswordPage from './features/auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from './features/auth/ResetPasswordPage.jsx';
import AdminDashboard from './features/admin/AdminDashboard.jsx';
import AdminCountries from './features/admin/AdminCountries.jsx';
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
import AdminApplications from './features/admin/AdminApplications.jsx';

// ── Student portal ─────────────────────────────────────────────────────
import StudentLoginPage from './features/student/StudentLoginPage.jsx';
import StudentShell from './features/student/StudentShell.jsx';
import StudentProgramBrowser from './features/student/StudentProgramBrowser.jsx';
import StudentProgramDetail from './features/student/StudentProgramDetail.jsx';
import StudentApplyForm from './features/student/StudentApplyForm.jsx';
import StudentApplications from './features/student/StudentApplications.jsx';
import StudentApplicationDetail from './features/student/StudentApplicationDetail.jsx';
import StudentProfile from './features/student/StudentProfile.jsx';

import ProtectedRoute from './routes/ProtectedRoute.jsx';
import NotFound from './routes/NotFound.jsx';

const ADMIN_ROLES       = ['ADMIN', 'SUPER_ADMIN'];
const SUPER_ADMIN_ROLES = ['SUPER_ADMIN'];
const PARTNER_ROLES     = ['AGENT', 'ADMIN', 'SUPER_ADMIN'];

// Shared shell wrapper for partner routes
function PartnerShell({ children }) {
  return (
    <>
      <Header />
      <div className="layout">
        <Sidebar />
        <main className="main">
          {/* Blacklist + declaration-form banners hidden for now. Restore by
              uncommenting; the announcements themselves are still in the DB and
              editable at /admin/announcements. */}
          {/* <AnnouncementBar /> */}
          {children}
        </main>
      </div>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      {/* ── Public marketing home ─────────────────────── */}
      {/* Was a redirect to /login, which meant anyone arriving at the bare
          domain was asked to sign in before being told what the company does. */}
      <Route path="/" element={<LandingPage />} />

      {/* ── Student portal ────────────────────────────── */}
      <Route path="/login"    element={<StudentLoginPage />} />
      {/* Portal-agnostic: a reset link works for any role, so these sit at the
          root rather than being duplicated under /partner and /admin. */}
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password"  element={<ResetPasswordPage />} />

      {/* Public student routes (no auth needed to browse) */}
      <Route path="/programs" element={
        <StudentShell><StudentProgramBrowser /></StudentShell>
      } />
      <Route path="/programs/:id" element={
        <StudentShell><StudentProgramDetail /></StudentShell>
      } />

      {/* Protected student routes */}
      <Route path="/apply/:courseId" element={
        <ProtectedRoute allowedRoles={['STUDENT']} loginPath="/login" redirectPath="/programs">
          <StudentShell><StudentApplyForm /></StudentShell>
        </ProtectedRoute>
      } />
      <Route path="/my-applications" element={
        <ProtectedRoute allowedRoles={['STUDENT']} loginPath="/login" redirectPath="/programs">
          <StudentShell><StudentApplications /></StudentShell>
        </ProtectedRoute>
      } />
      <Route path="/my-applications/:id" element={
        <ProtectedRoute allowedRoles={['STUDENT']} loginPath="/login" redirectPath="/programs">
          <StudentShell><StudentApplicationDetail /></StudentShell>
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute allowedRoles={['STUDENT']} loginPath="/login" redirectPath="/programs">
          <StudentShell><ProfilePage /></StudentShell>
        </ProtectedRoute>
      } />

      {/* ── Partner portal ────────────────────────────── */}
      <Route path="/partner/login" element={<PartnerLoginPage />} />
      <Route path="/partner/*" element={
        <ProtectedRoute allowedRoles={PARTNER_ROLES} loginPath="/partner/login" redirectPath="/partner/dashboard">
          <PartnerShell>
            <Routes>
              <Route path="/" element={<Navigate to="/partner/dashboard" replace />} />
              <Route path="dashboard"       element={<CourseFinder />} />
              <Route path="ask-team"         element={<CourseInquiryForm />} />
              <Route path="history"          element={<CourseInquiryHistory />} />
              <Route path="add-application"  element={<NewApplication />} />
              <Route path="app-history"      element={<ApplicationHistory />} />
              <Route path="moi-accepted"     element={<MoiAccepted />} />
              <Route path="commission"       element={<Commission />} />
              <Route path="entry-requirements" element={<Navigate to="/partner/entry-requirements/ug" replace />} />
              <Route path="entry-requirements/ug" element={<EntryRequirements level="UG" />} />
              <Route path="entry-requirements/pg" element={<EntryRequirements level="PG" />} />
              <Route path="updates"          element={<ImportantUpdates />} />
              <Route path="documents"        element={<Navigate to="/partner/documents/visa" replace />} />
              <Route path="documents/visa"         element={<DocumentBank category="VISA_DOCUMENT" />} />
              <Route path="documents/refund-forms" element={<DocumentBank category="REFUND_FORM" />} />
              <Route path="documents/brochures"    element={<DocumentBank category="INSTITUTE_BROCHURE" />} />
              <Route path="documents/sop"          element={<DocumentBank category="SOP" />} />
              <Route path="documents/lor"          element={<DocumentBank category="LOR" />} />
              <Route path="report"           element={<Report />} />
              <Route path="help"             element={<HelpSupport />} />
              <Route path="settings"         element={<AgencySettings />} />
              <Route path="profile"          element={<ProfilePage />} />
              <Route path="*"               element={<NotFound />} />
            </Routes>
          </PartnerShell>
        </ProtectedRoute>
      } />

      {/* ── Admin panel ───────────────────────────────── */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={ADMIN_ROLES} loginPath="/admin/login" redirectPath="/partner/dashboard">
          <PartnerShell><AdminDashboard /></PartnerShell>
        </ProtectedRoute>
      } />
      <Route path="/admin/*" element={
        <ProtectedRoute allowedRoles={ADMIN_ROLES} loginPath="/admin/login" redirectPath="/partner/dashboard">
          <PartnerShell>
            <Routes>
              <Route path="institutions"      element={<AdminInstitutions />} />
              <Route path="countries"          element={<AdminCountries />} />
              <Route path="courses"           element={<AdminCourses />} />
              <Route path="commissions"       element={<AdminCommissions />} />
              <Route path="entry-requirements" element={<AdminEntryRequirements />} />
              <Route path="moi"               element={<AdminMoiAcceptances />} />
              <Route path="updates"           element={<AdminUpdates />} />
              <Route path="documents"         element={<AdminDocuments />} />
              <Route path="announcements"     element={<AdminAnnouncements />} />
              <Route path="support-contacts"  element={<AdminSupportContacts />} />
              <Route path="applications"      element={<AdminApplications />} />
              <Route path="users" element={
                <ProtectedRoute allowedRoles={SUPER_ADMIN_ROLES} loginPath="/admin/login" redirectPath="/admin">
                  <AdminUsers />
                </ProtectedRoute>
              } />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PartnerShell>
        </ProtectedRoute>
      } />

      {/* ── Catch-all ─────────────────────────────────── */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
