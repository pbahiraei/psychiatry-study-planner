# Contributing

Thanks for considering a contribution.

## Ways to help

- Report reproducible bugs.
- Improve documentation or translations.
- Suggest accessibility and mobile usability improvements.
- Submit focused pull requests.

## Before opening an issue or pull request

- Never include patient-identifying or protected health information.
- Never commit passwords, API keys, authentication cookies, database exports, or production configuration.
- Describe the WordPress and PHP versions involved when reporting a bug.
- Test changes on a staging or local WordPress site when possible.
- Keep pull requests focused and explain how you tested the change.

## Development notes

- The main plugin entry point is `psychiatry-study-planner.php`.
- Front-end behavior is in `assets/app.js` and styling is in `assets/app.css`.
- Workspace persistence uses the authenticated WordPress user's user meta and the plugin's REST endpoint. Changes must preserve user-level data separation and WordPress authorization checks.
- Keep the plugin installable as a standard WordPress plugin folder.
