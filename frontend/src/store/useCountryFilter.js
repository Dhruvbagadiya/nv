import { create } from 'zustand';

// Global because both the header's CountryStrip and the CourseFinder
// feature need to read/write the same selected country.
export const useCountryFilter = create((set) => ({
  selectedCountry: 'ALL',
  setSelectedCountry: (code) => set({ selectedCountry: code }),
}));
