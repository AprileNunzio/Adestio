# Contributing to ADESTIO

First off, thank you for considering contributing to ADESTIO! It's people like you that make ADESTIO a great platform.

## How Can I Contribute?

### 1. Creating Apps for the Marketplace
ADESTIO is a Universal Container. The best way to contribute is by creating new Third-Party Apps!
1. Create your app in an isolated folder.
2. Ensure you have a valid `manifest.json`.
3. Use the `ipc` bridge to safely communicate with Core Apps.
4. Open a Pull Request on the [Adestio-Marketplace](https://github.com/AprileNunzio/Adestio-Marketplace) repository to submit your app.

### 2. Contributing to the Core
If you want to improve the ADESTIO Universal Container itself:
1. Fork the repo and create your branch from `master`.
2. If you've added code that should be tested, add tests.
3. Ensure the test suite passes.
4. Make sure your code respects the `try-catch` strict sandboxing rules (never allow third-party apps to crash the core).
5. Issue a pull request!

## Code Style
* Please adhere to the existing code style.
* Remember that ADESTIO Core must remain domain-agnostic. Do not introduce business-specific logic (e.g., HR, billing) into the Core. Create a third-party app instead.

Thank you!
