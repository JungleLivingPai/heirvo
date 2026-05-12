/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // iOS / SF blue ramp
        brand: {
          50:  "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#5AC8FA",
          500: "#0A84FF",
          600: "#0066CC",
          700: "#0052A3",
          800: "#003D7A",
          900: "#002952",
        },
        // Cool neutrals with blue undertone
        ink: {
          50:  "#F4F6FA",
          100: "#EDF1F7",
          200: "#E1E6EE",
          300: "#C9D1DD",
          400: "#9AA6B8",
          500: "#5C6B82",
          600: "#3E4A60",
          700: "#283447",
          800: "#162033",
          900: "#0A1729",
          950: "#04091A",
        },
        ios: {
          green:  "#34C759",
          orange: "#FF9500",
          red:    "#FF3B30",
          blue:   "#0A84FF",
          cyan:   "#5AC8FA",
        },
      },
      fontFamily: {
        sans:    ['"Sora"', "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ['"Sora"', "ui-sans-serif", "system-ui", "sans-serif"],
        body:    ['"Manrope"', '"Sora"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        tightish: "-0.02em",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
      boxShadow: {
        glass:    "0 1px 2px rgba(10,23,41,0.06), 0 8px 24px rgba(10,23,41,0.08)",
        "glass-lg": "0 1px 2px rgba(10,23,41,0.06), 0 12px 40px rgba(10,23,41,0.10), 0 24px 60px rgba(10,23,41,0.08)",
        "glow-blue":  "0 0 0 1px rgba(10,132,255,0.30), 0 8px 24px rgba(10,132,255,0.25)",
        "ring-blue":  "0 0 0 4px rgba(10,132,255,0.18)",
      },
      backdropBlur: {
        xs:  "4px",
        sm:  "8px",
        DEFAULT: "16px",
        md:  "16px",
        lg:  "24px",
      },
      backgroundImage: {
        "brand-gradient":   "linear-gradient(135deg, #0A84FF 0%, #5AC8FA 100%)",
        "brand-gradient-soft": "linear-gradient(135deg, rgba(10,132,255,0.12) 0%, rgba(90,200,250,0.10) 100%)",
      },
    },
  },
  plugins: [],
};
