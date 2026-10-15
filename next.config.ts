import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    // Fotos de ambiente provisionales (Unsplash vía picsum). Cambiar por fotos propias.
    remotePatterns: [{ protocol: "https", hostname: "picsum.photos" }],
  },
};

export default withNextIntl(nextConfig);
