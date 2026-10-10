# Psychiatry Residency Study Planner

An open-source WordPress dashboard for psychiatry residents to organize study plans and build a personal learning workspace.

**Current release:** `1.4.4`  
**WordPress shortcode:** `[psychiatry_study_planner]`

## Features

- 24-week study planner with editable weekly tasks and study sessions.
- Editable current Rotation details, including focus, dates, and notes.
- Psychiatry Knowledge Map and editable disorder profiles.
- Medication knowledge records and differential-diagnosis learning notes.
- De-identified clinical case learning records.
- Personal Psychiatry Pearls, article/evidence tracking, and flashcards.
- Simple flashcard review intervals (Hard: 1 day, Medium: 3 days, Easy: 7 days).
- Search across saved knowledge entries.
- External medical-reference search launcher for Google, Google Scholar, Medscape, RapidRx, and the Pillix Iranian medication database. Google, Google Scholar, and the configured Medscape route accept direct query URLs in the current implementation; RapidRx and Pillix open their site and attempt to copy the query for pasting.
- Compact mobile navigation.
- Workspace data stored in WordPress user meta and associated with the currently logged-in WordPress account.

## Requirements

- WordPress 6.0 or newer
- PHP 7.4 or newer
- A WordPress account for each person who will use the planner

## Installation (WordPress)

1. Download the plugin installation ZIP from the project's **Releases** page, or create a ZIP containing the `psychiatry-study-planner` plugin folder and its contents.
2. In WordPress Admin, open **Plugins → Add New Plugin → Upload Plugin**.
3. Upload the ZIP and activate the plugin.
4. Add `[psychiatry_study_planner]` to a WordPress page.
5. Log in with the same WordPress account on each device to access the same workspace.

For development, clone or download this repository and copy the plugin folder into `wp-content/plugins/psychiatry-study-planner/`.

## Data separation and storage

Each workspace is stored in WordPress user meta under the currently authenticated user's account. On a correctly configured WordPress site, users with separate accounts should see separate workspaces. A user accessing the same site from multiple devices sees the workspace for that same account.

This is not a hosted service: installing the plugin on a different WordPress site creates a separate installation with that site's own database. Publicly sharing this source code does **not** publish the private workspace data stored on your site.

Administrators should still review site access, backups, user roles, hosting security, and plugin behavior before deploying it for multiple users. This project has not undergone an independent security audit.

## Clinical privacy and safety

- **Never enter patient-identifying information or protected health information.** Use only appropriately de-identified educational notes and cases.
- Do not treat this planner, its differential-diagnosis tools, or its medication records as a substitute for clinical judgment, current authoritative references, local policy, or supervision.
- External search providers receive the search terms you submit to them. Do not include patient names, identifiers, or other confidential details in external searches.
- The plugin does not claim that all external medical sites support direct query URLs. Site behavior can change without notice.

## Contributing

Bug reports, documentation improvements, translations, and pull requests are welcome. Please:

1. Describe the problem or proposed change clearly.
2. Avoid including private patient information, credentials, or live-site secrets in issues.
3. Test changes on a non-production WordPress installation first.
4. Keep changes focused and preserve per-user workspace isolation.

See [CONTRIBUTING.md](CONTRIBUTING.md) for more details.

## Security reports

Please do not publish exploitable security details in a public issue. See [SECURITY.md](SECURITY.md) for responsible disclosure guidance.

## License

This project is distributed under the GNU General Public License, version 2 or (at your option) any later version. See [LICENSE](LICENSE).

## Project status

This project is provided as-is for learning and personal organization. It has not been tested across every WordPress theme, plugin combination, hosting configuration, or browser. Back up your WordPress database before upgrading and test updates on a staging site when possible.
