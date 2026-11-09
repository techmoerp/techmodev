/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  experimental: {
    serverActions: {
      // Default is 1MB, which silently rejects most real-world logo/photo
      // uploads (including the company logo upload on the Settings page).
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
