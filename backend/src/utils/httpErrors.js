// Typed errors so services can express intent ("this doesn't exist", "this
// conflicts") without knowing about HTTP, and errorHandler can map them to a
// status without every service inventing `throw { status, message }` objects.
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    if (details) this.details = details;
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad request', details) {
    super(400, message, details);
  }
}

export class UnauthorizedError extends HttpError {
  // Takes `details` like every other error here. It did not, which meant a 401
  // could carry no machine-readable reason — so a sign-in refused for an
  // unconfirmed email was indistinguishable from a wrong password, and the
  // client could only show "invalid email or password" to someone whose
  // password was correct.
  constructor(message = 'Authentication required', details) {
    super(401, message, details);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Insufficient permissions') {
    super(403, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not found') {
    super(404, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict', details) {
    super(409, message, details);
  }
}
