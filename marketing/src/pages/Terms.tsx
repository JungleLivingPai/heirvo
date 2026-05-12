import { Link } from "react-router-dom";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";

export default function Terms() {
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
              Terms of <span className="gradient-text">Service</span>
            </h1>
            <p className="mt-5 text-[18px] leading-relaxed text-ink-500 max-w-[640px]">
              Plain-English terms for buying and using Heirvo. We&rsquo;ve kept it
              short on purpose &mdash; this is a one-time purchase from a small
              team, not a SaaS contract.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 mb-12">
            <Highlight label="License" value="$39 one-time" />
            <Highlight label="Updates" value="Free, lifetime" />
            <Highlight label="Refund" value="30 days, no fuss" />
          </div>

          <article className="prose-heirvo">
            <Section id="agreement" title="1. The agreement">
              <p>
                By installing, activating, or using Heirvo, you agree to these terms.
                If you do not agree, please uninstall the application and request a
                refund within the 30-day window described below.
              </p>
              <p>
                These terms are between you and Heirvo (the developer behind the
                heirvo.com app, referred to as &ldquo;we,&rdquo; &ldquo;us,&rdquo;
                or &ldquo;Heirvo&rdquo;).
              </p>
            </Section>

            <Section id="license" title="2. Your license">
              <p>
                Heirvo Pro is sold as a one-time purchase of <strong>$39 USD</strong>.
                There is no subscription, no recurring charge, and no &ldquo;basic
                vs. premium&rdquo; tiering of features. When you buy a license, you
                get all current features and all future updates &mdash; for the life
                of the product &mdash; at no additional cost.
              </p>
              <p>
                Your license is per-user. That means:
              </p>
              <ul>
                <li>
                  You can install and activate Heirvo on every computer{" "}
                  <em>you personally use</em> &mdash; your desktop, your laptop, a
                  spare machine in the closet. There is no fixed device limit.
                </li>
                <li>
                  You may not share your license key with friends, family members in
                  separate households, coworkers, or the internet at large. If you
                  want others to use Heirvo, they should buy their own license. They
                  are inexpensive on purpose.
                </li>
              </ul>
            </Section>

            <Section id="refunds" title="3. 30-day refund policy">
              <p>
                If Heirvo cannot recover your disc, or simply isn&rsquo;t what you
                hoped it would be, email{" "}
                <a href="mailto:hello@heirvo.com">hello@heirvo.com</a> within 30
                days of purchase and we will refund you in full. You don&rsquo;t
                need to justify it. You don&rsquo;t need to fill out a form. You
                will not get a guilt-trip reply.
              </p>
              <p>
                Refunds are processed through Lemon Squeezy and typically appear on
                your card within 5&ndash;10 business days. Once a refund is issued,
                the associated license key is deactivated.
              </p>
            </Section>

            <Section id="warranty" title='4. "As is" disclaimer'>
              <p>
                Heirvo is provided &ldquo;as is.&rdquo; We&rsquo;ve poured years
                into making it the best DVD and photo CD recovery tool we can build,
                but we cannot guarantee that any specific disc will be recoverable.
                Severely scratched, oxidized, or physically damaged discs are
                sometimes unrecoverable by any tool, including Heirvo. The 30-day
                refund exists precisely because of this uncertainty.
              </p>
              <p>
                To the maximum extent permitted by law, Heirvo disclaims all
                warranties, express or implied, including merchantability and
                fitness for a particular purpose, and is not liable for any
                indirect, incidental, or consequential damages arising from use of
                the application.
              </p>
            </Section>

            <Section id="acceptable-use" title="5. Acceptable use">
              <p>
                Use Heirvo on discs you own or have a clear right to recover (your
                family videos, your photo backups, your wedding disc). Do not use
                Heirvo to circumvent commercial copy protection on retail DVDs or
                Blu-rays you do not own. Heirvo is built for personal archives, not
                for circumventing DRM on commercial media.
              </p>
            </Section>

            <Section id="revocation" title="6. License revocation">
              <p>
                We will only revoke a license in two situations:
              </p>
              <ul>
                <li>
                  <strong>Chargebacks.</strong> If a payment is reversed by your
                  bank or card issuer, the associated license is deactivated.
                </li>
                <li>
                  <strong>Fraud.</strong> If a license is purchased with stolen
                  payment credentials or is being mass-shared in clear violation of
                  the per-user terms above.
                </li>
              </ul>
              <p>
                In every other circumstance, your license is yours forever. We do
                not have a &ldquo;rug-pull&rdquo; clause. We will never revoke a
                license because we changed our pricing model or because you stopped
                using the app for a while.
              </p>
            </Section>

            <Section id="updates" title="7. Updates and continuity">
              <p>
                Heirvo includes free updates for the lifetime of the product. We
                will continue to ship bug fixes, new features, and Windows
                compatibility updates as long as the app is maintained. If we ever
                wind the project down, we will release a final &ldquo;perpetual
                offline&rdquo; build that does not require license validation,
                so the software you paid for keeps working.
              </p>
            </Section>

            <Section id="privacy" title="8. Privacy">
              <p>
                Our{" "}
                <Link to="/privacy">Privacy Policy</Link> describes what data Heirvo
                handles &mdash; in short, almost none. Nothing on your discs ever
                leaves your computer.
              </p>
            </Section>

            <Section id="law" title="9. Governing law">
              <p>
                These terms are governed by the laws of Thailand, where the
                developer is based. If a dispute arises and cannot be resolved by a
                straightforward email exchange, it will be resolved under Thai law.
                Nothing in this clause limits any consumer-protection rights you
                have under the laws of your own country.
              </p>
            </Section>

            <Section id="changes" title="10. Changes to these terms">
              <p>
                We may revise these terms occasionally to reflect new features or
                legal updates. The version that applies to your purchase is the
                version live on this page on the day you bought your license,
                unless a later revision is more favorable to you. Material changes
                will be communicated to active license holders by email.
              </p>
            </Section>

            <Section id="contact" title="11. Contact">
              <p>
                Questions about these terms, your license, or a refund: email{" "}
                <a href="mailto:hello@heirvo.com">hello@heirvo.com</a>. We aim to
                reply within one business day.
              </p>
            </Section>
          </article>

          <div className="mt-16 pt-8 border-t border-ink-200/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-[13px] text-ink-500">
            <span>Last updated: May 2026</span>
            <Link to="/" className="hover:text-ink-900 transition">&larr; Back to home</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 mb-12">
      <h2 className="font-display font-semibold text-ink-900 text-[22px] sm:text-[26px] tracking-tightish mb-4 group">
        <a href={`#${id}`} className="no-underline">
          {title}
          <span className="ml-2 text-ink-300 opacity-0 group-hover:opacity-100 transition">#</span>
        </a>
      </h2>
      <div className="text-[16px] leading-relaxed text-ink-600 space-y-4 [&_a]:text-brand-600 [&_a]:underline [&_a:hover]:text-brand-700 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_strong]:text-ink-900 [&_strong]:font-semibold [&_em]:italic">
        {children}
      </div>
    </section>
  );
}

function Highlight({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-solid p-5">
      <div className="micro-label mb-1.5">{label}</div>
      <div className="font-display font-semibold text-[18px] text-ink-900 tracking-tightish">
        {value}
      </div>
    </div>
  );
}
