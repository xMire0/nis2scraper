/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  devIndicators: false,
  serverExternalPackages: ["pdf-parse", "fast-xml-parser", "@prisma/client"],
};
