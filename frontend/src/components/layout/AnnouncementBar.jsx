import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchAnnouncements } from '../../api/referenceScreens.js';

// The banners pinned above every screen in the reference portal: a red blacklist
// warning with "Click for list", and a blue declaration-form notice with a
// download. Data-driven rather than hardcoded into the shell, so ops can change
// the wording or take one down without a deploy.
export default function AnnouncementBar() {
  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements'],
    queryFn: fetchAnnouncements,
    staleTime: 10 * 60 * 1000,
  });

  if (announcements.length === 0) return null;

  return (
    <div className="announcement-stack">
      {announcements.map((a) => {
        // Internal routes go through the router so they don't reload the app;
        // anything absolute is a real external link or a file.
        const isInternal = a.ctaUrl?.startsWith('/');
        return (
          <div className={`announcement-bar ${a.variant.toLowerCase()}`} key={a.id} role="status">
            <div className="a-message">{a.message}</div>
            {/* The API rejects a label without a URL, so a rendered button always
                goes somewhere. */}
            {a.ctaLabel &&
              a.ctaUrl &&
              (isInternal ? (
                <Link className="a-cta" to={a.ctaUrl}>
                  {a.ctaLabel}
                </Link>
              ) : (
                <a className="a-cta" href={a.ctaUrl} target="_blank" rel="noopener noreferrer">
                  {a.ctaLabel}
                </a>
              ))}
          </div>
        );
      })}
    </div>
  );
}
