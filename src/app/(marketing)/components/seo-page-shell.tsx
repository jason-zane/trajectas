import Link from "next/link";
import { Nav } from "./nav";

interface SeoSection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

interface RelatedPage {
  href: string;
  title: string;
  description: string;
}

interface SeoPageShellProps {
  eyebrow: string;
  title: string;
  intro: string;
  sections: SeoSection[];
  relatedPages: RelatedPage[];
}

export function SeoPageShell({
  eyebrow,
  title,
  intro,
  sections,
  relatedPages,
}: SeoPageShellProps) {
  return (
    <>
      <Nav />
      <main className="min-h-screen bg-[var(--mk-bg)]">
        <section
          className="px-6 pb-16 pt-32 md:px-12 md:pb-20 md:pt-36"
          style={{ backgroundColor: "var(--mk-primary-dark)" }}
        >
          <div className="mx-auto max-w-4xl">
            <p className="mk-eyebrow">{eyebrow}</p>
            <h1
              className="mt-5 font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight text-[var(--mk-text-on-dark)] md:text-6xl"
            >
              {title}
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--mk-text-on-dark-muted)] md:text-xl">
              {intro}
            </p>
          </div>
        </section>

        <article className="px-6 py-16 md:px-12 md:py-20">
          <div className="mx-auto max-w-4xl space-y-14">
            {sections.map((section) => (
              <section key={section.title} className="space-y-5">
                <h2
                  className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[var(--mk-text)] md:text-4xl"
                >
                  {section.title}
                </h2>
                {section.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-base leading-8 text-[var(--mk-text-muted)] md:text-lg"
                  >
                    {paragraph}
                  </p>
                ))}
                {section.bullets ? (
                  <ul className="space-y-3 pl-5 text-base leading-8 text-[var(--mk-text-muted)] md:text-lg">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="list-disc">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </article>

        <section className="border-t border-black/8 px-6 py-16 md:px-12">
          <div className="mx-auto max-w-4xl">
            <p className="mk-eyebrow">Related topics</p>
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {relatedPages.map((page) => (
                <Link
                  key={page.href}
                  href={page.href}
                  className="rounded-3xl border border-black/8 bg-white p-6 transition-colors hover:border-[var(--mk-primary)]"
                >
                  <h2 className="text-lg font-bold text-[var(--mk-text)]">
                    {page.title}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--mk-text-muted)]">
                    {page.description}
                  </p>
                </Link>
              ))}
            </div>
            <div className="mt-10">
              <Link
                href="/#contact"
                className="inline-flex rounded-full bg-[var(--mk-primary-dark)] px-6 py-3 text-sm font-bold tracking-wide text-[var(--mk-text-on-dark)]"
              >
                Talk to Trajectas
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
