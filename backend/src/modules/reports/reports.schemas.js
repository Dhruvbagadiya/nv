import { z } from 'zod';

export const activityQuery = z.object({
  // Optional: the feed is either everything, or one agency's column of it.
  agentId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
