// ESLint 10 flat config: typescript-eslint, react-hooks, jsx-a11y. Never @eslint/js.
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';
import { I18N_RULES } from './eslint.i18n.config.js';

export default tseslint.config(
  { ignores: ['dist', 'src-tauri', 'node_modules', 'supabase'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.browser }, ecmaVersion: 2023 },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'no-console': 'error',
      'jsx-a11y/no-autofocus': ['error', { ignoreNonDOM: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  { files: ['src/lib/logger.ts'], rules: { 'no-console': 'off' } },
  { files: ['src/**/*.tsx'], rules: I18N_RULES },
  { files: ['vite.config.ts', 'eslint*.js'], languageOptions: { globals: { ...globals.node } } },
);
