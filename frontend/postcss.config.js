import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let hasTailwindPostcss = false;
let hasTailwindCore = false;

try {
  require.resolve("@tailwindcss/postcss");
  hasTailwindPostcss = true;
} catch {}

try {
  require.resolve("tailwindcss");
  hasTailwindCore = true;
} catch {}

// #region agent log
fetch('http://127.0.0.1:7335/ingest/c024f933-b3ad-492b-8d50-d6ec5d0dcd85',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'57862d'},body:JSON.stringify({sessionId:'57862d',runId:'post-fix-postcss',hypothesisId:'H1',location:'frontend/postcss.config.js:18',message:'PostCSS config loaded',data:{hasTailwindPostcss,hasTailwindCore,pluginConfigured:'@tailwindcss/postcss'},timestamp:Date.now()})}).catch(()=>{});
// #endregion

export default {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
};
