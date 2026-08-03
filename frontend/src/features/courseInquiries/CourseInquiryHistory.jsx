import { useQuery } from '@tanstack/react-query';
import { fetchInquiries } from '../../api/courseInquiries.js';
import Page from '../../components/ui/Page.jsx';

export default function CourseInquiryHistory() {
  const { data, isLoading } = useQuery({
    queryKey: ['course-inquiries'],
    queryFn: () => fetchInquiries({}),
  });

  return (
    <Page title="Course inquiry history" subtitle="Track all your course inquiries">

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Nationality</th>
              <th>Intake</th>
              <th>Course type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={4}>Loading...</td></tr>}
            {data?.items.length === 0 && <tr><td colSpan={4}>No data available</td></tr>}
            {data?.items.map((inq) => (
              <tr key={inq.id}>
                <td>{inq.nationality}</td>
                <td>{inq.intake || '—'}</td>
                <td>{inq.courseType || '—'}</td>
                <td>{inq.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
