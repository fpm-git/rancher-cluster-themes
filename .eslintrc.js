module.exports = {
  root: true,
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2020, sourceType: 'module' },
  env: { browser: true, node: true, jest: true, es2020: true },
  extends: 'eslint:recommended',
  rules: {
    'no-undef': 'off',
    'no-unused-vars': 'off',
  },
};
