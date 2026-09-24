## Context
Event data is shared through Supabase but the dashboard is not live: all current event consumers fetch their own `no-store` projection once on mount. A change by user A therefore leaves user B's already-open pages stale. Implement low-latency cross-user invalidation for the event domain—events, venues, organizers, exhibitors, and cancellations—while retaining NextAuth for browser authorization and server-only Supabase credentials.

`revalidatePath` is not the transport: the current views are client components whose state comes from mount effects, and the event API is explicitly uncached. From a Route Handler, `revalidatePath` only marks a path for the next visit; it does not notify other browsers or rerun their effects.

## Approach
### 1. Publish the event dependency tables through Supabase Realtime
Create an imperative migration using `supabase migration new enable_event_records_realtime`. Its idempotent SQL must add `public.venues`, `public.event_organizers`, `public.events`, `public.exhibitors`, and `public.event_cancellations` to the `supabase_realtime` publication only when each table is absent from `pg_publication_tables`. Do not grant `anon` or `authenticated` table privileges, create Data API policies, or expose database rows to the browser; the existing server-only access boundary remains intact.

Use Postgres Changes only as the server-side source of invalidations. The tables must all be included because `GET /api/event-records?resource=events` composes events with venue, organizer, and cancellation data; exhibitors affect event detail and index projections. No Postgres replication payload is sent to the browser.

### 2. Add an authenticated server-side Realtime-to-SSE relay
Add `lib/supabase/event-records-realtime.ts` as a `server-only` module. It creates a fresh Supabase client per stream request from `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; do not reuse `getSupabaseAdmin()`'s process singleton for long-lived channels. Export a subscription function that takes the resolved workspace ID and an invalidation callback, opens one uniquely named channel, and registers `postgres_changes` listeners for `INSERT`, `UPDATE`, and `DELETE` on the five published tables with `workspace_id=eq.<workspaceId>` filters. The callback receives only `{ resource: 'venues' | 'event-organizers' | 'events' | 'exhibitors' | 'event-cancellations', event: 'INSERT' | 'UPDATE' | 'DELETE' }`; it must discard row payloads.

Add `app/api/event-records/stream/route.ts` with `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, and `maxDuration = 300`. Its `GET` must use the same NextAuth and default-workspace lookup semantics as `app/api/event-records/route.ts`; extract that server-only lookup into a shared helper so a future authorization change cannot make the read API and stream differ. Return `text/event-stream`, `Cache-Control: no-cache, no-transform`, and `Connection: keep-alive`.

After the Supabase channel reaches `SUBSCRIBED`, emit `event: ready` with no domain data. Emit `event: invalidated` with the minimal resource/event JSON for each source notification. Send an SSE comment heartbeat every 20 seconds. On the request abort signal, timer expiry, channel error, or explicit stream cancellation, unsubscribe and remove the channel. A channel error must close the stream so the browser's EventSource reconnect behavior performs a fresh subscription; never leak a service role key, Supabase JWT, database record, or error detail into the event stream.

This server relay is deliberate instead of a browser Supabase client: the project uses NextAuth Credentials, not Supabase Auth; all public/authenticated database access is revoked; and a direct Postgres Changes subscription would require expanding database access. It also avoids a Vercel in-memory relay: every stream instance independently listens to Supabase, the shared external event source.

### 3. Create one dashboard-wide invalidation version
Replace the pass-through `Providers` implementation in `components/providers.tsx` with an `EventRecordsSyncProvider` and exported `useEventRecordsVersion(): number`. The provider is already mounted once above `AppShell` by `app/(dashboard)/layout.tsx`, after the dashboard layout has authenticated the user.

Open exactly one `EventSource('/api/event-records/stream')` while the provider is mounted. Treat both `ready` and `invalidated` as a resync signal: coalesce signals received in a 100 ms window, then increment the version once. Coalescing prevents the venue → organizer → event sequence in `EventForm.submit()` from causing three full reloads. Close the EventSource and clear the timer on unmount. Do not show a toast for normal transport reconnects; EventSource retries automatically after the server's 300-second Vercel function duration and the next `ready` forces an authoritative refetch.

The context carries no data. Every consumer continues to fetch through `@/lib/data-client` and the existing cookie-authenticated Next.js APIs.

### 4. Attach existing owner loaders to the common version
Change each reader to re-run its existing complete loader when `useEventRecordsVersion()` changes; preserve local mutation callbacks for immediate feedback and let their echoed invalidation coalesce harmlessly.

- `app/(dashboard)/events/page.tsx`: make the existing `reloadEvents()` callback stable and reload its event, exhibitor, and CIPL/version projection when the version changes.
- `app/(dashboard)/events/[id]/page.tsx`: extract the current mount-only event/exhibitor/job/CIPL-count sequence into `reloadEventDetail()` and invoke it for `[params.id, version]`.
- `components/event-form.tsx`: refetch selectable venues and organizers on the version so an open form sees remote venue/organizer administration.
- `app/(dashboard)/page.tsx`, `app/(dashboard)/jobs/page.tsx`, and `components/ticket-board.tsx`: rerun their existing owner loaders that call `listEvents()` so overview metrics, job grouping, and ticket event labels converge without navigation.
- `app/(dashboard)/cipls/[id]/page.tsx`: rerun its existing exhibitor-resolution loader because it derives the visible exhibitor from events plus exhibitors.
- `app/(dashboard)/settings/settings-manager.tsx`: refresh `getSettingsData()` on the version for remote venue/organizer inserts and edits; retain the open editor and do not overwrite unsaved form fields.

Do not subscribe pure render components such as `components/event-timeline.tsx`, and do not add a second subscription to `components/event-exhibitor-modal.tsx`; their owning loaders already supply the refreshed state.

### 5. Preserve and prove the deployment contract
Do not add `NEXT_PUBLIC_SUPABASE_*` variables, a browser Supabase client, `revalidatePath`, polling, Redis, or Vercel WebSocket state. Vercel supports streaming functions, but a function connection is duration-bounded (300 seconds on Hobby by default); the SSE route explicitly uses that bound, heartbeat, cleanup, and EventSource reconnection rather than assuming a permanent process. Supabase is the cross-instance broker, so no module-level connection registry is permitted.

Run `supabase db advisors` after applying the migration and correct any new advisor finding before release. Confirm the project Realtime service is enabled in the Supabase Dashboard; this approach needs the `supabase_realtime` publication but no public Data API exposure or Realtime `realtime.messages` policy because clients never join Supabase directly.

## Critical files & anchors
- `app/api/event-records/route.ts` — `context()`, `GET`, `POST`, and `DELETE`; extract the shared workspace/auth resolution without changing event mutation behavior.
- `lib/supabase/admin.ts` — current server-only credential contract; the relay must preserve it while using a per-stream client.
- `components/providers.tsx` — empty client provider and the single safe attachment point for one dashboard EventSource/context.
- `app/(dashboard)/events/page.tsx` — `reloadEvents()` is the complete event-index projection loader to reuse, not duplicate.
- `supabase/migrations/20260917120000_event_page_domain.sql` — documents the typed event dependency tables and workspace foreign-key relationships the new publication migration must cover.

## Verification
1. From the repository root with Supabase linked and the local/target database available, create the migration through the Supabase CLI, apply it in the intended environment, run `supabase db advisors`, and confirm `supabase_realtime` lists all five event dependency tables. Confirm browser roles still have no grants on these tables.
2. Run `npm run domain:test`, `npx tsc --noEmit`, and `npm run build`.
3. Add deterministic coverage for the relay's resource table set and its no-row-payload serializer. Test an authenticated stream with a mocked subscription callback: it sends `ready`, sends an `invalidated` event containing only resource/event, emits a heartbeat, and invokes channel cleanup on abort. Test unauthenticated `GET /api/event-records/stream` returns the same 401 behavior as the existing data route.
4. In a staging workspace with two active application accounts, open `/events` in two separately authenticated browser contexts. Keep user B's page open. User A creates a uniquely named temporary venue, organizer, and event; user B must see the new event without navigation or manual reload after one coalesced refresh. User A cancels that staging-only event; user B must see its cancelled status update without reload. Reset the staging workspace after the check.
5. Repeat with user B holding the event-creation form and the Settings page open: user A changes a venue name through Settings; user B's venue selector and Settings list must show the new name without closing an editor or navigating.

## Assumptions & contingencies
The existing product scope is the default workspace only; the stream filters to that workspace because `/api/event-records` already does so. If workspace membership enforcement is introduced before implementation, make the shared context helper authorize membership first and derive its stream filter from that authorized workspace; do not subscribe before authorization succeeds.

Supabase Realtime is expected to be enabled for the existing project. If the publication is unavailable in the target environment, leave the application data boundary unchanged, enable Realtime through the Supabase project settings, then apply the idempotent publication migration; do not fall back to polling or a public browser database subscription.
