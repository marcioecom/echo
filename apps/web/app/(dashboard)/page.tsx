import { requireWorkspace } from "@/modules/auth/server/session"

export default async function WorkspacePage() {
  const workspace = await requireWorkspace()

  return (
    <div className="space-y-2">
      <h1 className="text-lg font-medium">Support Inbox</h1>
      <p className="text-sm text-muted-foreground">
        {workspace.organization.name}&apos;s workspace is ready. The Support
        Inbox arrives with LEA-14.
      </p>
    </div>
  )
}
