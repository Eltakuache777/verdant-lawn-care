/** @type {import('next').NextConfig} */
const nextConfig = {
  // Needed for instrumentation.ts's register() hook (drives the appointment
  // reminder background job) -- still experimental/off-by-default in this
  // Next.js version, stable by default starting Next 15.
  experimental: {
    instrumentationHook: true,
  },
};
export default nextConfig;
