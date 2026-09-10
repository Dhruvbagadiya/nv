import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import Flag from '../../components/ui/Flag.jsx';
import CourseDetailModal from './CourseDetailModal.jsx';
import { formatFee } from '../../utils/format.js';
import { programLevelLabel } from '../../constants/referenceData.js';
import { monthLabels, nextIntakes, formatIntake } from '../../utils/intakes.js';

/**
 * One program, as an agent scans it.
 *
 * The card used to print the same fact up to three times. Intakes arrived from
 * three places — scraped `badges` ("Jan intake"), scraped `tags` ("Intake Jan")
 * and the structured `intakeMonths` — and all three rendered, so a course
 * running in January, May and September showed nine pills saying so. "Fee
 * Unknown" came through as a tag as well, directly above the Application fee
 * line already reading "Unknown".
 *
 * Structured data wins and the scraped restatements are dropped. What is left of
 * badges and tags is the part that actually adds something: Instant Offer,
 * Scholarships, Prime.
 */

// The two feeds word the same thing differently and neither is stable, so this
// matches on shape rather than on a list of exact strings: anything mentioning an
// intake, anything made of nothing but month names, and the fee placeholder.
const MONTH_WORD = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*$/i;

function restatesStructuredData(label, showsIntakes) {
  const text = label.trim();
  if (/fee\s*unknown/i.test(text)) return true;
  // Only worth dropping while the card is actually printing the months; on a
  // course with neither dated intakes nor intake months, "January Intake" is the
  // only intake information there is.
  if (!showsIntakes) return false;
  if (/\bintakes?\b/i.test(text)) return true;
  // "Jan", "Jan / May / Sep" — a label that is nothing but months. Deliberately
  // not a loose \bmay\b, which would also swallow "May apply without IELTS".
  const words = text.split(/[\s,/&+-]+/).filter(Boolean);
  return words.length > 0 && words.every((w) => MONTH_WORD.test(w));
}

// Duration from min/max month integers.
function formatDuration(min, max) {
  if (!min && !max) return null;
  if (min === max) return `${min} months`;
  return `${min} – ${max} months`;
}

export default function CourseCard({ program }) {
  const { id, attributes: attr } = program;
  const { school } = attr;
  const [showDetail, setShowDetail] = useState(false);
  // A broken logo URL falls back to initials through state, not by swapping the
  // DOM node out from under React — the node belongs to React, and replacing it
  // by hand breaks the next render of the card.
  const [logoFailed, setLogoFailed] = useState(false);

  const initials = school.name.slice(0, 2).toUpperCase();
  const currency = attr.currency ?? 'USD';
  const duration = formatDuration(attr.minLength, attr.maxLength);

  // Dated intakes are shown as published. Where a course only states which
  // months it runs in, the next few dates are derived from today instead --
  // that is the whole reason the months are stored without a year.
  const datedLabels = (attr.programIntakes ?? []).map((i) => {
    const d = new Date(i.startDate);
    return Number.isNaN(d.getTime())
      ? i.startDate
      : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  });
  const intakeLabels = datedLabels.length
    ? datedLabels
    : nextIntakes(attr.intakeMonths, 3).map(formatIntake);
  const recurring = !datedLabels.length && monthLabels(attr.intakeMonths).length > 0;

  // Badges are human-readable ("Instant Offer"); tags are machine slugs
  // ("top_programs"). Both are deduplicated against the structured fields above,
  // then merged — the two feeds label the same thing in both places.
  // Deduplicated case-insensitively and badges first: the same highlight arrives
  // in both feeds with different casing — "Fast LOA" as a badge, "fast_loa" as a
  // tag — and a Set of the raw strings keeps both.
  const highlights = [
    ...new Map(
      [
        ...(attr.badges ?? []),
        ...(attr.tags ?? []).map((t) =>
          t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        ),
      ]
        .filter((label) => !restatesStructuredData(label, intakeLabels.length > 0))
        .map((label) => [label.toLowerCase(), label])
    ).values(),
  ];

  const place = [school.city, school.countryName ?? school.countryCode]
    .filter(Boolean)
    .join(', ');

  const applicationFee =
    attr.applicationFee == null
      ? null
      : attr.applicationFee > 0
        ? formatFee(attr.applicationFee, currency)
        : 'Free';

  return (
    <article className="pcard">
      {/* ── Who ───────────────────────────────────────────────────────────── */}
      <header className="pcard__head">
        {school.logoThumbnailUrl && !logoFailed ? (
          <img
            className="pcard__logo"
            src={school.logoThumbnailUrl}
            alt=""
            loading="lazy"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <div className="pcard__logo pcard__logo--initials">{initials}</div>
        )}

        <div className="pcard__who">
          {/* Wraps to two lines rather than truncating to "Anglia…" — the
              institution is how an agent recognises the row. */}
          <div className="pcard__school" title={school.name}>{school.name}</div>
          <div className="pcard__place">
            <Flag isoCode={school.countryIso} code={school.countryCode} size={14} />
            <span>{place}</span>
          </div>
        </div>
      </header>

      {/* ── What ──────────────────────────────────────────────────────────── */}
      <div className="pcard__level">{programLevelLabel(attr.programLevel)}</div>
      <h3 className="pcard__title">{attr.name}</h3>

      {highlights.length > 0 && (
        <div className="pcard__highlights">
          {highlights.map((h) => (
            <span key={h} className="pcard__highlight">{h}</span>
          ))}
        </div>
      )}

      {/* ── What it costs ─────────────────────────────────────────────────
          Tuition is the number an agent is comparing, so it carries the weight
          on the card; everything else is secondary text beside it. */}
      <div className="pcard__price">
        <div className="pcard__tuition">
          {attr.entryRequirements?.tuitionIsFrom && <span className="pcard__from">from </span>}
          {formatFee(attr.tuition, currency)}
        </div>
        <div className="pcard__tuition-note">tuition · first year</div>
      </div>

      <dl className="pcard__facts">
        {duration && (
          <div className="pcard__fact">
            <dt>Duration</dt>
            <dd>{duration}</dd>
          </div>
        )}
        <div className="pcard__fact">
          <dt>Application fee</dt>
          {/* Three states, and null is "not published" — it must not read as a
              free application. */}
          <dd className={applicationFee == null ? 'pcard__unknown' : undefined}>
            {applicationFee ?? 'Not published'}
          </dd>
        </div>
        {attr.commissionAmount != null && (
          <div className="pcard__fact">
            <dt>Commission</dt>
            <dd className="pcard__commission">{formatFee(attr.commissionAmount, currency)}</dd>
          </div>
        )}
      </dl>

      {/* ── When ──────────────────────────────────────────────────────────── */}
      {intakeLabels.length > 0 && (
        <div className="pcard__intakes">
          <div className="pcard__intakes-label">
            {recurring
              ? `Runs every ${monthLabels(attr.intakeMonths).join(', ')}`
              : 'Available intakes'}
          </div>
          <div className="pcard__intake-list">
            {intakeLabels.map((label) => (
              <span key={label} className="pcard__intake">{label}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Act ───────────────────────────────────────────────────────────── */}
      <footer className="pcard__actions">
        <Link className="btn btn-primary pcard__apply" to={`/partner/add-application?courseId=${id}`}>
          Create application
        </Link>
        {/* The whole payload is already here, so this opens with no request. */}
        <button
          type="button"
          className="pcard__detail"
          onClick={() => setShowDetail(true)}
          aria-label={`View details for ${attr.name}`}
          title="View details"
        >
          <Icon name="eye" size={16} />
        </button>
      </footer>

      {showDetail && (
        <CourseDetailModal program={program} onClose={() => setShowDetail(false)} />
      )}
    </article>
  );
}
