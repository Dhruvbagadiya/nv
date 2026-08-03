// Props shape matches the Prisma Course model (see backend/prisma/schema.prisma)
// joined with its institution — this is exactly the JSON shape courses.service.js returns.
export default function CourseCard({ course }) {
  const initials = course.institution.name.slice(0, 2).toUpperCase();

  return (
    <div className="card">
      <div className="card-body">
        <div className="card-top">
          <div className="school-row">
            <div className="school-logo">{initials}</div>
            <div className="school-name">{course.institution.name}</div>
          </div>
          <div className="status-stack">
            {course.status.map((s) => (
              <span key={s} className={`status-pill ${s === 'Instant Offer' ? 'offer' : 'submission'}`}>
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="degree-label">{course.degreeLevel}</div>
        <div className="course-title">{course.title}</div>

        <div className="tags">
          {course.tags.map((t) => (
            <span key={t} className="tag-pill green">{t}</span>
          ))}
        </div>

        <div className="info-grid">
          <div className="info-tile">
            <div className="i-label">Location</div>
            <div className="i-value">{course.institution.country.name}</div>
          </div>
          <div className="info-tile">
            <div className="i-label">Campus city</div>
            <div className="i-value">{course.city}</div>
          </div>
          <div className="info-tile">
            <div className="i-label">Tuition (1st yr)</div>
            <div className="i-value mono">${course.tuitionFee} CAD</div>
          </div>
          <div className="info-tile">
            <div className="i-label">Application fee</div>
            <div className="i-value mono">${course.applicationFee} CAD</div>
          </div>
          <div className="info-tile">
            <div className="i-label">Duration</div>
            <div className="i-value">{course.durationText}</div>
          </div>
        </div>

        <div className="intakes">
          <div className="intakes-label">Available intakes</div>
          <div className="intake-list">
            {course.intakes.map((i) => <span key={i}>{i}</span>)}
          </div>
        </div>

        <div className="card-actions">
          <button className="btn btn-primary">Create application</button>
          <button className="heart-btn" aria-label="Save">♡</button>
        </div>
      </div>
    </div>
  );
}
