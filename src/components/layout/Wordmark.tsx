import Link from "next/link";

/* The name of the product. It is not the heading of the page: each page has one h1 of its own.
   It leads to where the viewer's GridIntel starts; a viewer who may open nothing gets the name
   without a link. */
export default function Wordmark({ href }: { href: string | null }) {
  const mark = (
    <>
      {/* The mark: three nodes of a network on the brand colour. */}
      <svg aria-hidden viewBox="0 0 28 28" className="h-7 w-7 shrink-0">
        <rect width="28" height="28" rx="8" fill="var(--color-brand-strong)" />
        <path d="M8 19 L14 9 L20 19 Z" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="14" cy="9" r="2.4" fill="#fff" />
        <circle cx="8" cy="19" r="2.4" fill="#fff" />
        <circle cx="20" cy="19" r="2.4" fill="#fff" />
      </svg>
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-tight text-ink">GridIntel</span>
        <span className="block text-micro text-ink-5">Energy intelligence</span>
      </span>
    </>
  );
  return href === null ? (
    <span className="flex items-center gap-2.5">{mark}</span>
  ) : (
    <Link href={href} className="flex items-center gap-2.5" aria-label="GridIntel, home">
      {mark}
    </Link>
  );
}
