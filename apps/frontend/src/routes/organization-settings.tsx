import { useState } from "react";
import { UpdateOrganizationSchema } from "@launchstack/api-interfaces";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCurrentOrganization,
  useDeleteCurrentOrganization,
  useTransferOwnership,
  useUpdateCurrentOrganization,
} from "@/hooks/api/use-organizations";
import { useCurrentOrganizationMembers } from "@/hooks/api/use-members";
import { useActiveOrganizationStore } from "@/stores/active-organization-store";

export function OrganizationSettingsPage() {
  const current = useCurrentOrganization();
  const members = useCurrentOrganizationMembers();
  const updateOrg = useUpdateCurrentOrganization();
  const deleteOrg = useDeleteCurrentOrganization();
  const transfer = useTransferOwnership();
  const clearActive = useActiveOrganizationStore((s) => s.clear);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [newOwnerId, setNewOwnerId] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const role = current.data?.data.role;
  const org = current.data?.data.organization;
  const admins =
    members.data?.data.filter((m) => m.role === "admin") ?? [];

  if (!org) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const parsed = UpdateOrganizationSchema.safeParse({
      name: name || undefined,
      slug: slug || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    try {
      await updateOrg.mutateAsync(parsed.data);
      setName("");
      setSlug("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  const handleTransfer = async () => {
    if (!newOwnerId) return;
    await transfer.mutateAsync({ newOwnerUserId: newOwnerId });
    setNewOwnerId("");
  };

  const handleDelete = async () => {
    if (deleteConfirm !== org.name) return;
    await deleteOrg.mutateAsync();
    clearActive();
  };

  const canEdit = role === "owner" || role === "admin";
  const isOwner = role === "owner";

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <h1 className="text-2xl font-semibold">Organization settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Update your organization&apos;s public details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleUpdate}>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={org.name}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={org.slug}
                disabled={!canEdit}
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={!canEdit || updateOrg.isPending}>
              {updateOrg.isPending ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle>Transfer ownership</CardTitle>
            <CardDescription>
              Pick an admin to become the new owner. You&apos;ll be demoted to
              admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Select value={newOwnerId} onValueChange={setNewOwnerId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select an admin" />
              </SelectTrigger>
              <SelectContent>
                {admins.length === 0 ? (
                  <SelectItem value="_" disabled>
                    No admins to transfer to
                  </SelectItem>
                ) : (
                  admins.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.user.name} — {m.user.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              onClick={handleTransfer}
              disabled={!newOwnerId || transfer.isPending}
            >
              Transfer
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isOwner ? (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
            <CardDescription>
              Type <strong>{org.name}</strong> to permanently delete this
              organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={org.name}
            />
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConfirm !== org.name || deleteOrg.isPending}
            >
              Delete organization
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
