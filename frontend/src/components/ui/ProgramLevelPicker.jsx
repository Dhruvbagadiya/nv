import EntityPicker from './EntityPicker.jsx';
import { searchProgramLevels, programLevelLabel } from '../../constants/referenceData.js';

/**
 * The program level field, in one place.
 *
 * Twenty options in a native <select> is a scroll, and the thing a person knows
 * is the word — "diploma", "bachelor", "PG" — not where it sits in the list.
 * Four screens had their own <select> over the same twenty values.
 *
 * The family rides along as the hint, because searching one word is what makes
 * this worth having and "diploma" matches six levels: Advanced, Higher,
 * Undergraduate, Postgraduate, plain Diploma and the certificate beside it.
 * Without a second line those are six near-identical rows.
 */
export default function ProgramLevelPicker({
  id = 'program-level',
  label = 'Program level',
  value,
  onChange,
  ...rest
}) {
  return (
    <EntityPicker
      id={id}
      label={label}
      value={value}
      // A static list, so the label is always resolvable — unlike an
      // institution, where the chosen row is usually not in the current page of
      // results and the picker has to be told what it is called.
      selectedLabel={value ? programLevelLabel(value) : ''}
      onChange={onChange}
      queryKey={['program-levels']}
      fetchOptions={(search) =>
        searchProgramLevels(search).map((l) => ({
          value: l.value,
          label: l.label,
          hint: l.group,
        }))
      }
      placeholder="Search program levels…"
      emptyMessage="No program level matches that."
      {...rest}
    />
  );
}
