import * as coursesService from './courses.service.js';
import { canSeeArchived } from '../../middleware/optionalAuth.js';

// No try/catch here: asyncHandler in the routes file forwards rejections to the
// error middleware. Express 4 does not do that on its own, which is why every
// controller in this codebase used to repeat the same catch block.

export async function listCoursesHandler(req, res) {
  // Already validated and coerced by `validate(listCoursesQuery, 'query')`.
  // The service returns { data, meta: { counts, page, pageSize, totalPages } }
  // which matches the target API shape directly.
  //
  // `status` decides whether soft-deleted courses are visible, and this endpoint
  // is public so students can browse without signing in. Anyone could therefore
  // pass status=archived and enumerate rows an admin had deliberately hidden.
  // Non-admins now get the default regardless of what they asked for.
  const query = canSeeArchived(req.user) ? req.query : { ...req.query, status: 'active' };
  res.json(await coursesService.searchCourses(query));
}

export async function getCourseHandler(req, res) {
  // Single program wrapped in { data: <resource> } for consistency.
  const program = await coursesService.getCourse(req.params.id);
  res.json({ data: program });
}

export async function createCourseHandler(req, res) {
  const program = await coursesService.createCourse(req.body);
  res.status(201).json({ data: program });
}

export async function updateCourseHandler(req, res) {
  const program = await coursesService.updateCourse(req.params.id, req.body);
  res.json({ data: program });
}

// Archive rather than delete — see the note in courses.service.js.
export async function archiveCourseHandler(req, res) {
  await coursesService.archiveCourse(req.params.id);
  res.status(204).send();
}

export async function restoreCourseHandler(req, res) {
  const program = await coursesService.restoreCourse(req.params.id);
  res.json({ data: program });
}

// Body shape: { rows: [{ institutionId, title, programLevel, ... }, ...] }
export async function bulkImportHandler(req, res) {
  const result = await coursesService.bulkCreateCourses(req.body.rows);
  res.status(201).json({ imported: result.count });
}
