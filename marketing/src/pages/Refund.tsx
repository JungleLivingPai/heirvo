import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";

export default function Refund() {
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
              Refund <span className="gradient-text">Policy</span>
            </h1>
            <p className="mt-5 text-[18px] leading-relaxed text-ink-500 max-w-[640px]">
              Last updated: May 2025
            </p>
          </div>

          <div className="prose prose-ink max-w-none space-y-8 text-[16px] leading-relaxed text-ink-700">
            <section>
              <h2 className="font-display font-semibold text-[22px] text-ink-900 mb-3">
                Mail-in Recovery Service
              </h2>
              <p>
                The <strong>$19.99 intake fee</strong> is non-refundable. It covers the cost of
                processing your shipment, securely logging your disc into our system, and return
                shipping of your original disc regardless of outcome.
              </p>
              <p className="mt-4">
                <strong>Recovery fees are fully waived</strong> for any disc from which we cannot
                extract files. You pay only for successful recoveries. If we recover files from some
                discs in a multi-disc order but not others, you are charged only for the discs where
                recovery succeeded.
              </p>
              <p className="mt-4">
                If you are dissatisfied with the quality of a completed recovery, contact us at{" "}
                <a href="mailto:hello@heirvo.com" className="text-brand-600 hover:underline">
                  hello@heirvo.com
                </a>{" "}
                within 14 days of delivery. We will review your case and, where we determine the
                recovery did not meet a reasonable standard, issue a partial or full refund of the
                recovery fee at our discretion.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-[22px] text-ink-900 mb-3">
                Desktop Software — Heirvo Pro License
              </h2>
              <p>
                Heirvo Pro licenses are eligible for a full refund within <strong>30 days</strong>{" "}
                of purchase if you are not satisfied for any reason. To request a refund, email{" "}
                <a href="mailto:hello@heirvo.com" className="text-brand-600 hover:underline">
                  hello@heirvo.com
                </a>{" "}
                with your order number. Refunds are processed within 5–10 business days.
              </p>
              <p className="mt-4">
                Refund requests submitted after 30 days are reviewed on a case-by-case basis and
                are not guaranteed.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-[22px] text-ink-900 mb-3">
                Contact
              </h2>
              <p>
                Questions about this policy? Email us at{" "}
                <a href="mailto:hello@heirvo.com" className="text-brand-600 hover:underline">
                  hello@heirvo.com
                </a>
                . A real person reads every message.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
