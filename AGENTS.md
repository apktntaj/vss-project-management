# Development Guidelines

## Data access

- Code in `app/` and `components/` must not import `@/lib/indexeddb` directly.
- Access persisted data only through the public façade `@/lib/data-client`.
- Domain entities must not contain `Blob`, `File`, IndexedDB types, or other storage-specific values. File content is accessed through the attachment API by ID.
- Only storage adapters may access IndexedDB APIs.
- A user action that writes an aggregate and its attached files must use one storage transaction.
- Preserve existing IndexedDB data with forward, idempotent migrations. Do not reset browser data as part of a schema change.
