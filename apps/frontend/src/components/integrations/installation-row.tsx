import type { GithubInstallationWithRepos } from "@launchstack/api-interfaces"
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Lock,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useSyncGithubInstallation } from "@/hooks/api/use-github-integrations"
import { DisconnectInstallationDialog } from "./disconnect-installation-dialog"

type Props = {
  installation: GithubInstallationWithRepos
  defaultExpanded?: boolean
}

export function InstallationRow({ installation, defaultExpanded }: Props) {
  const [expanded, setExpanded] = useState(!!defaultExpanded)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const syncMutation = useSyncGithubInstallation()

  const configureUrl =
    installation.accountType === "Organization"
      ? `https://github.com/organizations/${installation.accountLogin}/settings/installations/${installation.githubInstallationId}`
      : `https://github.com/settings/installations/${installation.githubInstallationId}`

  return (
    <>
      <div className="grid grid-cols-[24px_1.6fr_0.8fr_0.6fr_1fr] items-center border-t px-3 py-2 first:border-t-0">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>
        <div className="flex items-center gap-2">
          <Avatar className="size-5">
            {installation.accountAvatarUrl ? (
              <AvatarImage src={installation.accountAvatarUrl} />
            ) : null}
            <AvatarFallback className="text-[10px]">
              {installation.accountLogin.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">{installation.accountLogin}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {installation.accountType}
        </span>
        <span className="text-sm">{installation.repositories.length}</span>
        <div className="flex justify-end gap-1">
          <Button asChild variant="ghost" size="sm">
            <a href={configureUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" />
              Configure
            </a>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => syncMutation.mutate(installation.id)}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className="size-3.5" />
            {syncMutation.isPending ? "Syncing..." : "Sync"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDisconnectOpen(true)}
            className="text-destructive"
          >
            <Trash2 className="size-3.5" />
            Disconnect
          </Button>
        </div>
      </div>

      {expanded
        ? installation.repositories.map((repo) => (
            <div
              key={repo.id}
              className="grid grid-cols-[24px_1.6fr_0.8fr_0.6fr_1fr] items-center border-t bg-muted/40 px-3 py-1.5 text-sm"
            >
              <span />
              <span className="flex items-center gap-2 pl-7">
                <Lock className="size-3 text-muted-foreground" />
                {repo.fullName}
              </span>
              <span className="text-xs text-muted-foreground">
                {repo.private ? "private" : "public"}
              </span>
              <span />
              <span />
            </div>
          ))
        : null}

      <DisconnectInstallationDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        installationId={installation.id}
        accountLogin={installation.accountLogin}
      />
    </>
  )
}
