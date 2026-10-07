import type { MetadataRoute } from "next";

/* /robots.txt. The site is public but not launched, so crawlers are asked to stay out of all of
   it. See the note on `metadata` in layout.tsx. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
