/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // The legal copy was consolidated into /policies so there is exactly one
    // copy to keep current. These must be real HTTP redirects: calling
    // redirect() inside a statically-prerendered page emits a 307 with NO
    // Location header, which dead-ends old bookmarks and inbound links.
    return [
      { source: "/disclaimer", destination: "/policies#disclaimer", permanent: true },
      { source: "/terms-of-use", destination: "/policies#terms", permanent: true },
      { source: "/privacy-policy", destination: "/policies#privacy", permanent: true },
    ];
  },
};

export default nextConfig;
