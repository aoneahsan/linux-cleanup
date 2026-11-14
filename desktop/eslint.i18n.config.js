// The hardcoded-string gate (yarn i18n:check). Copy in JSX text, in copy-bearing
// props and in toast()/translate-free calls must come from the i18n catalogue.
import tseslint from 'typescript-eslint';

const COPY_PROPS = '^(label|placeholder|title|description|errorMessage|aria-label|aria-description|alt|data-tour|tag|kbd)$';

/** Restricted-syntax selectors shared with eslint.config.js. */
export const I18N_RULES = {
  'no-restricted-syntax': [
    'error',
    { selector: 'JSXText[value=/[A-Za-z]{3,}/]', message: 'User-visible text must come from the i18n catalogue (t()).' },
    { selector: `JSXAttribute[name.name=/${COPY_PROPS}/] > Literal[value=/[A-Za-z]{3,}/]`, message: 'Copy-bearing props must come from t().' },
    { selector: `JSXAttribute[name.name=/${COPY_PROPS}/] > JSXExpressionContainer > Literal[value=/[A-Za-z]{3,}/]`, message: 'Copy-bearing props must come from t().' },
    { selector: 'CallExpression[callee.name="toast"] > Literal', message: 'Toast copy must come from the i18n catalogue.' },
    { selector: 'CallExpression[callee.name="toast"] > TemplateLiteral', message: 'Toast copy must come from the i18n catalogue.' },
  ],
};

export default tseslint.config(
  { ignores: ['src/i18n/locales/**', 'src/**/*.test.ts'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    // This config runs only the string rules; directives for other rules are not its concern.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: I18N_RULES,
  },
);
