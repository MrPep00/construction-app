# MISTAKES.md — breakage log

> Protocol: one entry per confirmed breakage that reached `main` or production.
> Entry format: **date, symptom, root cause, fix commit, prevention rule.**
> Newest entries first. Log the mistake when the fix lands, not before —
> entries describe verified root causes, not hypotheses.

---

## 2026-08-28 — Issue photos render alt text instead of image (M9 relic)

**Symptom:** Issue photo grid in the issue detail dialog (location page) rendered
alt text (`image.jpg`) instead of images — every photo uploaded after the R2
migration (2026-05-15).

**Root cause:** `IssueDetailDialog` in `components/issues/IssueListClient.tsx`
fetched photos client-side and signed ALL storage paths via
`supabase.storage.from("files").createSignedUrls()`, ignoring
`storage_provider`. Post-M9 photos live in R2, not Supabase Storage — signing
produced no usable URL, the fallback set `signedUrl: ""`, and `<img src="">`
renders its alt text. The M9 sweep updated `resolveFileUrls` consumers but
missed this component because it bypassed the server data path entirely — it
was also a convention-4 violation (direct Supabase call in a component) that
predated the migration.

**Contributing factor:** convention 17 (open what you build) did not exist /
was not applied when the dialog shipped — the broken state only appears with
post-M9 photos at runtime; `pnpm build` stays green.

**Fix:** feat(issues) Phase 1 commit on `main` (2026-08-28) — photo URLs are
now resolved server-side for both issue lists via `lib/issue-photos.ts`
(`fetchIssuePhotos`: one batched query + provider-aware `resolveFileUrls`),
passed down as props; the dialog no longer talks to Supabase.

**Prevention:**
- Any code calling `supabase.storage` or `createSignedUrl*` outside
  `lib/storage/` + `lib/actions/` is wrong by construction — route through
  `resolveFileUrls`. Repo swept 2026-08-28: this was the only remaining case.
- When a storage/provider migration lands, grep for the OLD access pattern
  (`\.storage\b`, `createSignedUrl`) across the whole repo, not just the files
  the migration touched.
