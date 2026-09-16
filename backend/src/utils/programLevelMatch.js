import { ProgramLevel } from '@prisma/client';

/**
 * Best-effort mapping of a human-typed course type onto a ProgramLevel.
 *
 * MoiAcceptance.courseType is free text an admin typed, so the same award
 * arrived as "Bachelor's Degree", "Bachelors", "BACHELOR DEGREE" and "UG". This
 * is what the backfill uses to give those rows a machine-readable level.
 *
 * DELIBERATELY CONSERVATIVE. It returns null rather than guessing, because the
 * cost of a wrong answer here is not a blank cell — it is an MOI record filed
 * against the wrong award, which tells an agent a school accepts an MOI letter
 * for a Master's when it only accepts one for a Bachelor's. A null is visible in
 * the backfill's report and can be fixed by hand; a confident wrong answer is
 * not visible at all.
 *
 * Nothing calls this on the write path. New rows carry the level the admin
 * picked from a list, which is the only way to stop the drift at source.
 */

/** Strip punctuation and collapse whitespace, so "Bachelor's" and "Bachelors" meet. */
const normalise = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Phrases that name a level unambiguously, longest first.
 *
 * Order is load-bearing: "post graduate diploma" has to be tested before
 * "diploma" and before "post graduate", or it matches the wrong one. Every
 * entry here is a phrase someone would actually write on a partnership
 * agreement — this is not a synonym dictionary, it is the list of spellings
 * observed in this product's own data.
 */
const PHRASES = [
  ['post graduate certificate', 'POST_GRADUATE_CERTIFICATE'],
  ['postgraduate certificate', 'POST_GRADUATE_CERTIFICATE'],
  ['pg certificate', 'POST_GRADUATE_CERTIFICATE'],
  ['post graduate diploma', 'POST_GRADUATE_DIPLOMA'],
  ['postgraduate diploma', 'POST_GRADUATE_DIPLOMA'],
  ['pg diploma', 'POST_GRADUATE_DIPLOMA'],
  ['undergraduate certificate', 'UNDERGRADUATE_CERTIFICATE'],
  ['undergraduate diploma', 'UNDERGRADUATE_DIPLOMA'],
  ['advanced diploma', 'ADVANCED_DIPLOMA'],
  ['higher diploma', 'HIGHER_DIPLOMA'],
  ['integrated masters', 'INTEGRATED_MASTERS'],
  ['integrated master', 'INTEGRATED_MASTERS'],
  ['top up degree', 'TOPUP_DEGREE'],
  ['topup degree', 'TOPUP_DEGREE'],
  ['top up', 'TOPUP_DEGREE'],
  ['secondary school', 'SECONDARY_SCHOOL'],
  ['high school', 'SECONDARY_SCHOOL'],
  ['non credential', 'NON_CREDENTIAL'],
  ['3 year bachelor', 'THREE_YEAR_BACHELORS'],
  ['three year bachelor', 'THREE_YEAR_BACHELORS'],
  ['4 year bachelor', 'FOUR_YEAR_BACHELORS'],
  ['four year bachelor', 'FOUR_YEAR_BACHELORS'],
  ['doctoral', 'DOCTORAL_PHD'],
  ['doctorate', 'DOCTORAL_PHD'],
  ['phd', 'DOCTORAL_PHD'],
  ['masters', 'MASTERS_DEGREE'],
  ['master', 'MASTERS_DEGREE'],
  ['bachelors', 'BACHELORS_DEGREE'],
  ['bachelor', 'BACHELORS_DEGREE'],
  ['foundation', 'FOUNDATION'],
  ['diploma', 'DIPLOMA'],
  ['certificate', 'CERTIFICATE'],
  ['english', 'ENGLISH'],
];

/**
 * Bare abbreviations, matched only as the WHOLE value.
 *
 * "ug" inside a longer string is far more likely to be part of a word —
 * "Language", "Rugby Management" — than an abbreviation, and a substring match
 * on two letters is how a level lands on the wrong course.
 */
const EXACT = {
  ug: 'BACHELORS_DEGREE',
  pg: 'MASTERS_DEGREE',
  ba: 'BACHELORS_DEGREE',
  bsc: 'BACHELORS_DEGREE',
  ma: 'MASTERS_DEGREE',
  msc: 'MASTERS_DEGREE',
  mba: 'MASTERS_DEGREE',
  pgd: 'POST_GRADUATE_DIPLOMA',
  pgc: 'POST_GRADUATE_CERTIFICATE',
  hnd: 'HIGHER_DIPLOMA',
};

export function programLevelFor(courseType) {
  const text = normalise(courseType);
  if (!text) return null;

  // The enum's own name, however it was punctuated: "MASTERS_DEGREE",
  // "masters degree", "Masters-Degree".
  for (const level of Object.values(ProgramLevel)) {
    if (normalise(level) === text) return level;
  }

  if (EXACT[text]) return EXACT[text];

  for (const [phrase, level] of PHRASES) {
    if (text.includes(phrase)) return level;
  }

  // Unrecognised. Null, not OTHER: OTHER is a level a course can genuinely be,
  // so filing an unmapped row as OTHER would make it match real OTHER courses.
  return null;
}
