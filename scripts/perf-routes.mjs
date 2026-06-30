import { chromium } from "playwright";

const baseUrl = process.env.PERF_BASE_URL || "http://127.0.0.1:3000";
const routes = (process.env.PERF_ROUTES || "/,/employee,/admin,/reports")
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function measureRoute(context, route) {
  const page = await context.newPage();
  const consoleErrors = [];
  const ignoredConsoleErrorPatterns = [
    /_next\/webpack-hmr/,
    /Error during WebSocket handshake/
  ];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (ignoredConsoleErrorPatterns.some((pattern) => pattern.test(text))) return;
    consoleErrors.push(text);
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  const url = new URL(route, baseUrl).toString();
  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource");
    const byType = resources.reduce((groups, resource) => {
      const type = resource.initiatorType || "other";
      groups[type] ||= { count: 0, transferSize: 0, encodedBodySize: 0 };
      groups[type].count += 1;
      groups[type].transferSize += resource.transferSize || 0;
      groups[type].encodedBodySize += resource.encodedBodySize || 0;
      return groups;
    }, {});
    const paint = performance.getEntriesByType("paint").reduce((values, entry) => {
      values[entry.name] = Math.round(entry.startTime);
      return values;
    }, {});

    return {
      ttfb: Math.round(navigation.responseStart),
      domContentLoaded: Math.round(navigation.domContentLoadedEventEnd),
      load: Math.round(navigation.loadEventEnd),
      transferSize: navigation.transferSize || 0,
      encodedBodySize: navigation.encodedBodySize || 0,
      resourceCount: resources.length,
      byType,
      paint
    };
  });

  await page.close();
  return { route, metrics, consoleErrors };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 }
});

try {
  const results = [];
  for (const route of routes) {
    results.push(await measureRoute(context, route));
  }

  for (const result of results) {
    const { route, metrics, consoleErrors } = result;
    console.log(`\n${route}`);
    console.log(`  TTFB: ${metrics.ttfb}ms`);
    console.log(`  DOMContentLoaded: ${metrics.domContentLoaded}ms`);
    console.log(`  Load: ${metrics.load}ms`);
    console.log(`  Document transfer: ${formatBytes(metrics.transferSize)} (${formatBytes(metrics.encodedBodySize)} encoded body)`);
    console.log(`  Resources: ${metrics.resourceCount}`);
    console.log(`  First paint: ${metrics.paint["first-paint"] ?? "n/a"}ms`);
    console.log(`  First contentful paint: ${metrics.paint["first-contentful-paint"] ?? "n/a"}ms`);

    for (const [type, data] of Object.entries(metrics.byType).sort(([left], [right]) => left.localeCompare(right))) {
      console.log(`  ${type}: ${data.count} resources, ${formatBytes(data.transferSize)} transfer`);
    }

    if (consoleErrors.length) {
      console.log("  Console errors:");
      consoleErrors.forEach((error) => console.log(`    - ${error}`));
    }
  }

  const failedRoutes = results.filter((result) => result.consoleErrors.length);
  if (failedRoutes.length) process.exitCode = 1;
} finally {
  await browser.close();
}
