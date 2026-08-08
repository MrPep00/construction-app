"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { PlusIcon, WrenchIcon, CheckSquareIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { IssueListClient, type IssueRow } from "@/components/issues/IssueListClient"
import { TaskListClient, type TaskRow } from "@/components/tasks/TaskListClient"
import { IssueForm } from "@/components/issues/IssueForm"
import { TaskForm } from "@/components/tasks/TaskForm"

type Tab = "usterki" | "zadania"

interface Props {
  issues: IssueRow[]
  tasks: TaskRow[]
  locationId: string
  projectId: string
  floorId: string
}

export function LocationSidePanel({ issues, tasks, locationId, projectId, floorId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("usterki")
  const [createDialog, setCreateDialog] = useState<"issue" | "task" | null>(null)
  // Optimistically created issues not yet present in server data; rows are
  // dropped at render time once router.refresh() delivers them via props.
  const [extraIssues, setExtraIssues] = useState<IssueRow[]>([])
  const mergedIssues = [
    ...extraIssues.filter((e) => !issues.some((i) => i.id === e.id)),
    ...issues,
  ]
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  // FAB deep link: /...?nowa-usterka=1 opens the new-issue dialog directly
  useEffect(() => {
    if (searchParams.get("nowa-usterka") === "1") {
      setActiveTab("usterki")
      setCreateDialog("issue")
      router.replace(pathname, { scroll: false })
    }
  }, [searchParams, pathname, router])

  return (
    <>
      <div className="rounded-xl border bg-card lg:sticky lg:top-[calc(3.5rem+1px)] lg:max-h-[calc(100vh-3.5rem-2rem)] lg:overflow-y-auto">
        <div className="flex items-center gap-1 border-b px-2 py-1.5">
          <div className="flex flex-1 gap-0.5">
            {(["usterki", "zadania"] as Tab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                  activeTab === tab
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
              aria-label="Dodaj"
            >
              <PlusIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setCreateDialog("issue")}>
                <WrenchIcon className="size-4" />
                Dodaj usterkę
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCreateDialog("task")}>
                <CheckSquareIcon className="size-4" />
                Dodaj zadanie
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="p-4">
          {activeTab === "usterki" && (
            <IssueListClient issues={mergedIssues} locationId={locationId} />
          )}
          {activeTab === "zadania" && (
            <TaskListClient
              tasks={tasks}
              projectId={projectId}
              floorId={floorId}
              hideCreate
            />
          )}
        </div>
      </div>

      {createDialog === "issue" && (
        <IssueForm
          mode="create"
          locationId={locationId}
          onOptimisticAdd={(issue) => setExtraIssues((prev) => [issue, ...prev])}
          onOptimisticReplace={(tempId, issue) =>
            setExtraIssues((prev) =>
              prev.map((i) => (i.id === tempId ? issue : i))
            )
          }
          onOptimisticRemove={(tempId) =>
            setExtraIssues((prev) => prev.filter((i) => i.id !== tempId))
          }
          onClose={() => setCreateDialog(null)}
        />
      )}

      {createDialog === "task" && (
        <TaskForm
          mode="create"
          projectId={projectId}
          locationId={locationId}
          onClose={() => setCreateDialog(null)}
        />
      )}
    </>
  )
}
