// Production builds use webpack (`next build --webpack`), which runs Tailwind through PostCSS.
// Dev uses Turbopack, configured in next.config.ts.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
