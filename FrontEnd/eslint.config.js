import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Never lint build output or the native shell's copied web bundle.
  globalIgnores(['dist', 'android', 'ios', 'dev-dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: { ...globals.browser, __FCM_CONFIGURED__: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Allow intentionally-unused names prefixed with _ (args, vars, caught errors).
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      // react-hooks v7 added aggressive, opinionated rules that flag working,
      // intentional patterns (deriving state in an effect, ref/immutability
      // heuristics, third-party-hook interop). Keep them visible as warnings
      // rather than failing CI on pre-existing, behaviour-correct code.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/incompatible-library': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
])
