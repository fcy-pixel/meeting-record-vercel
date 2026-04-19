import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const QWEN_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const MODEL_NAME = "qwen-plus";

const SYSTEM_PROMPT = `你是一個專業的學校會議紀錄撰寫助手。根據用戶提供的會議資料，生成一份正式、完整的會議紀錄。

格式要求：
1. 使用繁體中文
2. 純文字輸出，絕對不要使用 Markdown 符號（如 **、##、*、- 等）、emoji、特殊符號
3. 只用數字編號（如 1. 2. 3.）和文字來組織內容
4. 如果某個欄位沒有提供資料（空白），該欄位留空或不顯示，不要編造內容
5. 根據「會議重點」內容，整理成條理清晰的會議紀錄
6. 如有「照顧學習多樣性」相關內容，應納入紀錄
7. 語言要正式、簡潔
8. 結尾加上「散會時間」和「下次會議日期：待定」`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "QWEN_API_KEY not configured" }, { status: 500 });
  }

  const body = await req.json();
  const {
    year, term, subject, grade, week_date, time, location, recorder,
    att_head, att_faith, att_hope, att_love, att_wisdom, att_guest,
    focus, content, diversity, diversity_detail,
  } = body;

  const attendees = [
    att_head && `科主任：${att_head}`,
    att_faith && `信：${att_faith}`,
    att_hope && `望：${att_hope}`,
    att_love && `愛：${att_love}`,
    att_wisdom && `智：${att_wisdom}`,
    att_guest && `嘉賓：${att_guest}`,
  ].filter(Boolean).join("、");

  const userPrompt = `請根據以下資料生成一份正式的會議紀錄：

學年：${year || ""}
學期：${term || ""}
科目：${subject || ""}
年級：${grade || ""}
日期/周次：${week_date || ""}
時間：${time || ""}
地點：${location || ""}
記錄者：${recorder || ""}
出席者：${attendees}
會議議題：${Array.isArray(focus) ? focus.join("、") : focus || ""}
會議重點內容：${content || ""}
${(Array.isArray(diversity) ? diversity.length > 0 : diversity) ? `照顧學習多樣性：${Array.isArray(diversity) ? diversity.join("、") : diversity}` : ""}
${diversity_detail ? `照顧學習多樣性內容：${diversity_detail}` : ""}

請生成完整的會議紀錄。`;

  const client = new OpenAI({ apiKey, baseURL: QWEN_BASE_URL });

  const response = await client.chat.completions.create({
    model: MODEL_NAME,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 3000,
  });

  const result = response.choices[0]?.message?.content || "（無回應）";
  return NextResponse.json({ result });
}
