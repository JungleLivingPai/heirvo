import { Link } from "react-router-dom";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";

export default function Privacy() {
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
              Privacy <span className="gradient-text">Policy</span>
            </h1>
            <p className="mt-5 text-[18px] leading-relaxed text-ink-500 max-w-[640px]">
              Heirvo is built around a single, non-negotiable promise: your memories
              never leave your computer. This policy explains exactly what that means
              and what little data we do collect.
            </p>
          </div>

          <div className="card-solid p-7 mb-10 border-l-4 border-l-ios-green">
            <div className="flex items-start gap-4">
              <div className="shrink-0 mt-0.5">
                <div className="w-10 h-10 rounded-full bg-ios-green/10 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="#34C759" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <div>
                <div className="font-display font-semibold text-[16px] text-ink-900 mb-1">
                  The short version
                </div>
                <p className="text-[15px] leading-relaxed text-ink-600">
                  Heirvo runs entirely on your computer. No videos, photos, or recovered
                  files are ever uploaded to us or anyone else. The only thing that
                  ever touches our servers is your license key &mdash; and only to
                  confirm it&rsquo;s valid.
                </p>
              </div>
            </div>
          </div>

          <article className="prose-heirvo">
            <Section id="local-first" title="1. Heirvo runs entirely on your computer">
              <p>
                Heirvo is a desktop application for Windows. All disc reading, sector
                analysis, video reconstruction, and AI-based restoration happens
                locally, on the machine you installed it on. We do not have a cloud
                service that processes your media. We never see, copy, transmit, or
                store the discs you recover or the files those recoveries produce.
              </p>
              <p>
                If your computer is offline, Heirvo continues to work for everything
                except license validation and optional model downloads.
              </p>
            </Section>

            <Section id="license-validation" title="2. License validation">
              <p>
                When you activate Heirvo Pro, the app sends your license key (and
                only your license key) to our license server to confirm it is valid
                and tied to your purchase. After activation, Heirvo re-checks the
                license roughly once per week. This lets us honor refunds and revoke
                keys that are reported as fraudulent.
              </p>
              <p>
                Validation requests do not include filenames, disc contents, file
                paths, machine identifiers beyond a coarse install token, or any
                personally identifiable information beyond what Lemon Squeezy
                already associates with your purchase.
              </p>
            </Section>

            <Section id="no-telemetry" title="3. No analytics, no telemetry, no tracking">
              <p>
                The Heirvo desktop app contains no analytics SDK, no crash reporter
                that auto-uploads, no tracking pixels, no usage metrics. The only
                outbound network requests the app makes are:
              </p>
              <ul>
                <li>License validation, as described above.</li>
                <li>
                  Downloads of FFmpeg and AI restoration models &mdash; only when
                  you explicitly choose to enable those features. You see a clear
                  prompt before any download begins.
                </li>
              </ul>
              <p>
                If you never enable AI restoration and never need FFmpeg, Heirvo
                makes no media-related network requests at all.
              </p>
            </Section>

            <Section id="website-analytics" title="4. The heirvo.com website">
              <p>
                The marketing website you are reading right now may use a minimal,
                privacy-respecting analytics tool such as Plausible or Fathom. These
                tools do not set cookies, do not track you across sites, do not
                build advertising profiles, and do not collect personal data. They
                count anonymous page views so we can tell whether anyone is finding
                the site.
              </p>
              <p>
                We do not run Google Analytics, Facebook Pixel, or any third-party
                advertising tracker on heirvo.com.
              </p>
            </Section>

            <Section id="payments" title="5. Payments">
              <p>
                Purchases are processed by{" "}
                <a href="https://www.lemonsqueezy.com/privacy" target="_blank" rel="noreferrer noopener">
                  Lemon Squeezy
                </a>
                , who acts as the merchant of record. They collect what is needed to
                process a sale &mdash; your name, email, billing country, and order
                details. Card information is handled by Stripe inside Lemon Squeezy&rsquo;s
                checkout; we never see, receive, or store your payment card numbers.
              </p>
              <p>
                After your purchase, Lemon Squeezy sends us your name, email, and
                license key so we can email you the key and validate it later. That
                is the full extent of the customer data we receive.
              </p>
            </Section>

            <Section id="email" title="6. Email">
              <p>
                We use <a href="mailto:hello@heirvo.com">hello@heirvo.com</a> for
                support conversations only. If you write to us, we will reply, and
                we keep the thread so we have context if you write again. We never
                add support emails to a marketing list. We never sell, share, or
                rent email addresses.
              </p>
            </Section>

            <Section id="rights" title="7. Your rights">
              <p>
                Because Heirvo collects so little, your rights are simple:
              </p>
              <ul>
                <li>
                  <strong>Access &amp; deletion.</strong> Email{" "}
                  <a href="mailto:hello@heirvo.com">hello@heirvo.com</a> and we will
                  tell you exactly what we have on you (essentially: your purchase
                  record and license key) and delete it on request, subject to legal
                  retention requirements for sales records.
                </li>
                <li>
                  <strong>Refund.</strong> See our{" "}
                  <Link to="/terms#refunds">Terms</Link> for the 30-day refund
                  policy.
                </li>
                <li>
                  <strong>Opt out.</strong> You are not opted into anything. There
                  is nothing to opt out of.
                </li>
              </ul>
            </Section>

            <Section id="changes" title="8. Changes to this policy">
              <p>
                If we ever change how Heirvo handles your data &mdash; particularly
                if anything new starts leaving your computer &mdash; we will update
                this page and note the change at the bottom. Material changes will
                also be communicated to active license holders by email.
              </p>
            </Section>

            <Section id="contact" title="9. Contact">
              <p>
                Questions about privacy, this policy, or anything else: email{" "}
                <a href="mailto:hello@heirvo.com">hello@heirvo.com</a>. A real human
                replies, usually within a day.
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
      <div className="text-[16px] leading-relaxed text-ink-600 space-y-4 [&_a]:text-brand-600 [&_a]:underline [&_a:hover]:text-brand-700 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_strong]:text-ink-900 [&_strong]:font-semibold">
        {children}
      </div>
    </section>
  );
}
