import { useState } from 'react';
import Icon from '../../components/ui/Icon.jsx';
import { PROGRAM_LEVELS, programLevelLabel } from '../../constants/referenceData.js';

/**
 * Commission, entry requirements and MOI acceptances, on the Add Institution
 * form.
 *
 * Each of these has its own admin screen, so adding a university meant four
 * visits. The cost was never the typing — it is that the last three are easy to
 * forget, and an institution then sits in the catalogue looking complete with no
 * commission and no entry requirements behind it. Nothing anywhere said they
 * were missing.
 *
 * COLLAPSED BY DEFAULT, and only on create. Open, they would triple the length
 * of a form whose required part is four fields, and the existing screens stay
 * the right place to revise any of this later — this is for the one moment when
 * the admin has the partnership agreement open in front of them.
 *
 * Each section returns null when untouched, so a form nobody expanded produces
 * exactly the request it produced before this existed.
 */

function Section({ title, hint, enabled, onToggle, children }) {
  return (
    <div className="setup-section">
      <button
        type="button"
        className="setup-section__head"
        aria-expanded={enabled}
        onClick={() => onToggle(!enabled)}
      >
        <span className={`setup-section__chevron${enabled ? ' is-open' : ''}`} aria-hidden="true">
          <Icon name="chevron" size={14} />
        </span>
        <span className="setup-section__title">{title}</span>
        <span className="setup-section__state">{enabled ? 'Remove' : 'Add'}</span>
      </button>
      {!enabled && <p className="field-hint setup-section__hint">{hint}</p>}
      {enabled && <div className="setup-section__body">{children}</div>}
    </div>
  );
}

const BLANK_REQUIREMENT = {
  englishRequirement: '',
  academicRequirement: '',
  offerTimeline: '',
  credibilityInterview: false,
  financialInformation: '',
};

const LEVELS = [['UG', 'Undergraduate'], ['PG', 'Postgraduate']];

export function useInstitutionSetup() {
  const [commissionOn, setCommissionOn] = useState(false);
  const [commission, setCommission] = useState({
    tiers: [{ label: '', rate: '' }],
    commissionType: 'percentage',
    rateFrom: '',
    rateTo: '',
    amountFrom: '',
    amountTo: '',
    tuitionBasis: 'net',
    notes: '',
  });

  const [requirementsOn, setRequirementsOn] = useState(false);
  const [requirements, setRequirements] = useState({
    UG: { ...BLANK_REQUIREMENT },
    PG: { ...BLANK_REQUIREMENT },
  });
  // Which levels the admin actually filled in. Both are shown; sending a level
  // with five empty strings would fail min(1) on every field at once.
  const [levels, setLevels] = useState({ UG: true, PG: false });

  const [moiOn, setMoiOn] = useState(false);
  // Keyed on programLevel, not a typed courseType. Free text is how the same
  // award became "Bachelor's Degree", "Bachelors" and "UG" — three course types
  // as far as a groupBy is concerned, so the agent dropdown grew an option per
  // spelling, and none of them could ever be joined to a course.
  const [moi, setMoi] = useState([{ programLevel: '', years: '' }]);

  const num = (v) => (v === '' || v == null ? null : Number(v));

  /**
   * The three blocks, shaped for the API — or undefined where the section was
   * never opened, so the request is byte-identical to the old one.
   */
  const payload = () => {
    const out = {};

    if (commissionOn) {
      const isPercentage = commission.commissionType === 'percentage';
      out.commission = {
        tiers: commission.tiers.filter((t) => t.label.trim() && t.rate.trim()),
        commissionType: commission.commissionType,
        // Only the pair that matches the type. Sending both means a percentage
        // commission carrying an amount range that nothing will ever read, and
        // the card picks its display from commissionType.
        rateFrom: isPercentage ? num(commission.rateFrom) : null,
        rateTo: isPercentage ? num(commission.rateTo) : null,
        amountFrom: isPercentage ? null : num(commission.amountFrom),
        amountTo: isPercentage ? null : num(commission.amountTo),
        tuitionBasis: commission.tuitionBasis,
        notes: commission.notes.trim() || null,
      };
    }

    if (requirementsOn) {
      const rows = LEVELS
        .filter(([level]) => levels[level])
        .map(([level]) => ({ level, ...requirements[level] }));
      if (rows.length) out.entryRequirements = rows;
    }

    if (moiOn) {
      const rows = moi
        .filter((m) => m.programLevel && m.years !== '')
        .map((m) => ({
          programLevel: m.programLevel,
          // The label the agent screens render, derived rather than typed, so
          // the two halves cannot drift.
          courseType: programLevelLabel(m.programLevel),
          years: Number(m.years),
        }));
      if (rows.length) out.moiAcceptances = rows;
    }

    return out;
  };

  /** Named, so the banner says which section and which field, not "invalid". */
  const problem = () => {
    if (commissionOn) {
      if (!commission.tiers.some((t) => t.label.trim() && t.rate.trim())) {
        return 'Commission: give at least one tier a label and a rate, or remove the section.';
      }
      const isPercentage = commission.commissionType === 'percentage';
      const from = num(isPercentage ? commission.rateFrom : commission.amountFrom);
      const to = num(isPercentage ? commission.rateTo : commission.amountTo);
      if (from != null && to != null && from > to) {
        return 'Commission: the "from" figure is higher than the "to" figure.';
      }
      if (isPercentage && [from, to].some((v) => v != null && (v < 0 || v > 100))) {
        return 'Commission: a percentage rate has to be between 0 and 100.';
      }
    }

    if (requirementsOn) {
      if (!levels.UG && !levels.PG) {
        return 'Entry requirements: tick a level, or remove the section.';
      }
      for (const [level, label] of LEVELS) {
        if (!levels[level]) continue;
        const r = requirements[level];
        if (Object.entries(r).some(([k, v]) => k !== 'credibilityInterview' && !String(v).trim())) {
          return `Entry requirements: fill in every ${label} field, or untick that level.`;
        }
      }
    }

    if (moiOn) {
      if (!moi.some((m) => m.programLevel && m.years !== '')) {
        return 'MOI: give at least one row a program level and a number of years, or remove the section.';
      }
      const levels = moi.map((m) => m.programLevel).filter(Boolean);
      if (new Set(levels).size !== levels.length) {
        // The unique key is (institutionId, courseType), so a repeat fails at
        // the database with a message about a constraint the admin cannot see.
        return 'MOI: each program level can only appear once.';
      }
    }

    return null;
  };

  const sections = (
    <>
      <Section
        title="Commission rates"
        hint="Set the agency's payout now, or leave it and use the Commission screen later."
        enabled={commissionOn}
        onToggle={setCommissionOn}
      >
        <div className="admin-form-grid">
          <div className="form-field">
            <label className="flabel" htmlFor="ic-type">Paid as</label>
            <select
              id="ic-type"
              value={commission.commissionType}
              onChange={(e) => setCommission((c) => ({ ...c, commissionType: e.target.value }))}
            >
              <option value="percentage">A percentage of tuition</option>
              <option value="fixed_amount">A fixed amount</option>
            </select>
          </div>
          <div className="form-field">
            <label className="flabel" htmlFor="ic-basis">Calculated on</label>
            <select
              id="ic-basis"
              value={commission.tuitionBasis}
              onChange={(e) => setCommission((c) => ({ ...c, tuitionBasis: e.target.value }))}
            >
              <option value="net">Net tuition</option>
              <option value="gross">Gross tuition</option>
            </select>
          </div>
          {commission.commissionType === 'percentage' ? (
            <>
              <div className="form-field">
                <label className="flabel" htmlFor="ic-rate-from">Rate from (%)</label>
                <input id="ic-rate-from" type="number" min="0" max="100" step="0.1"
                  value={commission.rateFrom}
                  onChange={(e) => setCommission((c) => ({ ...c, rateFrom: e.target.value }))} />
              </div>
              <div className="form-field">
                <label className="flabel" htmlFor="ic-rate-to">Rate to (%)</label>
                <input id="ic-rate-to" type="number" min="0" max="100" step="0.1"
                  value={commission.rateTo}
                  onChange={(e) => setCommission((c) => ({ ...c, rateTo: e.target.value }))} />
              </div>
            </>
          ) : (
            <>
              <div className="form-field">
                <label className="flabel" htmlFor="ic-amt-from">Amount from</label>
                <input id="ic-amt-from" type="number" min="0"
                  value={commission.amountFrom}
                  onChange={(e) => setCommission((c) => ({ ...c, amountFrom: e.target.value }))} />
              </div>
              <div className="form-field">
                <label className="flabel" htmlFor="ic-amt-to">Amount to</label>
                <input id="ic-amt-to" type="number" min="0"
                  value={commission.amountTo}
                  onChange={(e) => setCommission((c) => ({ ...c, amountTo: e.target.value }))} />
              </div>
            </>
          )}
        </div>

        {/* The tiers the Commission screen renders. Kept even though the
            structured fields above drive the program card, because the two are
            read by different screens and only one of them is a range. */}
        <div className="form-field">
          <label className="flabel">Tiers, as an agent reads them</label>
          {commission.tiers.map((tier, i) => (
            <div className="setup-row" key={i}>
              <input
                type="text"
                aria-label={`Tier ${i + 1} label`}
                placeholder="e.g. 1–5 students"
                value={tier.label}
                onChange={(e) => setCommission((c) => ({
                  ...c,
                  tiers: c.tiers.map((t, j) => (j === i ? { ...t, label: e.target.value } : t)),
                }))}
              />
              <input
                type="text"
                aria-label={`Tier ${i + 1} rate`}
                placeholder="e.g. 15%"
                value={tier.rate}
                onChange={(e) => setCommission((c) => ({
                  ...c,
                  tiers: c.tiers.map((t, j) => (j === i ? { ...t, rate: e.target.value } : t)),
                }))}
              />
              <button
                type="button"
                className="btn btn-ghost"
                aria-label={`Remove tier ${i + 1}`}
                disabled={commission.tiers.length === 1}
                onClick={() => setCommission((c) => ({ ...c, tiers: c.tiers.filter((_, j) => j !== i) }))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setCommission((c) => ({ ...c, tiers: [...c.tiers, { label: '', rate: '' }] }))}
          >
            + Add tier
          </button>
        </div>

        <div className="form-field">
          <label className="flabel" htmlFor="ic-notes">Notes</label>
          <textarea id="ic-notes" rows={2} value={commission.notes}
            onChange={(e) => setCommission((c) => ({ ...c, notes: e.target.value }))}
            placeholder="Payment terms, exclusions, anything an agent should know." />
        </div>
      </Section>

      <Section
        title="Entry requirements"
        hint="What a student needs to be accepted here. Agents read this on the UG and PG screens."
        enabled={requirementsOn}
        onToggle={setRequirementsOn}
      >
        {LEVELS.map(([level, label]) => (
          <div key={level} className="setup-level">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={levels[level]}
                onChange={(e) => setLevels((l) => ({ ...l, [level]: e.target.checked }))}
              />
              <span>{label}</span>
            </label>

            {levels[level] && (
              <div className="admin-form-grid">
                {[
                  ['englishRequirement', 'English requirement', 'e.g. IELTS 6.0, no band below 5.5'],
                  ['academicRequirement', 'Academic requirement', 'e.g. 60% in 12th standard'],
                  ['offerTimeline', 'Offer timeline', 'e.g. 48 to 72 hours'],
                  ['financialInformation', 'Financial information', 'e.g. 28 days of maintained funds'],
                ].map(([key, fieldLabel, placeholder]) => (
                  <div className="form-field" key={key} style={{ gridColumn: '1 / -1' }}>
                    <label className="flabel" htmlFor={`ier-${level}-${key}`}>{fieldLabel}</label>
                    <input
                      id={`ier-${level}-${key}`}
                      type="text"
                      value={requirements[level][key]}
                      placeholder={placeholder}
                      onChange={(e) => setRequirements((r) => ({
                        ...r, [level]: { ...r[level], [key]: e.target.value },
                      }))}
                    />
                  </div>
                ))}
                <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={requirements[level].credibilityInterview}
                      onChange={(e) => setRequirements((r) => ({
                        ...r, [level]: { ...r[level], credibilityInterview: e.target.checked },
                      }))}
                    />
                    <span>Credibility interview required</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        ))}
      </Section>

      <Section
        title="MOI accepted"
        hint="Which program levels this school accepts a Medium of Instruction letter for, instead of an English test. Agents can filter courses by it."
        enabled={moiOn}
        onToggle={setMoiOn}
      >
        {moi.map((row, i) => (
          <div className="setup-row" key={i}>
            <select
              aria-label={`MOI program level ${i + 1}`}
              value={row.programLevel}
              onChange={(e) => setMoi((m) => m.map((x, j) => (j === i ? { ...x, programLevel: e.target.value } : x)))}
            >
              <option value="">Select a program level…</option>
              {PROGRAM_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              aria-label={`MOI years ${i + 1}`}
              placeholder="Years"
              value={row.years}
              onChange={(e) => setMoi((m) => m.map((x, j) => (j === i ? { ...x, years: e.target.value } : x)))}
            />
            <button
              type="button"
              className="btn btn-ghost"
              aria-label={`Remove MOI row ${i + 1}`}
              disabled={moi.length === 1}
              onClick={() => setMoi((m) => m.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => setMoi((m) => [...m, { programLevel: '', years: '' }])}
        >
          + Add program level
        </button>
      </Section>
    </>
  );

  return { sections, payload, problem };
}
