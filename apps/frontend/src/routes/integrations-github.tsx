import { useSearch } from "@tanstack/react-router"
import { Rocket } from "lucide-react"
import { PageHeader } from "@/components/gitbrief/shared/page-header"
import { ConnectGithubButton } from "@/components/integrations/connect-github-button"
import { InstallationRow } from "@/components/integrations/installation-row"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useGithubInstallations } from "@/hooks/api/use-github-integrations"

export function IntegrationsGithubPage() {
  const query = useGithubInstallations()
  const search = useSearch({ strict: false }) as {
    connected?: string
    error?: string
  }

  const installations = query.data?.data ?? []
  const totalRepos = installations.reduce((count, item) => {
    return count + item.repositories.length
  }, 0)

  return (
    <>
      <PageHeader
        title="GitHub integration"
        description={
          <>
            {installations.length} installation
            {installations.length === 1 ? "" : "s"} · {totalRepos} repositor
            {totalRepos === 1 ? "y" : "ies"} connected
          </>
        }
        actions={<ConnectGithubButton />}
      />

      {search.connected ? (
        <p className="mb-3 text-sm text-emerald-600">GitHub connected.</p>
      ) : null}
      {search.error ? (
        <p className="mb-3 text-sm text-destructive">
          GitHub connect failed: {search.error}
        </p>
      ) : null}

      {query.isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Loading...
          </CardContent>
        </Card>
      ) : installations.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <Rocket className="size-8 text-muted-foreground" />
            <CardTitle>Connect your first GitHub account</CardTitle>
            <CardDescription>
              GitBrief will summarize PRs, branches, and commits for the
              repositories you connect.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <ConnectGithubButton />
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border bg-background">
          <div className="grid grid-cols-[24px_1.6fr_0.8fr_0.6fr_1fr] bg-muted/60 px-3 py-2 text-xs tracking-wide text-muted-foreground uppercase">
            <span />
            <span>Account / Repository</span>
            <span>Type</span>
            <span>Repos</span>
            <span className="text-right">Actions</span>
          </div>
          {installations.map((installation, idx) => (
            <InstallationRow
              key={installation.id}
              installation={installation}
              defaultExpanded={idx === 0}
            />
          ))}
        </div>
      )}

      <Separator className="my-6" />
      <p className="text-xs text-muted-foreground">
        To add or remove repositories, use &quot;Configure&quot; on an
        installation - it opens GitHub&apos;s settings.
      </p>
    </>
  )
}
