"use client";

import { useEffect, useState } from "react";

// Rotating hero photography, replacing the single static image.
//
// ACCESSIBILITY NOTES — this is a decorative background on a site whose
// audience has vision loss, so three things are load-bearing:
//
//  1. `prefers-reduced-motion` is honoured by not rotating at all. The first
//     photo is shown and never changes. This is a WCAG requirement, and a
//     slow crossfade behind text is exactly the kind of motion that causes
//     trouble — so the check gates the interval itself, not just the CSS.
//  2. The photos are purely decorative: empty alt + aria-hidden, so a screen
//     reader announces the heading, not eight portraits.
//  3. The gradient over them is what keeps the white heading readable. It is
//     strongest on the left, where the text sits, and clears toward the right
//     so the photograph is actually visible.
//
// Only the first image is fetched during the initial render; the rest mount
// after paint, so the hero's LCP is one image, not eight.

const PHOTOS = [
  "/home/hero/eye-1.webp",
  "/home/hero/eye-2.webp",
  "/home/hero/eye-3.webp",
  "/home/hero/eye-4.webp",
  "/home/hero/eye-5.webp",
  "/home/hero/eye-6.webp",
  "/home/hero/eye-7.webp",
  "/home/hero/eye-8.webp",
];

const INTERVAL_MS = 7000;
const FADE_MS = 1500;

export default function HeroBackdrop() {
  const [index, setIndex] = useState(0);
  // Start with only the first photo in the DOM so it alone competes for the
  // initial paint; the others join once we're past it.
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return; // no rotation, no extra fetches

    setShowAll(true);
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % PHOTOS.length),
      INTERVAL_MS
    );

    // If the visitor turns reduced-motion on while the page is open, stop.
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        window.clearInterval(timer);
        setIndex(0);
      }
    };
    media.addEventListener("change", onChange);

    return () => {
      window.clearInterval(timer);
      media.removeEventListener("change", onChange);
    };
  }, []);

  const visible = showAll ? PHOTOS : PHOTOS.slice(0, 1);

  return (
    <div className="absolute inset-0 -z-10" aria-hidden="true">
      {visible.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          // The first photo is the LCP candidate; the rest can wait.
          fetchPriority={i === 0 ? "high" : "low"}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-opacity motion-reduce:transition-none"
          style={{
            opacity: i === index ? 1 : 0,
            transitionDuration: `${FADE_MS}ms`,
          }}
        />
      ))}
      {/* NO green tint — the photographs show in their own colours.
          What remains is a NEUTRAL darkening confined to the side the copy sits
          on, fading to fully transparent by the midpoint, so the right half of
          every photo is completely untouched. Something has to be here: white
          text directly on the brightest photos in this set measures about
          1.4:1, far under the 4.5:1 floor, and this site's readers are the
          people least able to absorb that. Black rather than forest so it reads
          as a shadow on the photo, not a coloured panel over it. */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" />
      {/* On small screens the copy spans the full width, so the horizontal
          fade alone leaves the lower text over bare photo. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent sm:hidden" />
    </div>
  );
}
