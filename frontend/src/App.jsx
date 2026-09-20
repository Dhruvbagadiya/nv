import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

// ── Public marketing site ──────────────────────────────────────────────
import LandingPage from './features/landing/LandingPage.jsx';

// ── Partner portal ─────────────────────────────────────────────────────
import ErrorBoundary from './components/ui/ErrorBoundary.jsx';
import Header from './components/layout/Header.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import PartnerLoginPage from './features/auth/PartnerLoginPage.jsx';

// ── Admin panel ────────────────────────────────────────────────────────
import AdminLoginPage from './features/auth/AdminLoginPage.jsx';
import ForgotPasswordPage from './features/auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from './features/auth/ResetPasswordPage.jsx';

// ── Student portal ─────────────────────────────────────────────────────
import StudentLoginPage from './features/student/StudentLoginPage.jsx';

/**
 * Every screen behind a login, loaded when it is first opened.
 *
 * All 79 routes were imported eagerly, so the bundle was one 612 kB file and a
 * visitor to the marketing page downloaded the entire admin panel and student
 * portal before the hero rendered. Nobody is all three of an agent, an admin and
 * a student, and most people are none of them.
 *
 * WHAT STAYS EAGER is the part that decides where you go: the landing page, the
 * five auth screens, the shell chrome and ProtectedRoute. Splitting those would
 * add a network round trip to the first paint of the only pages an anonymous
 * visitor ever sees — a loading spinner in place of the thing they came for.
 *
 * This was held back until there were error boundaries. React.lazy CREATES a
 * white-screen class that eager imports do not have: a chunk that 404s after a
 * deploy throws during render, and with nothing to catch it that is the blank
 * page all over again. Both shells and the root have a boundary now, so a failed
 * chunk shows the retry and keeps the navigation.
 */
const IntegrationCardDemo = lazy(() => import('./components/ui/integration-card.tsx'));
const CourseFinder = lazy(() => import('./features/courseFinder/CourseFinder.jsx'));
const PartnerDashboard = lazy(() => import('./features/partner/PartnerDashboard.jsx'));
const CourseInquiryForm = lazy(() => import('./features/courseInquiries/CourseInquiryForm.jsx'));
const CourseInquiryHistory = lazy(() => import('./features/courseInquiries/CourseInquiryHistory.jsx'));
const NewApplication = lazy(() => import('./features/applications/NewApplication.jsx'));
const ApplicationHistory = lazy(() => import('./features/applications/ApplicationHistory.jsx'));
const NotificationsPage = lazy(() => import('./features/partner/NotificationsPage.jsx'));
const MoiAccepted = lazy(() => import('./features/moiAccepted/MoiAccepted.jsx'));
const Commission = lazy(() => import('./features/commission/Commission.jsx'));
const EntryRequirements = lazy(() => import('./features/entryRequirements/EntryRequirements.jsx'));
const ImportantUpdates = lazy(() => import('./features/importantUpdates/ImportantUpdates.jsx'));
const DocumentBank = lazy(() => import('./features/documentBank/DocumentBank.jsx'));
const Report = lazy(() => import('./features/report/Report.jsx'));
const HelpSupport = lazy(() => import('./features/help/HelpSupport.jsx'));
const AgencySettings = lazy(() => import('./features/partner/AgencySettings.jsx'));
const ProfilePage = lazy(() => import('./features/profile/ProfilePage.jsx'));
const AdminDashboard = lazy(() => import('./features/admin/AdminDashboard.jsx'));
const AdminActivity = lazy(() => import('./features/admin/AdminActivity.jsx'));
const AdminCountries = lazy(() => import('./features/admin/AdminCountries.jsx'));
const AdminInstitutions = lazy(() => import('./features/admin/AdminInstitutions.jsx'));
const AdminCourses = lazy(() => import('./features/admin/AdminCourses.jsx'));
const AdminCommissions = lazy(() => import('./features/admin/AdminCommissions.jsx'));
const AdminEntryRequirements = lazy(() => import('./features/admin/AdminEntryRequirements.jsx'));
const AdminMoiAcceptances = lazy(() => import('./features/admin/AdminMoiAcceptances.jsx'));
const AdminUpdates = lazy(() => import('./features/admin/AdminUpdates.jsx'));
const AdminDocuments = lazy(() => import('./features/admin/AdminDocuments.jsx'));
const AdminUsefulInformation = lazy(() => import('./features/admin/AdminUsefulInformation.jsx'));
const AdminCourseInquiries = lazy(() => import('./features/admin/AdminCourseInquiries.jsx'));
const AdminAnnouncements = lazy(() => import('./features/admin/AdminAnnouncements.jsx'));
const AdminSupportContacts = lazy(() => import('./features/admin/AdminSupportContacts.jsx'));
const AdminUsers = lazy(() => import('./features/admin/AdminUsers.jsx'));
const AdminApplications = lazy(() => import('./features/admin/AdminApplications.jsx'));
const StudentShell = lazy(() => import('./features/student/StudentShell.jsx'));
const StudentProgramBrowser = lazy(() => import('./features/student/StudentProgramBrowser.jsx'));
const StudentProgramDetail = lazy(() => import('./features/student/StudentProgramDetail.jsx'));
const StudentApplyForm = lazy(() => import('./features/student/StudentApplyForm.jsx'));
const StudentApplications = lazy(() => import('./features/student/StudentApplications.jsx'));
const StudentApplicationDetail = lazy(() => import('./features/student/StudentApplicationDetail.jsx'));

import ProtectedRoute from './routes/ProtectedRoute.jsx';
import NotFound from './routes/NotFound.jsx';
import ToastStack from './components/ui/ToastStack.jsx';

/**
 * What a screen shows while its chunk is in flight.
 *
 * Deliberately not a spinner. On a warm cache this renders for a handful of
 * milliseconds, and a spinner that flashes for 40ms reads as a glitch — the
 * skeleton is a quiet block that looks like the page arriving, and animates
 * slowly enough that a fast load looks like nothing happened at all.
 */
function ScreenLoading() {
  return <div className="screen-loading" role="status" aria-label="Loading" />;
}

const ADMIN_ROLES       = ['ADMIN', 'SUPER_ADMIN'];
const SUPER_ADMIN_ROLES = ['SUPER_ADMIN'];
const PARTNER_ROLES     = ['AGENT', 'ADMIN', 'SUPER_ADMIN'];

// Shared shell wrapper for partner routes
function PartnerShell({ children }) {
  const { pathname } = useLocation();
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
          {/* Inside <main>, not around the whole shell: a screen that throws
              should not take the header and sidebar with it, which is exactly
              what made the old white page unrecoverable. Keyed on the path so
              navigating away from a broken screen clears the error rather than
              carrying it to the next one. */}
          <ErrorBoundary key={pathname}>
            {/* Inside the shell, so the header and sidebar stay up while a
                chunk arrives. A Suspense at the root would blank the whole
                frame on every first visit to a section. */}
            <Suspense fallback={<ScreenLoading />}>{children}</Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </>
  );
}

export default function App() {
  return (
    <>
    <ToastStack />
    {/* Backstop for anything thrown outside a shell — the landing page, the
        auth screens, or a route element itself. */}
    <ErrorBoundary title="Something went wrong">
    {/* Backstop, for the lazy routes that are not inside a shell — the student
        portal has its own, and a route element can suspend before any shell
        renders. */}
    <Suspense fallback={<ScreenLoading />}>
    <Routes>
      {/* ── Public marketing home ─────────────────────── */}
      {/* Was a redirect to /login, which meant anyone arriving at the bare
          domain was asked to sign in before being told what the company does. */}
      <Route path="/" element={<LandingPage />} />

      {/* Preview route for the shadcn/Tailwind integration card. Lazy, so none
          of Tailwind, motion or Base UI lands in the main chunk — nothing on the
          public site pays for it. Delete this route and the component to remove
          the whole stack addition. */}
      <Route path="/ui-demo" element={<IntegrationCardDemo />} />

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
              <Route path="dashboard"       element={<PartnerDashboard />} />
              {/* The catalogue is a task, not a summary. It lived at
                  /partner/dashboard under a heading that said Dashboard. */}
              <Route path="courses"         element={<CourseFinder />} />
              <Route path="ask-team"         element={<CourseInquiryForm />} />
              <Route path="history"          element={<CourseInquiryHistory />} />
              <Route path="add-application"  element={<NewApplication />} />
              <Route path="app-history"      element={<ApplicationHistory />} />
              <Route path="notifications"    element={<NotificationsPage />} />
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
              <Route path="course-inquiries"  element={<AdminCourseInquiries />} />
              <Route path="activity"          element={<AdminActivity />} />
              <Route path="useful-information" element={<AdminUsefulInformation />} />
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
    </Suspense>
    </ErrorBoundary>
    </>
  );
}
