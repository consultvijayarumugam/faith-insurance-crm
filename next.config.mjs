/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // The app is never meant to be embedded in anyone else's page.
          { key: "X-Frame-Options", value: "DENY" },
          // Stop browsers from MIME-sniffing a response into something
          // other than its declared Content-Type.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Don't leak the full referring URL (which can contain lead
          // IDs/paths) to a third-party origin on an outbound link.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Only the attendance punch-clock uses geolocation, and only for
          // the page itself (never embedded) — camera/microphone are never
          // used anywhere in the app.
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
