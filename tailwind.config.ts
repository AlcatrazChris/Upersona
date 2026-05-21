import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sf)", "-apple-system", "BlinkMacSystemFont", "SF Pro Display", "system-ui", "sans-serif"],
        mono: ["SF Mono", "ui-monospace", "monospace"],
      },
      colors: {
        // iOS system colors
        ios: {
          blue:    "#007AFF",
          indigo:  "#5856D6",
          purple:  "#AF52DE",
          pink:    "#FF2D55",
          red:     "#FF3B30",
          orange:  "#FF9500",
          yellow:  "#FFCC00",
          green:   "#34C759",
          teal:    "#5AC8FA",
          cyan:    "#32ADE6",
        },
        // Semantic surface colors (for glass morphism)
        surface: {
          primary:   "rgba(255,255,255,0.72)",
          secondary: "rgba(255,255,255,0.56)",
          tertiary:  "rgba(255,255,255,0.40)",
          elevated:  "rgba(255,255,255,0.85)",
          overlay:   "rgba(255,255,255,0.18)",
        },
        // Dark glass surfaces
        glass: {
          sm:  "rgba(255,255,255,0.08)",
          md:  "rgba(255,255,255,0.12)",
          lg:  "rgba(255,255,255,0.18)",
          xl:  "rgba(255,255,255,0.24)",
        },
        // Text hierarchy
        label: {
          primary:   "rgba(0,0,0,0.85)",
          secondary: "rgba(0,0,0,0.55)",
          tertiary:  "rgba(0,0,0,0.35)",
          quaternary:"rgba(0,0,0,0.18)",
        },
        fill: {
          primary:   "rgba(120,120,128,0.20)",
          secondary: "rgba(120,120,128,0.16)",
          tertiary:  "rgba(118,118,128,0.12)",
          quaternary:"rgba(116,116,128,0.08)",
        },
        separator: "rgba(60,60,67,0.29)",
      },
      backdropBlur: {
        xs:   "4px",
        sm:   "8px",
        md:   "16px",
        lg:   "24px",
        xl:   "40px",
        "2xl":"60px",
        "3xl":"80px",
      },
      borderRadius: {
        "ios":    "12px",
        "ios-lg": "16px",
        "ios-xl": "22px",
        "ios-2xl":"28px",
      },
      boxShadow: {
        // iOS card shadows
        "ios-sm": "0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)",
        "ios":    "0 4px 16px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)",
        "ios-lg": "0 8px 32px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)",
        "ios-xl": "0 16px 48px rgba(0,0,0,0.14), 0 6px 20px rgba(0,0,0,0.08)",
        // Inner highlight for glass effect
        "glass":  "inset 0 1px 0 rgba(255,255,255,0.60), 0 4px 16px rgba(0,0,0,0.10)",
        "glass-lg":"inset 0 1px 0 rgba(255,255,255,0.70), 0 8px 32px rgba(0,0,0,0.12)",
      },
      animation: {
        "fade-in":     "fadeIn 0.3s ease-out",
        "slide-up":    "slideUp 0.4s cubic-bezier(0.16,1,0.3,1)",
        "slide-down":  "slideDown 0.4s cubic-bezier(0.16,1,0.3,1)",
        "scale-in":    "scaleIn 0.25s cubic-bezier(0.16,1,0.3,1)",
        "blur-in":     "blurIn 0.5s ease-out",
        "shimmer":     "shimmer 2s infinite linear",
        "pulse-soft":  "pulseSoft 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:    { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp:   { from: { opacity: "0", transform: "translateY(16px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        slideDown: { from: { opacity: "0", transform: "translateY(-16px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        scaleIn:   { from: { opacity: "0", transform: "scale(0.95)" }, to: { opacity: "1", transform: "scale(1)" } },
        blurIn:    { from: { opacity: "0", filter: "blur(8px)" }, to: { opacity: "1", filter: "blur(0)" } },
        shimmer:   { from: { backgroundPosition: "200% center" }, to: { backgroundPosition: "-200% center" } },
        pulseSoft: {
          "0%,100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
      },
      backgroundImage: {
        // iOS-style mesh gradients
        "ios-mesh": "radial-gradient(ellipse 80% 60% at 20% 10%, rgba(0,122,255,0.15) 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 80% 90%, rgba(88,86,214,0.12) 0%, transparent 60%), radial-gradient(ellipse 100% 100% at 50% 50%, rgba(52,199,89,0.06) 0%, transparent 70%)",
        "ios-mesh-2": "radial-gradient(ellipse 70% 50% at 80% 20%, rgba(255,149,0,0.12) 0%, transparent 60%), radial-gradient(ellipse 80% 70% at 10% 80%, rgba(175,82,222,0.10) 0%, transparent 60%), radial-gradient(ellipse 60% 60% at 50% 50%, rgba(0,122,255,0.06) 0%, transparent 70%)",
        "shimmer-gradient": "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
