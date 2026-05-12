import { Link } from "react-router-dom";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";

const SORA = '"Sora", ui-sans-serif, system-ui, sans-serif';

const C = {
  page: "#FFFFFF",
  text: "#0A0A0A",
  textMuted: "#6B6B6B",
  blue: "#0A84FF",
  blueHover: "#0070E0",
} as const;

export default function NotFound() {
  return (
    <div style={{ background: C.page, color: C.text, fontFamily: SORA, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Nav />
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "96px 24px",
        }}
      >
        <div style={{ maxWidth: 640, textAlign: "center" }}>
          <div
            style={{
              fontFamily: SORA,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: C.blue,
              marginBottom: 20,
            }}
          >
            Error 404
          </div>
          <h1
            style={{
              fontFamily: SORA,
              fontSize: "clamp(56px, 10vw, 112px)",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1.02,
              color: C.text,
              margin: 0,
            }}
          >
            Not found.
          </h1>
          <p
            style={{
              marginTop: 20,
              fontSize: 18,
              lineHeight: 1.55,
              color: C.textMuted,
              maxWidth: 460,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            This page got scratched. The URL you followed doesn't exist, or it's been moved.
          </p>
          <div
            style={{
              marginTop: 36,
              display: "flex",
              gap: 20,
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Link
              to="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: C.text,
                color: "#FFFFFF",
                fontFamily: SORA,
                fontSize: 15,
                fontWeight: 600,
                padding: "14px 26px",
                borderRadius: 999,
                textDecoration: "none",
                letterSpacing: "-0.01em",
                transition: "transform 0.15s ease, background 0.15s ease",
              }}
            >
              Back to home
            </Link>
            <Link
              to="/recover"
              style={{
                color: C.blue,
                fontFamily: SORA,
                fontSize: 15,
                fontWeight: 500,
                textDecoration: "none",
                letterSpacing: "-0.01em",
                borderBottom: `1px solid ${C.blue}`,
                paddingBottom: 2,
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.blueHover)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.blue)}
            >
              Or mail us your disc →
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
