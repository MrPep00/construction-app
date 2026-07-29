// Generated from Supabase — run: pnpm supabase gen types typescript --project-id <your-project-id> > lib/types/db.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type IssueStatus = "open" | "resolved"
export type LocationType = "branch" | "tenant_changes" | "apartment" | "room" | "folder"
export type TaskStatus = "todo" | "doing" | "done"
export type MovementReason = "delivery" | "consumption" | "correction"
