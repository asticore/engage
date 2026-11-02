import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
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
    // Generated on every build from the CMS config - never hand-edited, and
    // large enough that linting it is pure noise.
    ignores: ['.next/', 'src/engage-types.ts', 'tests/fixtures/bundle-size/'],
  },
]

export default eslintConfig
