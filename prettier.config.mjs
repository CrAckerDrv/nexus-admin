export default {
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  arrowParens: 'always',
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindStylesheet: './apps/admin/src/styles/globals.css',
  tailwindFunctions: ['cn', 'cx', 'cva'],
}
