import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

// Manually load environment variables from the project's .env.local file.
// This bypasses Next.js incorrectly inferring a parent directory as the workspace root.
const envPath = path.join(__dirname, ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const parts = trimmed.split("=");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join("=").trim();
        process.env[key] = value;
      }
    }
  });
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
