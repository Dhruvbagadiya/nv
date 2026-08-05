// One entry per sidebar row. Add a new page by adding a line here —
// the Sidebar component itself never needs to change.
// iconSvg strings are copied directly from the HTML mockup's inline SVGs.
export const navConfig = [
  {
    label: null, // core section, no header label
    items: [
      { path: '/dashboard', label: 'Dashboard', iconSvg: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>' },
      { path: '/ask-team', label: 'Ask our team', iconSvg: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 0 1 16 0v5"/><rect x="3" y="12" width="4" height="6" rx="1.5"/><rect x="17" y="12" width="4" height="6" rx="1.5"/><path d="M19 18v1a3 3 0 0 1-3 3h-3"/></svg>' },
      { path: '/history', label: 'Course inquiry history', iconSvg: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></svg>' },
      { path: '/add-application', label: 'Add new application', iconSvg: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><polyline points="14 3 14 8 19 8"/><line x1="12" y1="12" x2="12" y2="17"/><line x1="9.5" y1="14.5" x2="14.5" y2="14.5"/></svg>' },
      { path: '/app-history', label: 'Application history', iconSvg: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="8" y1="18" x2="20" y2="18"/><line x1="4" y1="6" x2="4.01" y2="6"/><line x1="4" y1="12" x2="4.01" y2="12"/><line x1="4" y1="18" x2="4.01" y2="18"/></svg>' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { path: '/moi-accepted', label: 'MOI accepted', iconSvg: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><polyline points="14 3 14 8 19 8"/><polyline points="9.5 14 11 15.5 14.5 12"/></svg>' },
      { path: '/commission', label: 'Universities commission', iconSvg: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="19" x2="19" y2="5"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/></svg>' },
      {
        label: 'Entry requirements',
        iconSvg: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><polyline points="4 6 5 7 7 5"/><polyline points="4 12 5 13 7 11"/><polyline points="4 18 5 19 7 17"/></svg>',
        // A parent with `children` renders as a disclosure rather than a link —
        // images 3 and 6 of the reference set show both of these expanding.
        children: [
          { path: '/entry-requirements/ug', label: 'UG requirements' },
          { path: '/entry-requirements/pg', label: 'PG requirements' },
        ],
      },
      { path: '/updates', label: 'Important updates', iconSvg: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v2a2 2 0 0 0 2 2h1l4 4V5l-4 4H5a2 2 0 0 0-2 2z"/><path d="M17 8a5 5 0 0 1 0 8"/><path d="M20 5a9 9 0 0 1 0 14"/></svg>' },
      {
        label: 'Document bank',
        iconSvg: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
        children: [
          { path: '/documents/visa', label: 'Visa documents' },
          { path: '/documents/refund-forms', label: 'Refund forms' },
          { path: '/documents/brochures', label: 'Institute brochures' },
          { path: '/documents/sop', label: 'SOP documents' },
          { path: '/documents/lor', label: 'LOR documents' },
        ],
      },
      { path: '/report', label: 'Report', iconSvg: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="20" x2="4" y2="10"/><line x1="10" y1="20" x2="10" y2="4"/><line x1="16" y1="20" x2="16" y2="14"/><line x1="4" y1="20" x2="20" y2="20"/></svg>' },
    ],
  },
  {
    label: 'Support',
    items: [
      { path: '/help', label: 'Help and support', iconSvg: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.6 1.4c0 1.6-2.1 2-2.1 3.6"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' },
    ],
  },
  {
    label: 'Admin',
    roles: ['ADMIN', 'SUPER_ADMIN'], // section only rendered for these roles — see Sidebar.jsx
    items: [
      { path: '/admin/institutions', label: 'Institutions', iconSvg: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 21v-4h6v4"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1"/></svg>' },
      { path: '/admin/courses', label: 'Courses', iconSvg: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' },
      { path: '/admin/commissions', label: 'Commission rates', iconSvg: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="19" x2="19" y2="5"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/></svg>' },
      { path: '/admin/entry-requirements', label: 'Entry requirements', iconSvg: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><polyline points="4 6 5 7 7 5"/><polyline points="4 12 5 13 7 11"/></svg>' },
      { path: '/admin/updates', label: 'Important updates', iconSvg: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11v2a2 2 0 0 0 2 2h1l4 4V5l-4 4H5a2 2 0 0 0-2 2z"/><path d="M17 8a5 5 0 0 1 0 8"/></svg>' },
      { path: '/admin/documents', label: 'Document bank', iconSvg: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>' },
      { path: '/admin/announcements', label: 'Banners', iconSvg: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16v9H8l-4 4z"/></svg>' },
      { path: '/admin/support-contacts', label: 'Support team', iconSvg: '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="18" cy="9" r="2.5"/></svg>' },
    ],
  },
];
