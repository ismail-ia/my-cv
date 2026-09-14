/**
 * Whose CV this site is.
 *
 * Every NEXT_PUBLIC_* value is read here as a literal `process.env.X`, never
 * through a computed key: Next inlines these at build time by static text
 * substitution, and an indexed lookup like process.env[name] is left as a
 * runtime read that resolves to undefined in the browser.
 *
 * The defaults keep the site renderable from a bare checkout with no .env, so
 * a missing variable degrades to the right content rather than to "undefined"
 * in a mailto: link.
 */

const name = process.env.NEXT_PUBLIC_PROFILE_NAME || 'Ismail Ibrahim';
const email = process.env.NEXT_PUBLIC_PROFILE_EMAIL || 'ismail.ibrahim.se2026@gmail.com';
const phone = process.env.NEXT_PUBLIC_PROFILE_PHONE || '+201066664587';
const phoneDisplay = process.env.NEXT_PUBLIC_PROFILE_PHONE_DISPLAY || '+20 106 666 4587';
const linkedin = process.env.NEXT_PUBLIC_PROFILE_LINKEDIN || 'https://www.linkedin.com/in/ismail-i-3bb377101';
const cvPath = process.env.NEXT_PUBLIC_PROFILE_CV_PATH || '/assets/docs/Ismail-Ibrahim-CV.pdf';

export const profile = {
  name,
  firstName: name.split(' ')[0],
  title: process.env.NEXT_PUBLIC_PROFILE_TITLE || 'Lead Software Engineer',
  email,
  // tel: needs the E.164 form; the display form is what a human reads.
  phone,
  phoneDisplay,
  linkedin,
  cvPath,
  location: process.env.NEXT_PUBLIC_PROFILE_LOCATION || 'Remote · EET, can shift toward EST',
  availability:
    process.env.NEXT_PUBLIC_PROFILE_AVAILABILITY || 'Open to senior, lead & fractional CTO roles',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://ismailibrahim.myaipal.top',
};

/** `mailto:` with an optional pre-filled subject. */
export function mailto(subject) {
  return subject
    ? `mailto:${profile.email}?subject=${encodeURIComponent(subject)}`
    : `mailto:${profile.email}`;
}

export const tel = `tel:${profile.phone}`;
