import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { leaveGroup, removeMember, setMemberRole, updateGroup } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { CopyButton, PrintButton } from "@/components/client-bits";
import { Button, Card, Field, Pill, inputStyles } from "@/components/ui";
import { getGroupContext, getRestaurants } from "@/lib/data";

export default async function SettingsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const context = await getGroupContext(code);
  if (!context) notFound();
  const { group, members, isLeader, userId } = context;

  const head = await headers();
  const link = `${head.get("x-forwarded-proto") ?? "http"}://${head.get("host")}/g/${code}/now`;
  const qr = await QRCode.toString(link, { type: "svg", margin: 1 });
  const restaurants = isLeader ? await getRestaurants() : [];
  const groupFields = { code, group: group.id };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="p-5 print:border-0">
        <h2 className="font-semibold">Invite people</h2>
        <p className="mb-3 text-sm text-muted">Anyone with this link or QR can join. It always opens the current round.</p>
        <div className="flex flex-wrap items-center gap-4">
          {/* The SVG comes from the qrcode library and only encodes this group's link. */}
          <div className="size-36 shrink-0 print:size-72" dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="min-w-0 space-y-2">
            <p className="text-sm">{group.name}</p>
            <p className="text-sm break-all text-muted">{link}</p>
            <div className="flex flex-wrap gap-2 print:hidden">
              <CopyButton text={link} label="Copy link" />
              <PrintButton />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 print:hidden">
        <h2 className="mb-2 font-semibold">Members ({members.length})</h2>
        <ul className="divide-y divide-soft">
          {members.map((member) => (
            <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                {member.name}{member.user_id === userId && " (you)"}
                {member.role === "leader" && <Pill tone="accent">Leader</Pill>}
              </span>
              {isLeader && member.user_id !== userId && (
                <span className="flex flex-wrap gap-2">
                  <ActionForm action={setMemberRole} hidden={{ ...groupFields, user: member.user_id, role: member.role === "leader" ? "member" : "leader" }}>
                    <Button look="secondary">{member.role === "leader" ? "Make member" : "Make leader"}</Button>
                  </ActionForm>
                  <ActionForm action={removeMember} hidden={{ ...groupFields, user: member.user_id }}>
                    <Button look="danger">Remove</Button>
                  </ActionForm>
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {isLeader && (
        <Card className="p-5 print:hidden">
          <h2 className="mb-3 font-semibold">Group settings</h2>
          <ActionForm action={updateGroup} hidden={groupFields} className="space-y-4">
            <div className="grid grid-cols-[1fr_5rem] gap-3">
              <Field label="Name"><input name="name" required maxLength={80} defaultValue={group.name} className={inputStyles} /></Field>
              <Field label="Icon"><input name="icon" required maxLength={8} defaultValue={group.icon} className={inputStyles} /></Field>
            </div>
            <Field label="Default closing time">
              <input name="deadline" type="time" required defaultValue={group.default_deadline.slice(0, 5)} className={`${inputStyles} max-w-40`} />
            </Field>
            <fieldset>
              <legend className="text-sm font-medium">Default restaurants</legend>
              <p className="mb-2 text-sm text-muted">Pinned when a round starts. Up to 3, or none for any nearby.</p>
              {restaurants.map((r) => (
                <label key={r.id} className="flex min-h-11 items-center gap-3 text-sm">
                  <input type="checkbox" name="restaurants" value={r.id} defaultChecked={group.default_restaurant_ids.includes(r.id)} className="size-5" />
                  {r.name}
                </label>
              ))}
            </fieldset>
            <Button>Save</Button>
          </ActionForm>
        </Card>
      )}

      <div className="print:hidden">
        <ActionForm action={leaveGroup} hidden={groupFields}>
          <Button look="danger">Leave this group</Button>
        </ActionForm>
      </div>
    </div>
  );
}
