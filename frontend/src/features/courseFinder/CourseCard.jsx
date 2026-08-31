import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import CourseDetailModal from './CourseDetailModal.jsx';
import { formatFee } from '../../utils/format.js';

// Props shape matches the program resource returned by the backend:
//   { id, type: "program", attributes: { name, programLevel, school, programIntakes,
//     tuition, applicationFee, minLength, maxLength, tags, badges, commission, ... } }

// Convert ProgramLevel enum value to a human-readable label.
const PROGRAM_LEVEL_LABELS = {
  MASTERS_DEGREE:            "Master's Degree",
  POST_GRADUATE_CERTIFICATE: 'Postgraduate Certificate',
  BACHELORS_DEGREE:          "Bachelor's Degree",
  THREE_YEAR_BACHELORS:      '3-Year Bachelor\'s',
  FOUR_YEAR_BACHELORS:       '4-Year Bachelor\'s',
  DIPLOMA:                   'Diploma',
  CERTIFICATE:               'Certificate',
  FOUNDATION:                'Foundation',
  OTHER:                     'Program',
};

function programLevelLabel(level) {
  if (!level) return 'Program';
  // API returns snake_case slugs (e.g. "masters_degree"); DB enum is UPPER_SNAKE.
  const key = level.toUpperCase();
  return PROGRAM_LEVEL_LABELS[key] ?? level;
}

// Format duration from min/max month integers.
function formatDuration(min, max) {
  if (!min && !max) return null;
  if (min === max) return `${min} months`;
  return `${min} – ${max} months`;
}

export default function CourseCard({ program }) {
  const { id, attributes: attr } = program;
  const { school } = attr;
  const [showDetail, setShowDetail] = useState(false);

  const initials = school.name.slice(0, 2).toUpperCase();
  const currency = attr.currency ?? 'USD';
  const duration = formatDuration(attr.minLength, attr.maxLength);

  // Intake display: show the startDate of each intake, formatted as "Jan 2027".
  const intakeLabels = (attr.programIntakes ?? []).map((i) => {
    const d = new Date(i.startDate);
    return Number.isNaN(d.getTime())
      ? i.startDate
      : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  });

  // Badges are human-readable pill strings (e.g. "Instant Offer").
  // Tags are machine slugs (e.g. "top_programs") — convert for display.
  const displayTags = (attr.tags ?? []).map((t) =>
    t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );

  return (
    <div className="card">
      <div className="card-body">
        <div className="card-top">
          <div className="school-row">
            {school.logoThumbnailUrl ? (
              <img
                className="school-logo"
                src={school.logoThumbnailUrl}
                alt={school.name}
                onError={(e) => {
                  e.currentTarget.replaceWith(
                    Object.assign(document.createElement('div'), {
                      className: 'school-logo',
                      textContent: initials,
                    })
                  );
                }}
              />
            ) : (
              <div className="school-logo">{initials}</div>
            )}
            <div className="school-name">{school.name}</div>
          </div>
          <div className="status-stack">
            {(attr.badges ?? []).map((s) => (
              <span
                key={s}
                className={`status-pill ${s === 'Instant Offer' ? 'offer' : 'submission'}`}
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="degree-label">{programLevelLabel(attr.programLevel)}</div>
        <div className="course-title">{attr.name}</div>

        {displayTags.length > 0 && (
          <div className="tags">
            {displayTags.map((t) => (
              <span key={t} className="tag-pill green">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="info-grid">
          <div className="info-tile">
            <div className="i-label">Location</div>
            <div className="i-value">{school.countryCode}</div>
          </div>
          <div className="info-tile">
            <div className="i-label">Campus city</div>
            <div className="i-value">{school.city ?? '—'}</div>
          </div>
          <div className="info-tile">
            <div className="i-label">Tuition (1st yr)</div>
            <div className="i-value mono">{formatFee(attr.tuition, currency)}</div>
          </div>
          <div className="info-tile">
            <div className="i-label">Application fee</div>
            {/* Same three states as the detail view: null is "not published",
                which must not read as a free one. */}
            <div className="i-value mono">
              {attr.applicationFee == null
                ? 'Unknown'
                : attr.applicationFee > 0
                  ? formatFee(attr.applicationFee, currency)
                  : 'None'}
            </div>
          </div>
          {duration && (
            <div className="info-tile">
              <div className="i-label">Duration</div>
              <div className="i-value">{duration}</div>
            </div>
          )}
          {attr.commissionAmount != null && (
            <div className="info-tile">
              <div className="i-label">Commission</div>
              <div className="i-value mono">{formatFee(attr.commissionAmount, currency)}</div>
            </div>
          )}
        </div>

        {intakeLabels.length > 0 && (
          <div className="intakes">
            <div className="intakes-label">Available intakes</div>
            <div className="intake-list">
              {intakeLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>
        )}

        <div className="card-actions">
          <Link className="btn btn-primary" to={`/partner/add-application?courseId=${id}`}>
            Create application
          </Link>
          {/* The whole payload is already here, so this opens with no request. */}
          <button
            type="button"
            className="detail-btn"
            onClick={() => setShowDetail(true)}
            aria-label={`View details for ${attr.name}`}
            title="View details"
          >
            <Icon name="eye" size={16} />
          </button>
        </div>
      </div>

      {showDetail && (
        <CourseDetailModal program={program} onClose={() => setShowDetail(false)} />
      )}
    </div>
  );
}
