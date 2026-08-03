import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

// One flat config for both packages — the backend is Node ESM, the frontend is
// browser ESM + React, and they share the base rules.
export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', 'backend/prisma/migrations/**'] },

  js.configs.recommended,

  // ---- backend: Node ----
  {
    // .mjs included for the scripts/ helpers, which are explicitly ESM.
    files: ['backend/**/*.js', 'backend/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // Express error middleware must keep its 4th arg to be recognised as such,
      // and `next` is legitimately unused in some handlers.
      'no-unused-vars': ['error', { argsIgnorePattern: '^(next|_)', varsIgnorePattern: '^_' }],
      'no-console': 'off', // the server logs to stdout on purpose
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-return-await': 'error',
    },
  },

  // ---- frontend: browser + React ----
  {
    files: ['frontend/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // Vite's JSX transform handles this
      'react/prop-types': 'off', // no prop-types in this codebase by choice
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
    },
  },

  // Must stay last so it can switch off stylistic rules Prettier owns.
  prettier,
];
