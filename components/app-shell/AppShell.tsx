import { Sidebar } from "./Sidebar"
import { MobileNav } from "./MobileNav"
import { Fab } from "./Fab"
import type {
  IssueFloorOption,
  IssueApartmentOption,
} from "@/components/issues/IssueForm"

interface Props {
  projectId: string
  projectName: string
  openIssueCount: number
  isAdminUser: boolean
  unresolvedErrorCount: number
  userEmail: string
  floors: IssueFloorOption[]
  apartments: IssueApartmentOption[]
  children: React.ReactNode
}

export function AppShell({
  projectId,
  projectName,
  openIssueCount,
  isAdminUser,
  unresolvedErrorCount,
  userEmail,
  floors,
  apartments,
  children,
}: Props) {
  return (
    <div className="flex min-h-full flex-1">
      <Sidebar
        projectId={projectId}
        projectName={projectName}
        openIssueCount={openIssueCount}
        isAdminUser={isAdminUser}
        unresolvedErrorCount={unresolvedErrorCount}
        userEmail={userEmail}
      />
      {/* pb-36 = mobile bottom nav + FAB clearance; none needed on desktop */}
      <div className="min-w-0 flex-1 pb-36 lg:pb-0">{children}</div>
      <MobileNav projectId={projectId} openIssueCount={openIssueCount} />
      <Fab floors={floors} apartments={apartments} />
    </div>
  )
}
