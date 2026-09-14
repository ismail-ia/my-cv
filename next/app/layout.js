import Script from "next/script";
import { profile } from "@/lib/profile";
import SiteEffects from "@/components/SiteEffects";

export const metadata = {
  metadataBase: new URL(profile.siteUrl),
  title: "Ismail Ibrahim - I make systems hold",
  description:
    "Lead software engineer, 17 years. I took a monolith to 71.2M requests a month and zero downtime by rebuilding the infrastructure under it, and I build the AI systems that run on top.",
  icons: {
    icon: "/assets/logo/favicon.svg",
  },
  openGraph: {
    title: "Ismail Ibrahim - I make systems hold",
    description:
      "17 years. 71.2M requests a month, $47.5M GMV, zero downtime. Laravel, distributed systems, AI engineering.",
    type: "profile",
    images: [
      {
        url: "/assets/img/og-card.png",
        width: 1200,
        height: 630,
        alt: "I make systems hold. Ismail Ibrahim: 71.2M requests a month, $47.5M GMV, zero downtime, 17 years.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport = {
  themeColor: "#FAF7F2",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: profile.name,
  jobTitle: profile.title,
  description:
    "Lead software engineer, 17 years. Laravel and distributed systems, and the AI systems built on top of them.",
  email: `mailto:${profile.email}`,
  telephone: profile.phone,
  image: "/assets/avatar/ismail-stand-900.png",
  sameAs: [profile.linkedin],
  alumniOf: { "@type": "CollegeOrUniversity", name: "Cairo University" },
  knowsLanguage: ["en", "ar"],
  knowsAbout: [
    "Laravel",
    "PHP",
    "Distributed Systems",
    "AWS",
    "Elasticsearch",
    "AI Engineering",
    "Agentic Architectures",
    "Model Context Protocol",
    "Team Leadership",
  ],
  worksFor: { "@type": "Organization", name: "GrintaHub" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: 'document.documentElement.classList.add("js")',
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <link
          rel="preload"
          href="/assets/fonts/space-grotesk-700-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/assets/fonts/inter-400-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href="/assets/vendor/bootstrap/bootstrap.min.css" />
        <link rel="stylesheet" href="/assets/fonts/fonts.css" />
        <link rel="stylesheet" href="/assets/css/tokens.css" />
        <link rel="stylesheet" href="/assets/css/site.css" />
      </head>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        {children}
        <Script
          src="/assets/vendor/bootstrap/bootstrap.bundle.min.js"
          strategy="afterInteractive"
        />
        <SiteEffects />
      </body>
    </html>
  );
}
