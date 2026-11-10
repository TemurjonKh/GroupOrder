"use client";

import { useRef, useState } from "react";
import { Camera, Trash } from "@phosphor-icons/react";
import { updateAvatar } from "@/app/actions";
import { ActionForm } from "./action-form";
import { Avatar, Button } from "./ui";
import { useT } from "./lang";

const SIZE = 256;

/** Crops a chosen photo to a square, shrinks it to 256 px and keeps it as a small JPEG. */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function AvatarPicker({ name, current }: { name: string; current: string | null }) {
  const t = useT();
  const [photo, setPhoto] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const shown = photo ?? current;

  async function choose(file: File | undefined) {
    setProblem(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) { setProblem(t("Please choose a photo.", "사진을 선택해 주세요.")); return; }
    try {
      setPhoto(await shrink(file));
    } catch {
      setProblem(t("That photo could not be read. Try a JPEG or PNG.", "사진을 읽을 수 없습니다. JPEG나 PNG로 해 보세요."));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar src={shown} name={name} size={88} />
      <div className="space-y-2">
        <input ref={input} type="file" accept="image/*" className="sr-only" aria-label={t("Choose a profile photo", "프로필 사진 선택")}
          onChange={(event) => choose(event.target.files?.[0])} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" look="secondary" onClick={() => input.current?.click()}>
            <Camera aria-hidden size={18} /> {shown ? t("Choose another photo", "다른 사진 선택") : t("Add a photo", "사진 추가")}
          </Button>
          {photo && (
            <ActionForm action={updateAvatar} hidden={{ avatar: photo }}>
              <Button>{t("Save photo", "사진 저장")}</Button>
            </ActionForm>
          )}
          {!photo && current && (
            <ActionForm action={updateAvatar} hidden={{ avatar: "" }}>
              <Button look="secondary"><Trash aria-hidden size={18} /> {t("Remove photo", "사진 삭제")}</Button>
            </ActionForm>
          )}
        </div>
        <p className="text-sm text-muted">{problem ?? t("Your groups see it next to your name and your picks.", "그룹 멤버에게 내 이름과 메뉴 옆에 표시됩니다.")}</p>
      </div>
    </div>
  );
}
