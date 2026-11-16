import ts from "typescript-eslint";
export default ts.config(
  { ignores: ["dist/**", "node_modules/**", "test-results/**", "supabase/dashboard/**"] },
  ...ts.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
);
