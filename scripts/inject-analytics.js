const fs = require('fs');
const path = require('path');

const root = process.argv[2];
if (!root) throw new Error('Usage: node scripts/inject-analytics.js <build-directory>');

const measurementId = 'G-5W01WCT2S2';
const snippet = `  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${measurementId}');
  </script>
`;

function inject(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      inject(target);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.html')) continue;

    const html = fs.readFileSync(target, 'utf8');
    if (html.includes(measurementId)) continue;
    if (!html.includes('</head>')) throw new Error(`Missing </head> in ${target}`);
    fs.writeFileSync(target, html.replace('</head>', `${snippet}</head>`));
  }
}

inject(path.resolve(root));
