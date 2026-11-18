# Guidelines for AI Agents and Contributors

To ensure code stability, review quality, and clean git history, all changes made to this repository must follow the standard Git workflow:

1. **Create a Feature Branch**: Always create and work on a dedicated feature/fix branch (e.g., `git checkout -b feature/my-change`). Never commit directly to `main` or production branches.
2. **Open a Pull Request (PR)**: Once changes are complete, tested, and verified (`npm run build`, `npm run lint`), open a Pull Request targeting `main`.
3. **Review & Merge**: Review the changes for correctness, type safety, and UI compliance before merging the Pull Request into `main`.
