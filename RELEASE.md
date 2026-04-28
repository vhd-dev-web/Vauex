# Release Checklist

1. Run `npm ci`.
2. Run `npm run typecheck`.
3. Run `npm run build`.
4. Confirm `manifest.json` has `"id": "vauex"`.
5. Test `main.js`, `manifest.json`, and `styles.css` in `.obsidian/plugins/vauex/`.
6. Tag the release, for example `git tag 2.0.8-vauex.1`.
7. Push the tag so GitHub Actions publishes the three release artifacts.
