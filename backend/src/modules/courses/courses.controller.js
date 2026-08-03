import * as coursesService from './courses.service.js';

export async function listCoursesHandler(req, res, next) {
  try {
    const { country, search, tag, page, pageSize } = req.query;
    const result = await coursesService.searchCourses({
      country,
      search,
      tag,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 12,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createCourseHandler(req, res, next) {
  try {
    const course = await coursesService.createCourse(req.body);
    res.status(201).json(course);
  } catch (err) {
    next(err);
  }
}

export async function updateCourseHandler(req, res, next) {
  try {
    const course = await coursesService.updateCourse(req.params.id, req.body);
    res.json(course);
  } catch (err) {
    next(err);
  }
}

export async function deleteCourseHandler(req, res, next) {
  try {
    await coursesService.deleteCourse(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// Body shape: { rows: [{ institutionId, title, degreeLevel, city, tuitionFee, applicationFee, durationText, tags, status, intakes }, ...] }
// This is what a parsed CSV upload maps into before hitting this endpoint.
export async function bulkImportHandler(req, res, next) {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'rows must be a non-empty array' });
    }
    const result = await coursesService.bulkCreateCourses(rows);
    res.status(201).json({ imported: result.count });
  } catch (err) {
    next(err);
  }
}
