# Prime Team — modified version of Raven

This repository is a fork of [Raven](https://github.com/The-Commit-Company/raven)
by The Commit Company, distributed under the GNU Affero General Public License
v3.0 (see [LICENSE](LICENSE)). The fork keeps the same license; the source
code of every published build must stay publicly available.

Only the mobile app (`apps/mobile`) is changed. It is based on Raven v2.8.11,
the release that matches the server at `app.primegc.kz` (Raven 2.8.x).

## Changes (started 2026-09-30, Prime Green Clinic)

- Name "Prime Team", app ID `kz.primegc.team`, Prime Green Clinic emblem
  as the app icon, splash screen and logo; Raven's wordmark removed.
- Colors of primegc.kz: green `#115F4D` (dark theme `#268068`) as the
  primary color instead of Raven's purple.
- OAuth redirect `kz.primegc.team:`; the site URL defaults to `app.primegc.kz`.
- Russian UI: strings are translated in place (no i18n layer yet);
  `apps/mobile/lib/ru.ts` holds plural forms and channel type labels; dates
  use the dayjs `ru` locale and 24-hour time (also in `packages/lib`);
  iOS permission texts and the development region are Russian.
- Firebase is optional: Raven's Firebase config is removed; push
  notifications work once Prime's own config is put into
  `apps/mobile/firebase/` (see the README there). Without it
  `react-native.config.js` leaves the native Firebase modules unlinked and
  `lib/push.ts` never loads them.
- Raven's Apple team, EAS project and owner removed from the app config.
- Profile screen shows the AGPL notice, a link to Raven and to the source
  code of this fork: https://github.com/beksultanweb/prime-team

"Raven" is a name of The Commit Company; this app is not affiliated with or
endorsed by them.

## Server setup

On the Frappe site, open the OAuth Client used by Raven Mobile
(Raven Settings → Mobile App) and add `kz.primegc.team:` to its Redirect URIs.
Pressing "Configure OAuth Client" in Raven Settings again resets the list, so
the URI has to be added back after that.

## Running locally

```bash
yarn install --ignore-scripts          # repository root
cd apps/mobile
npx expo prebuild --clean
npx expo run:ios                       # or: npx expo run:android
```
