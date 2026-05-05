// Runs as a side-effect import — must be the first import in cli.ts
// Guards against Node < 18 before any ESM-only code executes.
const [major] = process.version.replace('v', '').split('.').map(Number);
if (major < 18) {
    process.stderr.write(
        `ai-gov requires Node.js >= 18.0.0. You are running ${process.version}.\n` +
        `Upgrade: https://nodejs.org/en/download\n`
    );
    process.exit(1);
}
