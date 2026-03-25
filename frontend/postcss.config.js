// CommonJS format — avoids the "module type not specified" Vite warning
// while keeping Electron main/preload.js compatible with require().
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
