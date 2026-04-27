import { IssueListClient, type IssueRow } from "./IssueListClient"

interface Props {
  issues: IssueRow[]
  locationId: string
}

export function IssueList({ issues, locationId }: Props) {
  return <IssueListClient issues={issues} locationId={locationId} />
}
