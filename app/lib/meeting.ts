export const FOCUS_OPTIONS = [
  "進度擬寫", "測考擬題", "教學設計", "活動安排", "教學反思", "成績分析",
] as const;

export const DIVERSITY_OPTIONS = [
  "教學方法", "教學資源", "分層課業", "評估調適", "課程調適", "同儕學習",
] as const;

export const MAX_TRANSCRIPT_LENGTH = 80000;
export type Focus = typeof FOCUS_OPTIONS[number];
export type Diversity = typeof DIVERSITY_OPTIONS[number];
export type Overrides = { focus: Partial<Record<Focus, boolean>>; diversity: Partial<Record<Diversity, boolean>> };
export const emptyOverrides = (): Overrides => ({ focus: {}, diversity: {} });

export interface MeetingAnalysis {
  focus: Focus[];
  diversity: Diversity[];
  diversity_detail: string;
  sections: { topic: Focus | "其他事項"; content: string }[];
  adjournment_time: string;
  next_meeting_date: string;
}

export interface MeetingForm {
  year: string;
  term: string;
  subject: string;
  grade: string;
  week_date: string;
  time: string;
  location: string;
  recorder: string;
  att_head: string;
  att_faith: string;
  att_hope: string;
  att_love: string;
  att_wisdom: string;
  att_guest: string;
  focus: string[];
  content: string;
  diversity: string[];
  diversity_detail: string;
}

export function selectCategories<T extends string>(
  options: readonly T[], detected: readonly string[], overrides: Partial<Record<T, boolean>> = {},
): T[] {
  return options.filter((option) => typeof overrides[option] === "boolean" ? overrides[option] : detected.includes(option));
}

// Reject malformed or truncated summaries instead of presenting them as complete records.
export function parseAnalysis(raw: string): MeetingAnalysis {
  const data = JSON.parse(raw);
  if (!data || !Array.isArray(data.focus) || !Array.isArray(data.diversity) ||
      typeof data.diversity_detail !== "string" || !Array.isArray(data.sections) ||
      !data.sections.length || typeof data.adjournment_time !== "string" || typeof data.next_meeting_date !== "string") {
    throw new Error("Invalid meeting analysis");
  }
  if (data.focus.some((item: unknown) => !FOCUS_OPTIONS.includes(item as Focus)) ||
      data.diversity.some((item: unknown) => !DIVERSITY_OPTIONS.includes(item as Diversity))) {
    throw new Error("Invalid meeting category");
  }
  const sections: MeetingAnalysis["sections"] = data.sections.map((section: any) => {
    if (!section || !(FOCUS_OPTIONS.includes(section.topic) || section.topic === "其他事項") ||
        typeof section.content !== "string" || !section.content.trim()) {
      throw new Error("Invalid meeting section");
    }
    return { topic: section.topic, content: section.content.trim() };
  });
  const diversity = selectCategories(DIVERSITY_OPTIONS, data.diversity);
  return {
    focus: selectCategories(FOCUS_OPTIONS, sections.map((section) => section.topic)),
    diversity,
    diversity_detail: data.diversity_detail.trim(),
    sections,
    adjournment_time: data.adjournment_time.trim(),
    next_meeting_date: data.next_meeting_date.trim(),
  };
}

export function formatMeetingRecord(form: MeetingForm, analysis: MeetingAnalysis): string {
  const metadata: [string, string][] = [
    ["學年", form.year], ["學期", form.term], ["科目", form.subject], ["年級", form.grade],
    ["日期／周次", form.week_date], ["時間", form.time], ["地點", form.location], ["記錄者", form.recorder],
  ];
  const attendees: [string, string][] = [
    ["科主任", form.att_head], ["信", form.att_faith], ["望", form.att_hope],
    ["愛", form.att_love], ["智", form.att_wisdom], ["嘉賓", form.att_guest],
  ];
  const lines = ["中華基督教會基慈小學", "會議紀錄", ""];
  metadata.forEach(([label, value]) => { if (value?.trim()) lines.push(`${label}：${value.trim()}`); });
  const present = attendees.filter(([, value]) => value?.trim()).map(([label, value]) => `${label}：${value.trim()}`);
  if (present.length) lines.push(`出席者：${present.join("、")}`);
  if (analysis.focus.length) lines.push(`會議議題：${analysis.focus.join("、")}`);
  lines.push("", "會議內容");

  let number = 1;
  for (const topic of [...FOCUS_OPTIONS, "其他事項"] as const) {
    const sections = analysis.sections.filter((section) => section.topic === topic);
    if (sections.length) lines.push("", `${number++}. ${topic}`, sections.map((section) => section.content).join("\n"));
  }
  if (analysis.diversity.length || analysis.diversity_detail) {
    lines.push("", `${number++}. 照顧學習多樣性`);
    if (analysis.diversity.length) lines.push(`支援方式：${analysis.diversity.join("、")}`);
    if (analysis.diversity_detail) lines.push(analysis.diversity_detail);
  }
  lines.push("", `散會時間：${analysis.adjournment_time || "未提供"}`, `下次會議日期：${analysis.next_meeting_date || "待定"}`);
  return lines.join("\n");
}
