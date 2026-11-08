import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'

/**
 * ESLint 扁平配置
 *
 * 规则取舍：以“能捕获真实 bug”为主，不做风格争论（交给 Prettier）。
 * 两条 React Compiler 时代的强规则被降级为 warn，并在代码注释中说明原因：
 *  - react-hooks/refs：`ref.current = latest` 是事件回调免依赖的常用写法
 *  - react-hooks/set-state-in-effect：退出动画需要延迟卸载，属有意为之
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      // 构建产物（dist-demo / dist-lab 供 perf-*.mjs 测生产包，由 vite build 重新生成）
      '**/dist-*/**',
      '**/node_modules/**',
      '**/.vitepress/cache/**',
      '**/.vitepress/dist/**',
      '**/coverage/**',
      'eslint-report.json',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // Node 脚本（含 brand/ 下的品牌素材生成脚本）：允许 console 与 process
    files: [
      'scripts/**/*.{mjs,js,ts}',
      'brand/**/*.{mjs,js,ts}',
      '*.config.mjs',
      '**/vite.config.ts',
      '**/vitest.config.ts',
    ],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-console': 'off',
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
)
