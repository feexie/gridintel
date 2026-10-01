import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/* Import boundaries between layers. Relative imports are matched by the
   directory they reach; `@/` imports by their path. */
const OUTSIDE_DOMAIN = { regex: "^@/(?!domain(/|$))", message: "Only @/domain may be imported here." };
const boundary = (files, patterns, extra = {}) => ({
  files,
  ...extra,
  rules: { "@typescript-eslint/no-restricted-imports": ["error", { patterns }] },
});
const reaching = (dirs, message) => ({ regex: `^(\\.\\./)+(${dirs})(/|$)`, message });

const importBoundaries = [
  boundary(["src/domain/**"], [
    OUTSIDE_DOMAIN,
    { regex: "^\\.\\./", message: "The domain imports nothing outside src/domain." },
  ]),
  boundary(["src/analytics/**"], [
    OUTSIDE_DOMAIN,
    reaching("data|types|repositories|services|components|app|context|constants|lib",
      "Analytics may import only the domain."),
  ]),
  boundary(["src/repositories/ports/**"], [
    OUTSIDE_DOMAIN,
    reaching("memory|mock|analytics|data|types|services|components|app|context|constants|lib",
      "Ports may import only domain types."),
  ]),
  boundary(["src/repositories/memory/**"], [
    OUTSIDE_DOMAIN,
    reaching("mock|analytics|data|types|services|components|app|context|constants|lib",
      "The in-memory adapter may import only the domain and the ports."),
  ]),
  boundary(["src/repositories/mock/**"], [
    { ...OUTSIDE_DOMAIN, message: "Legacy data and types are read only through ./legacy.ts." },
    reaching("analytics|data|types|services|components|app|context|constants|lib",
      "The mock adapter may not import analytics; legacy data is read only through ./legacy.ts."),
  ]),
  {
    files: ["src/repositories/mock/legacy.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {
        paths: [
          { name: "@/types/utility", allowTypeImports: true, message: "Legacy types are imported as types only." },
          { name: "@/types/executive", allowTypeImports: true, message: "Legacy types are imported as types only." },
        ],
        patterns: [
          { regex: "^@/(?!domain(/|$)|types/(utility|executive)$)", message: "Only the approved legacy type modules." },
          { regex: "^\\.\\./\\.\\./data/(?!utility/(regions|substations|feeders|transformers|meters|edgeDevices|executive)\\.ts$)",
            message: "Only the approved legacy data modules." },
          reaching("analytics|types|services|components|app|context|constants|lib", "Not part of the legacy input."),
        ],
      }],
    },
  },
  boundary(["src/services/**"], [
    OUTSIDE_DOMAIN,
    { regex: "^(\\.\\./)+repositories/(memory|mock)(/|$)", message: "Services receive repositories; they do not choose an adapter." },
    reaching("data|types|components|app|context", "Services use the ports, not legacy data."),
  ], { ignores: ["src/services/**/*.test.ts"] }),
  boundary(["src/data/**"], [
    { regex: "^@/(?!types(/|$))", message: "Mock data may import only legacy types." },
  ]),
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...importBoundaries,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
