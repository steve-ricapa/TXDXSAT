# Landing visualizations

- **Lucide React 1.57 (ISC)**: already part of TXDXSAT; named icon imports only.
- **Recharts 3.10 (MIT)**: used only for the illustrative learning-cycle line chart. The chart is split into a separate Vite chunk and requested only when its section nears the viewport. It adds ~353 kB minified / ~103 kB gzip locally (Docker build may vary). Data comes from `demoMetrics.ts`, never from production analytics.
- **SVG + CSS + IntersectionObserver**: fixed diagrams and ambient loops need no React Flow (~1.2 MB unpacked, MIT), Motion (~0.8 MB unpacked, MIT), dotLottie (~0.5 MB unpacked, MIT), or extra icon families (Tabler ~17.5 MB unpacked, Phosphor ~33 MB unpacked, both MIT). Package unpacked sizes are not shipped bundle sizes. CSS animation play state and chart intervals stop outside the viewport; reduced-motion mode shows readable static states.
- **HyperFrames CLI 0.8.162 (Apache-2.0)**: the editable 16-second source for the human-factor film is in `motion/human-factor/`. It is intentionally **not embedded yet**: HyperFrames requires Studio preview review and approval before rendering. The React/SVG chain is the live on-page version until an approved, optimized local MP4 and poster can be shipped.

The async training, laboratories, and analytics dashboard are presented as concepts or illustrative demos. Only live-session paths correspond to available product flows. No external URL or credential is used in the phishing example; `.invalid` is reserved for examples.

Documentation reviewed: https://lucide.dev/guide/react/ , https://recharts.github.io/en-US/guide/installation/ , https://reactflow.dev/learn , https://motion.dev/docs/react , https://developers.lottiefiles.com/ , https://tabler.io/icons , https://phosphoricons.com/ .
