Advanced Filters & Examples

This project (Logson) now includes advanced filtering features in the logs list UI, plus a small example log file to try locally.

Features added

- Regex filter: enter a JavaScript-compatible regular expression (case-insensitive) to match against raw log line, parsed message or formatted date.
- Date range: `From` and `To` date selectors to limit logs by timestamp.
- Saved filters: save the current filter set locally (localStorage) and re-apply or delete saved filters.

How the filters work

- Search term: full-text search across message, formattedDate, statusCode, httpMethod, correlationId.
- Regex: evaluated with `new RegExp(regex, 'i')`. Invalid regex is ignored.
- Date range: `From`/`To` compare against the parsed log `timestamp`.
- Level & Type toggles: keep working as before (multi-select).

Example log file (for testing)
- See `examples/sample.log` (NDJSON / JSON lines). Use the File Upload UI or drag-and-drop to load it.

Notes for developers

- Saved filters are persisted under `localStorage` key `logson:savedFilters`.
- The regex filter currently runs in the main thread; for extremely large datasets consider moving parsing/filtering to a `WebWorker`.