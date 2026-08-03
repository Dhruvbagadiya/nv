import * as inquiriesService from './courseInquiries.service.js';

export async function createInquiryHandler(req, res, next) {
  try {
    const { nationality, countryId, intake, courseType } = req.body;
    const inquiry = await inquiriesService.createInquiry({
      agentId: req.user.sub,
      nationality,
      countryId,
      intake,
      courseType,
    });
    res.status(201).json(inquiry);
  } catch (err) {
    next(err);
  }
}

export async function listInquiriesHandler(req, res, next) {
  try {
    const { countryId, intake, page } = req.query;
    const scopeToAgent = req.user.role === 'AGENT' ? req.user.sub : undefined;
    const result = await inquiriesService.listInquiries({
      agentId: scopeToAgent,
      countryId,
      intake,
      page: page ? Number(page) : 1,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}
