// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
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
