// O defineConfig abaixo já inclui estes plugins — não adicione de novo, ou o app quebra
// com plugins duplicados: tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro
// (build para Cloudflare), componentTagger (só dev), injeção de VITE_*, alias @,
// dedupe de React/TanStack e loggers de erro. Config extra vai em defineConfig({ vite: { ... } }).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: {
    cloudflare: {
      nodeCompat: true,
      // Tell the Nitro Cloudflare preset to merge the repo's wrangler.toml
      // (name, compatibility flags, [vars], keep_vars, bindings, etc.) into
      // the generated `.output/server/wrangler.json` used at deploy time.
      // Without this the generated wrangler.json only contains name/main/
      // assets and the published Worker ends up with just env.ASSETS as a
      // binding — dashboard-defined vars/secrets get wiped on deploy.
      deployConfig: true,
    },
  },
});
