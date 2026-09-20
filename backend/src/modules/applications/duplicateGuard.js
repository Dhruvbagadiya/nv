import { prisma } from '../../utils/prisma.js';
import { ConflictError } from '../../utils/httpErrors.js';

/*
 * Refuses a second application for the same person to the same course.
 *
 * WHY THIS IS NOT ONE RULE. The two creation paths identify "the same person"
 * differently, and using either rule on the other path breaks it:
 *
 *   - A STUDENT owns their applications, so agentId IS the person. Matching on
 *     the account alone is right, and it also catches someone who re-types their
 *     passport number with a typo and tries again.
 *
 *   - An AGENT files for many different people under one agentId, so matching on
 *     the account alone would refuse the second application an agency ever sends
 *     to a popular course. There the person is the passport number.
 *
 * WHY IT IS SCOPED TO THE CALLER EITHER WAY. Checking an agent's submission
 * against every agency's applications would answer "has anyone, anywhere,
 * already filed this passport for this course" — which is a question one agency
 * should not be able to ask about another's clients. The cost is that two
 * agencies can still both file for the same person; that is a real duplicate at
 * the institution, but it is not one this portal can detect without leaking.
 *
 * WHY THERE IS NO "UNLESS IT WAS REJECTED" ESCAPE HATCH. There is no rejected,
 * withdrawn or cancelled stage in the model — ApplicationStage runs
 * PROFILE_ASSESSMENT through VISA_APPROVAL and every one of them is forward
 * progress. Re-applying after a refusal is therefore not something the data can
 * express yet, so pretending to handle it would be inventing a state.
 */
export async function assertNotDuplicate({ agentId, courseId, passportNo, byAccount }) {
  const existing = await prisma.application.findFirst({
    where: {
      agentId,
      courseId,
      // The student path ignores the passport on purpose — see above.
      ...(byAccount ? {} : { passportNo }),
    },
    select: { id: true, reference: true, studentName: true, stage: true },
  });

  if (!existing) return;

  throw new ConflictError(
    byAccount
      ? `You have already applied to this program — application #${existing.reference}. `
        + 'Open it from My Applications to see where it has got to.'
      : `${existing.studentName} already has an application to this program `
        + `(#${existing.reference}). Open it rather than filing a second one.`
  );
}
