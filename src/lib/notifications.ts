/** What each notice says after "<group>: <round>". Shared by the home page and the pop-ups. */
export const NOTE_TEXT: Record<string, string> = {
  reminder_30: "closes in 30 minutes and you have not answered.",
  reminder_10: "closes in 10 minutes and you have not answered.",
  reminder_manual: "needs your answer. The leader sent a reminder.",
  repick: "needs a new pick from you: the leader removed your dish.",
  ordered: "has been ordered. Food is on the way.",
  pick_edited: "had your picks changed by the leader.",
};

export const NOTE_TEXT_KO: Record<string, string> = {
  reminder_30: "마감 30분 전인데 아직 응답하지 않았어요.",
  reminder_10: "마감 10분 전인데 아직 응답하지 않았어요.",
  reminder_manual: "응답이 필요해요. 리더가 알림을 보냈어요.",
  repick: "다시 골라 주세요. 리더가 메뉴를 뺐어요.",
  ordered: "주문 완료! 음식이 오고 있어요.",
  pick_edited: "리더가 내 메뉴를 바꿨어요.",
};

export const noteText = (type: string, lang: "en" | "ko") => (lang === "ko" ? NOTE_TEXT_KO : NOTE_TEXT)[type];

export type PopupNote = { id: string; sentAt: string; title: string; body: string; href: string };
