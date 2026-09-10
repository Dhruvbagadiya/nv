// Sidebar navigation tree.
//
// `icon` is a key into the shared registry in components/ui/Icon.jsx. It used to
// be an `iconSvg` string of raw markup injected with dangerouslySetInnerHTML —
// 24 of them, six pairs byte-identical to each other and six more duplicating
// icons that AdminDashboard.jsx also defined locally. Names cost nothing to
// dedupe and remove both innerHTML sinks.
//
// iconNames.test.jsx asserts every name here resolves, because a typo would
// otherwise render nothing at all with no error.
export const navConfig = [
  {
    label: null,
    items: [
      { path: '/partner/dashboard',       label: 'Dashboard',              icon: 'dashboard' },
      { path: '/partner/ask-team',        label: 'Ask our team',           icon: 'headset' },
      { path: '/partner/history',         label: 'Course inquiry history', icon: 'clock' },
      { path: '/partner/add-application', label: 'Add new application',    icon: 'application' },
      { path: '/partner/app-history',     label: 'Application history',    icon: 'list' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { path: '/partner/moi-accepted', label: 'MOI accepted',            icon: 'moi' },
      { path: '/partner/commission',   label: 'Universities commission', icon: 'commission' },
      {
        label: 'Entry requirements',
        icon: 'checklist',
        children: [
          { path: '/partner/entry-requirements/ug', label: 'UG requirements' },
          { path: '/partner/entry-requirements/pg', label: 'PG requirements' },
        ],
      },
      { path: '/partner/updates', label: 'Important updates', icon: 'megaphone' },
      {
        label: 'Document bank',
        icon: 'folder',
        children: [
          { path: '/partner/documents/visa',         label: 'Visa documents' },
          { path: '/partner/documents/refund-forms', label: 'Refund forms' },
          { path: '/partner/documents/brochures',    label: 'Institute brochures' },
          { path: '/partner/documents/sop',          label: 'SOP documents' },
          { path: '/partner/documents/lor',          label: 'LOR documents' },
        ],
      },
      { path: '/partner/report', label: 'Report', icon: 'chart' },
    ],
  },
  {
    label: 'Support',
    items: [
      { path: '/partner/help',     label: 'Help and support', icon: 'help' },
      { path: '/partner/settings', label: 'Agency settings',  icon: 'settings', roles: ['AGENT'] },
      { path: '/partner/profile',  label: 'My profile',       icon: 'user' },
    ],
  },
  {
    label: 'Admin',
    roles: ['ADMIN', 'SUPER_ADMIN'],
    items: [
      { path: '/admin',                    label: 'Admin overview',     icon: 'dashboard' },
      { path: '/admin/countries',          label: 'Countries',          icon: 'globe' },
      { path: '/admin/institutions',       label: 'Institutions',       icon: 'institution' },
      { path: '/admin/courses',            label: 'Courses',            icon: 'course' },
      { path: '/admin/commissions',        label: 'Commission rates',   icon: 'commission' },
      { path: '/admin/entry-requirements', label: 'Entry requirements', icon: 'checklist' },
      { path: '/admin/moi',                label: 'MOI acceptances',    icon: 'moi' },
      { path: '/admin/updates',            label: 'Important updates',  icon: 'megaphone' },
      { path: '/admin/documents',          label: 'Document bank',      icon: 'folder' },
      { path: '/admin/announcements',      label: 'Banners',            icon: 'banner' },
      { path: '/admin/support-contacts',   label: 'Support team',       icon: 'users' },
      { path: '/admin/applications',       label: 'All applications',   icon: 'list' },
      { path: '/admin/course-inquiries',   label: 'Course inquiries',   icon: 'help' },
      { path: '/admin/useful-information', label: 'Useful information', icon: 'info' },
      { path: '/admin/users', roles: ['SUPER_ADMIN'], label: 'Users',   icon: 'userPlus' },
    ],
  },
];
