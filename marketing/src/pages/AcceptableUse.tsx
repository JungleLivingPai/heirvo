import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";

export default function AcceptableUse() {
  return (
    <div className="relative min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1 relative">
        <div className="mesh-bg" />
        <div className="container-narrow relative py-16 sm:py-24 max-w-3xl">
          <div className="mb-12">
            <div className="micro-label mb-4">Legal</div>
            <h1
              className="font-display font-bold tracking-tightest text-ink-900"
              style={{ fontSize: "clamp(36px, 5vw, 56px)", lineHeight: 1.05 }}
            >
              Acceptable <span className="gradient-text">Use Policy</span>
            </h1>
            <p className="mt-5 text-[18px] leading-relaxed text-ink-500 max-w-[640px]">
              Last updated: May 2025
            </p>
          </div>

          <div className="prose prose-ink max-w-none space-y-8 text-[16px] leading-relaxed text-ink-700">
            <section>
              <h2 className="font-display font-semibold text-[22px] text-ink-900 mb-3">
                Permitted Use
              </h2>
              <p>
                Heirvo is designed to help individuals and families recover personal memories from
                optical media — home videos, family photos, personal audio recordings, and personal
                data backups. You may use Heirvo to recover content that you own or for which you
                have explicit permission from the rights holder.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-[22px] text-ink-900 mb-3">
                Prohibited Use
              </h2>
              <p>You may not use Heirvo to:</p>
              <ul className="list-disc list-inside mt-3 space-y-2 text-ink-600">
                <li>
                  Circumvent copy protection or DRM on commercially distributed discs (movies, music
                  albums, software).
                </li>
                <li>
                  Reproduce, distribute, or publicly display copyrighted content without
                  authorization.
                </li>
                <li>
                  Recover or reproduce content that is illegal in your jurisdiction, including but
                  not limited to content that sexually exploits minors.
                </li>
                <li>
                  Engage in commercial duplication or piracy of any kind.
                </li>
                <li>
                  Submit discs containing content that violates any applicable law to our mail-in
                  service.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display font-semibold text-[22px] text-ink-900 mb-3">
                Your Responsibility
              </h2>
              <p>
                You are solely responsible for ensuring that your use of Heirvo complies with
                applicable copyright law and all other applicable laws in your jurisdiction. Heirvo
                provides recovery tools for personal, lawful use only.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-[22px] text-ink-900 mb-3">
                Enforcement
              </h2>
              <p>
                We reserve the right to refuse service, cancel orders, or terminate licenses for
                any user we determine to be in violation of this policy, without refund. Suspected
                illegal activity will be reported to appropriate authorities.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-[22px] text-ink-900 mb-3">
                Contact
              </h2>
              <p>
                Questions or concerns? Email us at{" "}
                <a href="mailto:hello@heirvo.com" className="text-brand-600 hover:underline">
                  hello@heirvo.com
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
