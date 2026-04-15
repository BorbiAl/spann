import js from '@eslint/js'
import globals from 'globals'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  {
    ignores: [
      'dist/**',
      'dist-electron/**',
      'dist-release/**',
      'node_modules/**',
      'backend/**',
      'mesh-daemon/build/**',
      'mesh-relay/target/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx,ts,tsx}', 'electron/**/*.{ts,tsx,js,cjs,mjs}', 'desktop/**/*.{js,cjs,mjs}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      ...reactHooks.configs.recommended.rules,
    },
  },
]
