import type { CapacitorConfig } from "@capacitor/cli";

// This app has real server-side rendering, API routes, and a database — it
// can't be statically exported into the app bundle. Instead the native shell
// simply loads the live deployed site, same as visiting it in a browser but
// packaged as an installable app.
const config: CapacitorConfig = {
  appId: "com.verdantlawncare.app",
  appName: "Verdant Lawn Care",
  webDir: "public",
  server: {
    url: "https://verdant-lawn-care.onrender.com",
    cleartext: false,
  },
};

export default config;
