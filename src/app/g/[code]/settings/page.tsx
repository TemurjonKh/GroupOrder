import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { leaveGroup, removeMember, setMemberRole, updateGroup } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { CopyButton, LocationFields, PrintButton } from "@/components/client-bits";
import { Button, Card, Field, Tag, inputStyles } from "@/components/ui";
import { getGroupContext, getRestaurants } from "@/lib/data";
import { getT } from "@/lib/i18n";
import { restaurantName } from "@/lib/names";

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
  const { lang, t } = await getT();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="p-5 print:border-0">
        <h2 className="font-display text-xl font-extrabold tracking-tight">{t("Invite people", "멤버 초대")}</h2>
        <p className="mb-3 text-sm text-muted">{t("Anyone with this link or QR can join. It always opens the current round.", "이 링크나 QR이 있으면 누구나 참여할 수 있습니다. 항상 현재 라운드가 열립니다.")}</p>
        <div className="flex flex-wrap items-center gap-4">
          {/* The SVG comes from the qrcode library and only encodes this group's link. */}
          <div className="size-36 shrink-0 overflow-hidden rounded-xl bg-white print:size-72" dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="min-w-0 space-y-2">
            <p className="text-sm">{group.name}</p>
            <p className="text-sm break-all text-muted">{link}</p>
            <div className="flex flex-wrap gap-2 print:hidden">
              <CopyButton text={link} label={t("Copy link", "링크 복사")} />
              <PrintButton />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 print:hidden">
        <h2 className="mb-2 font-display text-xl font-extrabold tracking-tight">{t("Members", "멤버")} ({members.length})</h2>
        <ul className="space-y-1">
          {members.map((member) => (
            <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                {member.name}{member.user_id === userId && t(" (you)", " (나)")}
                {member.role === "leader" && <Tag tone="accent">{t("Leader", "리더")}</Tag>}
              </span>
              {isLeader && member.user_id !== userId && (
                <span className="flex flex-wrap gap-2">
                  <ActionForm action={setMemberRole} hidden={{ ...groupFields, user: member.user_id, role: member.role === "leader" ? "member" : "leader" }}>
                    <Button look="secondary">{member.role === "leader" ? t("Make member", "멤버로 변경") : t("Make leader", "리더로 지정")}</Button>
                  </ActionForm>
                  <ActionForm action={removeMember} hidden={{ ...groupFields, user: member.user_id }}>
                    <Button look="danger">{t("Remove", "내보내기")}</Button>
                  </ActionForm>
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {isLeader && (
        <Card className="p-5 print:hidden">
          <h2 className="mb-3 font-display text-xl font-extrabold tracking-tight">{t("Group settings", "그룹 설정")}</h2>
          <ActionForm action={updateGroup} hidden={groupFields} className="space-y-4">
            <div className="grid grid-cols-[1fr_5rem] gap-3">
              <Field label={t("Name", "이름")}><input name="name" required maxLength={80} defaultValue={group.name} className={inputStyles} /></Field>
              <Field label={t("Icon", "아이콘")}><input name="icon" required maxLength={8} defaultValue={group.icon} className={inputStyles} /></Field>
            </div>
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">{t("Location", "위치")}</legend>
              <p className="text-sm text-muted">{t("Chains are always listed. Local restaurants show if they are within 3 km of here.", "프랜차이즈는 항상 표시됩니다. 동네 식당은 여기서 3km 이내일 때 표시됩니다.")}</p>
              <Field label={t("Place name", "장소 이름")}><input name="location" required maxLength={120} defaultValue={group.location_label} className={inputStyles} /></Field>
              <LocationFields lat={group.lat} lng={group.lng} />
            </fieldset>
            <fieldset>
              <legend className="text-sm font-medium">{t("Default restaurants", "기본 식당")}</legend>
              <p className="mb-2 text-sm text-muted">{t("Limits where people can order from the next round on. Up to 3, or none for all.", "다음 라운드부터 주문할 수 있는 식당을 제한합니다. 최대 3곳, 선택하지 않으면 전체입니다.")}</p>
              {restaurants.map((r) => (
                <label key={r.id} className="flex min-h-11 items-center gap-3 text-sm">
                  <input type="checkbox" name="restaurants" value={r.id} defaultChecked={group.default_restaurant_ids.includes(r.id)} className="size-5" />
                  {restaurantName(r, lang)}
                </label>
              ))}
            </fieldset>
            <Button>{t("Save", "저장")}</Button>
          </ActionForm>
        </Card>
      )}

      <div className="print:hidden">
        <ActionForm action={leaveGroup} hidden={groupFields}>
          <Button look="danger">{t("Leave this group", "그룹 나가기")}</Button>
        </ActionForm>
      </div>
    </div>
  );
}
