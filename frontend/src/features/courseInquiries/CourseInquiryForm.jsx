import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useInvalidateResource } from '../../hooks/useInvalidateResource.js';
import { useNavigate } from 'react-router-dom';
import { createInquiry } from '../../api/courseInquiries.js';
import Page from '../../components/ui/Page.jsx';
import ChoiceField from '../../components/ui/ChoiceField.jsx';
import Flag from '../../components/ui/Flag.jsx';
import { useCountries } from '../../hooks/useReferenceData.js';
import { NATIONALITIES, PROGRAM_LEVELS, intakeChoices } from '../../constants/referenceData.js';
import { errorMessage } from '../../utils/format.js';

export default function CourseInquiryForm() {
  const navigate = useNavigate();
  const { countries, isLoading: countriesLoading } = useCountries();
  const [form, setForm] = useState({ nationality: 'Indian', countryId: '', intake: '', courseType: '' });

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  // Current month forward only — a past intake is not something you can apply for.
  const intakes = useMemo(() => intakeChoices(), []);

  const countryOptions = useMemo(
    () =>
      countries.map((c) => ({
        value: c.id,
        label: c.name,
        icon: <Flag emoji={c.flagEmoji} code={c.code} name={c.name} size={16} />,
      })),
    [countries]
  );

  const invalidateInquiries = useInvalidateResource('course-inquiries');

  const mutation = useMutation({
    mutationFn: createInquiry,
    onSuccess: () => {
      // The list this navigates to is cached and stays fresh for 30s
      // (main.jsx), so a user who was just looking at it comes back to the old
      // set with the row they just created missing.
      invalidateInquiries();
      navigate('/partner/history');
    },
  });

  // countryId used to sit in this component's state with no control to set it, so
  // every inquiry was saved with no destination — which is why the history
  // screen's Destination column and its country filter never had anything to show.
  const canSubmit = Boolean(form.nationality && form.countryId && form.intake && form.courseType);

  return (
    <Page
      title="New course inquiry"
      subtitle="Let’s start by setting your preferences"
      actions={
        <>
          <button className="btn btn-outline" onClick={() => navigate('/partner/courses')}>
            Course search
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/partner/add-application')}>
            Add new application
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/partner/history')}>
            Course inquiry history
          </button>
        </>
      }
    >
      <form
        className="form-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) mutation.mutate(form);
        }}
      >
        <h2>Give us your choice of study</h2>
        <div className="sub">Taking the first step toward studying abroad</div>

        <ChoiceField
          label="Student nationality"
          hint="Please select the student’s nationality."
          placeholder="Search nationality"
          value={form.nationality}
          options={NATIONALITIES}
          onChange={set('nationality')}
          allowCustom
        />

        <ChoiceField
          label="Preferred country"
          hint="Please select the country you want to apply to."
          placeholder="Search country"
          value={form.countryId}
          options={countryOptions}
          onChange={set('countryId')}
          loading={countriesLoading}
          emptyMessage="No countries available"
        />

        <ChoiceField
          label="Preferred intake"
          hint="Please select the intake you want to apply for."
          placeholder="Search intake"
          value={form.intake}
          options={intakes}
          onChange={set('intake')}
        />

        <ChoiceField
          label="Type of course"
          hint="Please select the level you want to study."
          placeholder="Search course type"
          value={form.courseType}
          options={PROGRAM_LEVELS.map((l) => ({ value: l.label, label: l.label }))}
          onChange={set('courseType')}
        />

        {mutation.isError && <div className="form-error">{errorMessage(mutation.error)}</div>}

        <div className="submit-row">
          <button className="btn btn-primary" type="submit" disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? 'Submitting…' : 'Submit your inquiry'}
          </button>
        </div>
      </form>
    </Page>
  );
}
