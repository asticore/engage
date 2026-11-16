import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Admin panels link to /api/... download and export routes on purpose; next/link is for pages.
      '@next/next/no-html-link-for-pages': 'warn',
      // Pictures go through the site's own image pipeline (EngageImage, srcset, R2 variants); next/image
      // is not used on Workers, and admin previews and stock thumbnails are plain <img> on purpose.
      '@next/next/no-img-element': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    rules: {
      // React Compiler advisory rules from react-hooks 7 (set-state-in-effect, refs, purity, error-boundaries) flag
      // long-standing patterns (data loaded in an effect, account switcher markup); kept visible as warnings.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/error-boundaries': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
  {
    // Generated on every build from the CMS config - never hand-edited, and
    // large enough that linting it is pure noise.
    ignores: ['.next/', 'src/engage-types.ts', 'tests/fixtures/bundle-size/'],
  },
]

export default eslintConfig
