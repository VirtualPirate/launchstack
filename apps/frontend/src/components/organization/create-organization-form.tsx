import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { CreateOrganizationSchema } from "@launchstack/api-interfaces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { extractErrorMessage } from "@/lib/extract-error";
import { useCreateOrganization } from "@/hooks/api/use-organizations";
import { useActiveOrganizationStore } from "@/stores/active-organization-store";

/**
 * The create-organization form on its own, so the `/organizations/new` page and
 * the no-organization takeover can both render it without duplicating the
 * parse → mutate → set-active → navigate sequence. The active id is set before
 * navigating so the takeover's `!activeOrgId` clause closes immediately, ahead
 * of the org-list refetch.
 */
export function CreateOrganizationForm() {
  const navigate = useNavigate();
  const setActive = useActiveOrganizationStore((s) => s.setActiveOrganizationId);
  const createOrg = useCreateOrganization();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const parsed = CreateOrganizationSchema.safeParse({ name });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    try {
      const result = await createOrg.mutateAsync(parsed.data);
      setActive(result.data.id);
      await navigate({ to: "/" });
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="org-name">Organization name</Label>
        <Input
          id="org-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Inc"
          required
          disabled={createOrg.isPending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "org-name-error" : undefined}
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" id="org-name-error" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={createOrg.isPending}>
        {createOrg.isPending ? (
          <>
            <Loader2 className="animate-spin" />
            Creating…
          </>
        ) : (
          "Create organization"
        )}
      </Button>
    </form>
  );
}
