import * as coursesService from './courses.service.js';

// No try/catch here: asyncHandler in the routes file forwards rejections to the
// error middleware. Express 4 does not do that on its own, which is why every
// controller in this codebase used to repeat the same catch block.

export async function listCoursesHandler(req, res) {
  // Already validated and coerced by `validate(listCoursesQuery, 'query')`, so
  // page/pageSize are numbers by the time they get here.
  res.json(await coursesService.searchCourses(req.query));
}

export async function createCourseHandler(req, res) {
  res.status(201).json(await coursesService.createCourse(req.body));
}

export async function updateCourseHandler(req, res) {
  res.json(await coursesService.updateCourse(req.params.id, req.body));
}

// Archive rather than delete — see the note in courses.service.js. Kept at
// DELETE /:id because from the client's point of view the course is gone from
// the catalogue; the difference is that applications referencing it survive.
export async function archiveCourseHandler(req, res) {
  await coursesService.archiveCourse(req.params.id);
  res.status(204).send();
}

export async function restoreCourseHandler(req, res) {
  res.json(await coursesService.restoreCourse(req.params.id));
}

// Body shape: { rows: [{ institutionId, title, degreeLevel, city, tuitionFee,
// applicationFee, durationText, tags, badges, intakes }, ...] }
// This is what a parsed CSV upload maps into before hitting this endpoint.
export async function bulkImportHandler(req, res) {
  const result = await coursesService.bulkCreateCourses(req.body.rows);
  res.status(201).json({ imported: result.count });
}
