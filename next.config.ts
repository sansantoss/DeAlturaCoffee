import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    // Fotos de ambiente provisionales (Unsplash vía picsum). Cambiar por fotos propias.
    remotePatterns: [{ protocol: "https", hostname: "picsum.photos" }],
  },
  // "Origen" ahora es "Quiénes somos"; los enlaces viejos siguen funcionando.
  async redirects() {
    return [{ source: "/:locale(en|fr|es)/origin", destination: "/:locale/about", permanent: true }];
  },
};

export default withNextIntl(nextConfig);
