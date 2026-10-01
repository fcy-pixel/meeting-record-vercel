import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { NextRequest } from "next/server";
import { Completions } from "openai/resources/chat/completions";
import { POST } from "../app/api/generate/route";
import { formatMeetingRecord, MAX_TRANSCRIPT_LENGTH, MeetingForm, parseAnalysis } from "../app/lib/meeting";

const modelData = {
  focus: ["教學設計", "進度擬寫"],
  diversity: ["分層課業", "同儕學習"],
  diversity_detail: "學習較弱學生使用基礎工作紙，由能力較高的同學協助。",
  sections: [
    { topic: "教學設計", content: "張老師建議試行同儕協作，安排仍待確認。" },
    { topic: "進度擬寫", content: "第五周完成分數單元，由李老師於10月9日前修訂進度表。" },
    { topic: "其他事項", content: "教員室打印機故障，交總務組跟進。" },
  ],
  adjournment_time: "", next_meeting_date: "",
};
const originalKey = process.env.QWEN_API_KEY;
afterEach(() => {
  mock.restoreAll();
  if (originalKey === undefined) delete process.env.QWEN_API_KEY;
  else process.env.QWEN_API_KEY = originalKey;
});
function request(body: unknown) {
  return new NextRequest("http://localhost/api/generate", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}
function model(content = JSON.stringify(modelData), finish_reason = "stop") {
  process.env.QWEN_API_KEY = "test-only";
  return mock.method(Completions.prototype, "create", async () => ({ choices: [{ message: { content }, finish_reason }] }));
}

test("transcript alone classifies multiple agendas and diversity while preserving uncategorized items", async () => {
  const call = model();
  const response = await POST(request({ content: "會議逐字稿", year: "2026-2027" }));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data.analysis.focus, ["進度擬寫", "教學設計"]);
  assert.deepEqual(data.analysis.diversity, ["分層課業", "同儕學習"]);
  assert.match(data.result, /1\. 進度擬寫/);
  assert.match(data.result, /2\. 教學設計/);
  assert.match(data.result, /其他事項\n教員室打印機故障/);
  assert.match(data.result, /李老師於10月9日前/);
  assert.match(data.result, /安排仍待確認/);
  assert.match(data.result, /照顧學習多樣性/);
  assert.equal(call.mock.calls.length, 1);
});

test("analyze mode returns reviewable sections without generating a record", async () => {
  model();
  const data = await (await POST(request({ content: "逐字稿", mode: "analyze" }))).json();
  assert.equal(data.result, undefined);
  assert.equal(data.analysis.sections.length, 3);
});

test("no diversity leaves both checkboxes and detail empty", async () => {
  model(JSON.stringify({ ...modelData, diversity: [], diversity_detail: "" }));
  const data = await (await POST(request({ content: "只討論進度及普通教學安排" }))).json();
  assert.deepEqual(data.analysis.diversity, []);
  assert.equal(data.analysis.diversity_detail, "");
  assert.doesNotMatch(data.result, /照顧學習多樣性/);
});

test("manual deselection is respected without losing the corresponding discussion", async () => {
  const call = model();
  const data = await (await POST(request({ content: "逐字稿", overrides: { focus: { "教學設計": false, "活動安排": true }, diversity: { "同儕學習": false } } }))).json();
  assert.deepEqual(data.analysis.focus, ["進度擬寫", "活動安排"]);
  assert.deepEqual(data.analysis.diversity, ["分層課業"]);
  assert.doesNotMatch(data.result, /\d\. 教學設計/);
  assert.match(data.result, /張老師建議試行同儕協作/);
  assert.doesNotMatch(data.result, /\d\. 活動安排/); // A selected label cannot create missing facts.
  const prompt = JSON.parse((call.mock.calls[0].arguments[0] as any).messages[1].content);
  assert.equal(prompt.overrides, undefined); // Label edits must not influence extraction of the discussion.
});

test("manual diversity supplement is preserved even without a chosen checkbox", async () => {
  model(JSON.stringify({ ...modelData, diversity: [], diversity_detail: "手動補充：提供圖像提示。" }));
  const data = await (await POST(request({ content: "逐字稿", diversity_detail: "手動補充：提供圖像提示。" }))).json();
  assert.match(data.result, /手動補充：提供圖像提示/);
});

test("malformed and truncated model responses cannot be presented as complete records", async () => {
  const call = model("{", "length");
  const truncated = await POST(request({ content: "逐字稿" }));
  assert.equal(truncated.status, 502);
  assert.equal((await truncated.json()).result, undefined);
  call.mock.mockImplementation(async () => ({ choices: [{ message: { content: "{}" }, finish_reason: "stop" }] }));
  const malformed = await POST(request({ content: "逐字稿" }));
  assert.equal(malformed.status, 502);
  assert.equal((await malformed.json()).result, undefined);
});

test("invalid requests and overlong transcripts fail before calling the AI", async () => {
  const call = model();
  for (const body of [null, {}, { content: "  " }, { content: 123 }, { content: "字".repeat(MAX_TRANSCRIPT_LENGTH + 1) }]) {
    assert.equal((await POST(request(body))).status, 400);
  }
  const invalid = new NextRequest("http://localhost/api/generate", { method: "POST", body: "{" });
  assert.equal((await POST(invalid)).status, 400);
  assert.equal(call.mock.calls.length, 0);
});

test("AI connection failure returns a retryable message without provider or credential details", async () => {
  const call = model();
  call.mock.mockImplementation(async () => { throw new Error("secret provider diagnostic"); });
  const response = await POST(request({ content: "逐字稿" }));
  assert.equal(response.status, 502);
  const data = await response.json();
  assert.match(data.error, /請稍後重試/);
  assert.doesNotMatch(data.error, /secret/);
});

test("blank metadata and unspecified meeting times are not invented", () => {
  const form = Object.fromEntries(["year", "term", "subject", "grade", "week_date", "time", "location", "recorder", "att_head", "att_faith", "att_hope", "att_love", "att_wisdom", "att_guest", "content", "diversity_detail"].map(key => [key, ""])) as unknown as MeetingForm;
  const result = formatMeetingRecord(form, parseAnalysis(JSON.stringify(modelData)));
  assert.doesNotMatch(result, /出席者：|日期／周次：/);
  assert.match(result, /散會時間：未提供/);
  assert.match(result, /下次會議日期：待定/);
});

test("unknown categories and empty summaries are rejected", () => {
  assert.throws(() => parseAnalysis(JSON.stringify({ ...modelData, diversity: ["未知分類"] })));
  assert.throws(() => parseAnalysis(JSON.stringify({ ...modelData, sections: [] })));
  assert.throws(() => parseAnalysis(JSON.stringify({ ...modelData, sections: [{ topic: "教學設計", content: " " }] })));
});
