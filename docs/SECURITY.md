# Prototype data boundary

The frontend has no real authentication. Optional OpenAI calls pass through a loopback-only local Node API; the API key stays in an ignored .env file. Role-specific UI and local transition checks organize the scenario; anyone using the browser can inspect all stored data. Use synthetic data only. Opting into screening transmits CV/job text, recordings and answers to OpenAI; it does not publish the application. Browser Origin checks, JSON content type, body limits and concurrency bounds protect the local API from ordinary cross-site calls. Do not expose it to a network.

No API keys, credentials, real CVs or private material belong in frontend source, JSON, localStorage or exports. Exports include private-in-the-UI source/recruiter notes.

Render imported text through React text nodes, validate imports with shared Zod schemas, reject unsupported versions, duplicate IDs, broken references and oversized files. Never overwrite an unreadable save automatically.
