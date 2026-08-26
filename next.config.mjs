/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

  experimental: {
    // Resume uploads are server actions carrying a file. The default action
    // body limit is 1MB, which would reject a normal 3MB PDF with a framework
    // error long before the parser could say anything useful about it. 11MB
    // leaves headroom over the 10MB file cap so an oversized file still
    // reaches lib/resume/parse.ts and gets told what the limit is.
    serverActions: {
      bodySizeLimit: "11mb",
    },
  },
 
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig