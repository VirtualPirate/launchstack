import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useDisconnectGithubInstallation } from "@/hooks/api/use-github-integrations"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  installationId: string
  accountLogin: string
}

export function DisconnectInstallationDialog({
  open,
  onOpenChange,
  installationId,
  accountLogin,
}: Props) {
  const mutation = useDisconnectGithubInstallation()

  const handleConfirm = async () => {
    await mutation.mutateAsync(installationId)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disconnect {accountLogin}?</DialogTitle>
          <DialogDescription>
            You&apos;ll also need to uninstall the GitBrief GitHub App on GitHub
            to fully revoke access.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Disconnecting..." : "Disconnect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
