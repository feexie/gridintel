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
  boundary(["src/repositories/demo/**"], [
    OUTSIDE_DOMAIN,
    reaching("mock|analytics|data|types|services|composition|components|app|context|constants|lib",
      "The demo adapter may import only the domain, the ports and the in-memory adapter."),
  ]),
  boundary(["src/composition/**"], [
    OUTSIDE_DOMAIN,
    { regex: "^(\\.\\./)+repositories/mock(/|$)", message: "The application does not run on the legacy mock adapter." },
    reaching("data|types|components|app|context", "The composition root wires repositories and services only."),
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
    { regex: "^(\\.\\./)+repositories/(memory|mock|demo)(/|$)", message: "Services receive repositories; they do not choose an adapter." },
    reaching("data|types|composition|components|app|context", "Services use the ports, not legacy data."),
  ], { ignores: ["src/services/**/*.test.ts"] }),
  // The UI gets its data from the composition root, as view models. It never reaches the
  // domain, analytics, repositories or legacy data, and it calls no service function.
  ...[
    { files: ["src/app/**"], extra: [] },
    {
      files: ["src/components/**"],
      extra: [{ regex: "^@/composition(/|$)", message: "Components receive view models as props; only routes call the composition root." }],
    },
  ].map(({ files, extra }) =>
    boundary(files, [
      { regex: "^@/data/(?!platform(/|$))", message: "The UI does not read data files; it receives view models." },
      { regex: "^@/(domain|analytics|repositories)(/|$)", message: "The UI imports only the composition root and view-model types." },
      { regex: "^@/types/(utility|executive)$", message: "Legacy types are not used by the UI." },
      { regex: "^@/services(/|$)", allowTypeImports: true, message: "The UI imports view-model types from services, never service functions." },
      reaching("data|domain|analytics|repositories|services", "The UI imports only the composition root and view-model types."),
      ...extra,
    ]),
  ),
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
