import Modal from '../../components/ui/Modal.jsx';
import { formatFee } from '../../utils/format.js';

/*
 * The detail behind a course card's eye icon.
 *
 * Everything shown here is already in the list payload, so opening is instant
 * and needs no request — the same approach Important Updates takes.
 *
 * Only instantapply publishes entry requirements; ApplyBoard courses carry
 * none. Rather than render an empty shell for those, each section is omitted
 * when it has nothing in it, and a course with no requirements at all says so
 * plainly instead of implying the requirements are "none".
 */

// A band pair is { overall, notLessThan }. Either half can be absent, and the
// scraper keeps "No"/"NA" verbatim because that means the test is not accepted
// — which is worth showing, and is not the same as having no data.
function bandText(pair) {
  if (!pair) return null;
  const overall = pair.overall ?? null;
  const min = pair.notLessThan ?? null;
  if (!overall && !min) return null;
  if (overall && min) return `${overall} (no band below ${min})`;
  return overall ?? `no band below ${min}`;
}

const TESTS = [
  ['IELTS', 'ielts'],
  ['PTE', 'pte'],
  ['TOEFL', 'toefl'],
  ['Duolingo', 'duolingo'],
];

function Row({ label, children }) {
  return (
    <div className="cd-row">
      <div className="cd-label">{label}</div>
      <div className="cd-value">{children}</div>
    </div>
  );
}

export default function CourseDetailModal({ program, onClose }) {
  const attr = program.attributes;
  const school = attr.school;
  const req = attr.entryRequirements ?? null;
  const currency = attr.currency ?? 'USD';

  const bands = TESTS.map(([label, key]) => [label, bandText(req?.[key])]).filter(
    ([, text]) => text
  );

  const duration =
    attr.minLength || attr.maxLength
      ? attr.minLength === attr.maxLength
        ? `${attr.minLength} months`
        : `${attr.minLength} – ${attr.maxLength} months`
      : null;

  const intakes = (attr.programIntakes ?? []).map((i) => {
    const d = new Date(i.startDate);
    return Number.isNaN(d.getTime())
      ? i.startDate
      : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  });

  // Badges carry the intake months for feeds that publish a month without a
  // year, which is why they are shown here when there are no dated intakes.
  const intakeText = intakes.length
    ? intakes.join(' · ')
    : (attr.badges ?? []).filter((b) => /intake/i.test(b)).join(' · ') || null;

  // Home Edition variants are separate acceptances, not alternative bands, so
  // they are listed as their own rows rather than folded into the test above.
  const extras = [
    ['Academic score', req?.academicScore],
    ['Home Edition TOEFL', req?.homeEditionToefl],
    ['Home Edition PTE', req?.homeEditionPte],
    ['Accepted tests', (req?.acceptedEnglishTests ?? []).join(', ') || null],
    ['MOI accepted', req?.moi],
    ['Qualification age', req?.passoutYearAccepted],
    ['12th English marks', req?.twelfthEnglishMarks],
    ['12th education board', req?.twelfthEducationBoard],
    ['12th maths', req?.twelfthMaths],
  ].filter(([, v]) => v);

  const hasRequirements = bands.length > 0 || req?.summary || extras.length > 0;

  return (
    <Modal
      title={attr.name}
      subtitle={[school.name, school.city, school.countryCode].filter(Boolean).join(' · ')}
      onClose={onClose}
      wide
      footer={
        attr.externalUrl && (
          <a
            className="btn btn-primary"
            href={attr.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on the university site
          </a>
        )
      }
    >
      <div className="course-detail">
        <section className="cd-section">
          <h4 className="cd-heading">Course</h4>
          <Row label="Tuition">{formatFee(attr.tuition, currency)}</Row>
          {/* Three distinct states, and collapsing any two of them misleads: a
              fee, no fee, and no published figure. null is the last of these --
              15,864 instantapply courses -- and rendering it as "None" would
              tell an agent a fee-charging course is free to apply to. */}
          <Row label="Application fee">
            {attr.applicationFee == null ? (
              <span className="cd-unknown">Unknown</span>
            ) : attr.applicationFee > 0 ? (
              formatFee(attr.applicationFee, currency)
            ) : (
              'None'
            )}
          </Row>
          {duration && <Row label="Duration">{duration}</Row>}
          {intakeText && <Row label="Intake">{intakeText}</Row>}
          {attr.commissionAmount != null && (
            <Row label="Commission">{formatFee(attr.commissionAmount, currency)}</Row>
          )}
          {req?.scholarship && <Row label="Scholarship">{req.scholarship}</Row>}
          {req?.programTypeNotes && <Row label="Notes">{req.programTypeNotes}</Row>}
        </section>

        <section className="cd-section">
          <h4 className="cd-heading">Entry requirements</h4>
          {hasRequirements ? (
            <>
              {req.summary && <Row label="Academic">{req.summary}</Row>}
              {bands.map(([label, text]) => (
                <Row key={label} label={label}>
                  {text}
                </Row>
              ))}
              {extras.map(([label, value]) => (
                <Row key={label} label={label}>
                  {value}
                </Row>
              ))}
            </>
          ) : (
            <p className="cd-empty">
              This provider does not publish entry requirements for this course.
            </p>
          )}
        </section>
      </div>
    </Modal>
  );
}
