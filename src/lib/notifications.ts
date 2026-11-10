/** What each notice says after "<group>: <round>". Shared by the home page and the pop-ups. */
export const NOTE_TEXT: Record<string, string> = {
  reminder_30: "closes in 30 minutes and you have not answered.",
  reminder_10: "closes in 10 minutes and you have not answered.",
  reminder_manual: "needs your answer. The leader sent a reminder.",
  repick: "needs a new pick from you: the leader removed your dish.",
  ordered: "has been ordered. Food is on the way.",
  pick_edited: "had your picks changed by the leader.",
};

export type PopupNote = { id: string; sentAt: string; title: string; body: string; href: string };
