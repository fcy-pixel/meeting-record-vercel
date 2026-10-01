"use client";

import { useState, useRef } from "react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import {
  DIVERSITY_OPTIONS, FOCUS_OPTIONS, MAX_TRANSCRIPT_LENGTH, MeetingAnalysis, MeetingForm,
  emptyOverrides, formatMeetingRecord, selectCategories,
} from "./lib/meeting";

const YEAR_OPTIONS = ["2023-2024", "2024-2025", "2025-2026", "2026-2027"];
const TERM_OPTIONS = ["上學期", "下學期"];
const GRADE_OPTIONS = ["一年級", "二年級", "三年級", "四年級", "五年級", "六年級"];
const INITIAL_FORM: MeetingForm = {
    year: "2026-2027",
    term: "上學期",
    subject: "",
    grade: "",
    week_date: "",
    time: "3:15",
    location: "教員室",
    recorder: "",
    att_head: "",
    att_faith: "",
    att_hope: "",
    att_love: "",
    att_wisdom: "",
    att_guest: "",
    focus: [] as string[],
    content: "",
    diversity: [] as string[],
    diversity_detail: "",
  };

export default function Home() {
  const [form, setForm] = useState<MeetingForm>(INITIAL_FORM);

  const [result, setResult] = useState("");
  const [operation, setOperation] = useState<"analyze" | "generate" | null>(null);
  const [analysis, setAnalysis] = useState<MeetingAnalysis | null>(null);
  const overrides = useRef(emptyOverrides());
  const manualDiversityDetail = useRef(false);
  const loading = operation === "generate";
  const busy = operation !== null;
  const transcriptTooLong = form.content.length > MAX_TRANSCRIPT_LENGTH;
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  function update(key: string, value: string) {
    setResult("");
    if (key === "diversity_detail") {
      manualDiversityDetail.current = true;
      setAnalysis(null);
    }
    if (key === "content") {
      setAnalysis(null);
      setForm((prev) => ({
        ...prev, content: value,
        focus: selectCategories(FOCUS_OPTIONS, [], overrides.current.focus),
        diversity: selectCategories(DIVERSITY_OPTIONS, [], overrides.current.diversity),
        diversity_detail: manualDiversityDetail.current ? prev.diversity_detail : "",
      }));
    } else {
      setForm((prev) => ({ ...prev, [key]: value }));
    }
  }

  function toggleMulti(key: "focus" | "diversity", value: string) {
    overrides.current[key][value] = !form[key].includes(value);
    setResult("");
    setAnalysis(null);
    setForm((prev) => {
      const arr = prev[key] as string[];
      return { ...prev, [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] };
    });
  }

  async function handleProcess(mode: "analyze" | "generate", reuseAnalysis = true) {
    if (busy) return;
    if (!form.content.trim()) {
      showToast("請先貼上會議逐字稿", "error");
      return;
    }
    if (transcriptTooLong) {
      showToast("逐字稿超過字數上限，請按會議拆分", "error");
      return;
    }
    if (mode === "generate" && analysis && reuseAnalysis) {
      setResult(formatMeetingRecord(form, analysis));
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      return;
    }
    setOperation(mode);
    try {
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form, mode, overrides: overrides.current,
          diversity_detail: manualDiversityDetail.current ? form.diversity_detail : "",
        }),
      });
      const data = await resp.json();
      if (!resp.ok || data.error || !data.analysis || (mode === "generate" && typeof data.result !== "string")) {
        showToast(data.error || "AI 回應不完整，請重試", "error");
      } else {
        setAnalysis(data.analysis);
        setForm((prev) => ({
          ...prev,
          focus: data.analysis.focus,
          diversity: data.analysis.diversity,
          diversity_detail: data.analysis.diversity_detail,
        }));
        if (mode === "generate") {
          setResult(data.result);
          setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        } else {
          setResult("");
          showToast("已按逐字稿完成分類，可檢查及調整", "success");
        }
      }
    } catch {
      showToast("AI 分類或生成失敗，請重試", "error");
    }
    setOperation(null);
  }

  function handleGenerate() { return handleProcess("generate"); }

  function handleCopy() {
    navigator.clipboard.writeText(result).then(() => showToast("已複製到剪貼簿", "success"));
  }

  async function handleDownloadDocx() {
    const lines = result.split("\n");
    const children: Paragraph[] = [];

    for (const line of lines) {
      if (!line.trim()) {
        children.push(new Paragraph({ text: "" }));
      } else if (line.startsWith("#")) {
        const text = line.replace(/^#+\s*/, "");
        children.push(new Paragraph({
          text,
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }));
      } else {
        children.push(new Paragraph({
          children: [new TextRun({ text: line, size: 24 })],
          spacing: { after: 100 },
        }));
      }
    }

    const doc = new Document({
      sections: [{ children }],
    });

    const blob = await Packer.toBlob(doc);
    const filename = `會議紀錄_${form.subject || "未命名"}_${form.week_date || new Date().toLocaleDateString()}.docx`;
    saveAs(blob, filename);
    showToast("已下載 DOCX", "success");
  }

  function handleReset() {
    setForm(INITIAL_FORM);
    overrides.current = emptyOverrides();
    manualDiversityDetail.current = false;
    setAnalysis(null);
    setResult("");
  }

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  return (
    <div className="container">
      {toast && <div className={`toast toast-${toast.type}`} role={toast.type === "error" ? "alert" : "status"}>{toast.msg}</div>}

      <div className="page-header">
        <img src="/logo.png" alt="基慈小學" />
        <div style={{ flex: 1 }}>
          <h1>會議紀錄生成器</h1>
          <p>AI 自動生成會議紀錄 Powered by Qwen AI</p>
        </div>
        <div className="model-badge">
          <span className="model-dot"></span>
          <span>qwen-plus</span>
          <span className="model-vendor">Alibaba Cloud</span>
        </div>
      </div>

      <fieldset className="meeting-form" disabled={busy}>
      {/* 基本資料 */}
      <div className="form-card">
        <h2>📋 基本資料</h2>
        <div className="form-grid">
          <div className="form-group">
            <label>學年</label>
            <select value={form.year} onChange={(e) => update("year", e.target.value)}>
              {YEAR_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>學期</label>
            <select value={form.term} onChange={(e) => update("term", e.target.value)}>
              {TERM_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>科目</label>
            <input type="text" value={form.subject} onChange={(e) => update("subject", e.target.value)} placeholder="輸入科目名稱" />
          </div>
          <div className="form-group">
            <label>年級</label>
            <select value={form.grade} onChange={(e) => update("grade", e.target.value)}>
              <option value="">— 選擇年級 —</option>
              {GRADE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>周次 / 日期</label>
            <input type="text" value={form.week_date} onChange={(e) => update("week_date", e.target.value)} placeholder="例如：第5周 / 23/9" />
          </div>
          <div className="form-group">
            <label>時間</label>
            <input type="text" value={form.time} onChange={(e) => update("time", e.target.value)} placeholder="例如：3:15" />
          </div>
          <div className="form-group">
            <label>地點</label>
            <input type="text" value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="例如：教員室" />
          </div>
          <div className="form-group">
            <label>記錄者</label>
            <input type="text" value={form.recorder} onChange={(e) => update("recorder", e.target.value)} placeholder="老師姓名" />
          </div>
        </div>
      </div>

      {/* 出席者 */}
      <div className="form-card">
        <h2>👥 出席者</h2>
        <div className="form-grid">
          <div className="form-group">
            <label>科主任</label>
            <input type="text" value={form.att_head} onChange={(e) => update("att_head", e.target.value)} placeholder="姓名" />
          </div>
          <div className="form-group">
            <label>信</label>
            <input type="text" value={form.att_faith} onChange={(e) => update("att_faith", e.target.value)} placeholder="姓名" />
          </div>
          <div className="form-group">
            <label>望</label>
            <input type="text" value={form.att_hope} onChange={(e) => update("att_hope", e.target.value)} placeholder="姓名" />
          </div>
          <div className="form-group">
            <label>愛</label>
            <input type="text" value={form.att_love} onChange={(e) => update("att_love", e.target.value)} placeholder="姓名" />
          </div>
          <div className="form-group">
            <label>智</label>
            <input type="text" value={form.att_wisdom} onChange={(e) => update("att_wisdom", e.target.value)} placeholder="姓名" />
          </div>
          <div className="form-group">
            <label>嘉賓（選擇性）</label>
            <input type="text" value={form.att_guest} onChange={(e) => update("att_guest", e.target.value)} placeholder="如有，請填姓名" />
          </div>
        </div>
      </div>

      {/* 會議內容 */}
      <div className="form-card">
        <h2>📝 會議內容</h2>
        <p className="form-help intro-help">只需貼上逐字稿，AI 會自動選取會議議題、整理照顧學習多樣性內容，並按議題生成紀錄。分類後仍可自行調整。</p>
        <div className="form-grid">
          <div className="form-group full">
            <label htmlFor="transcript">會議逐字稿／會議重點內容</label>
            <textarea
              id="transcript"
              value={form.content}
              onChange={(e) => update("content", e.target.value)}
              placeholder="直接貼上完整逐字稿或口語筆記，不用預先分議題。AI 會整理討論、決定及跟進事項。"
              rows={8}
              aria-describedby="transcript-help"
              aria-invalid={transcriptTooLong}
            />
            <div className="transcript-toolbar">
              <p className="form-help" id="transcript-help">{form.content.length.toLocaleString()} / {MAX_TRANSCRIPT_LENGTH.toLocaleString()} 字</p>
              <button className="btn btn-secondary" onClick={() => handleProcess("analyze")} disabled={busy || !form.content.trim() || transcriptTooLong}>
                {operation === "analyze" ? "AI 分類中..." : "✨ AI 分類逐字稿"}
              </button>
            </div>
            {transcriptTooLong && <p className="form-error" role="alert">逐字稿超過 80,000 字，請按會議拆分。已貼上的文字會保留。</p>}
          </div>
          <div className="form-group full">
            <label>會議議題（可多選）</label>
            <div className="checkbox-group">
              {FOCUS_OPTIONS.map((o) => (
                <label key={o} className="checkbox-label">
                  <input type="checkbox" checked={form.focus.includes(o)} onChange={() => toggleMulti("focus", o)} />
                  {o}
                </label>
              ))}
            </div>
            <p className="form-help">不需預先勾選；AI 按內容自動多選。你手動調整的選項會優先採用。</p>
          </div>
          <div className="form-group full">
            <label>照顧學習多樣性（選擇性，可多選）</label>
            <div className="checkbox-group">
              {DIVERSITY_OPTIONS.map((o) => (
                <label key={o} className="checkbox-label">
                  <input type="checkbox" checked={form.diversity.includes(o)} onChange={() => toggleMulti("diversity", o)} />
                  {o}
                </label>
              ))}
            </div>
            <label htmlFor="diversity-detail" className="detail-label">照顧學習多樣性內容</label>
            <textarea
              id="diversity-detail"
              value={form.diversity_detail}
              onChange={(e) => update("diversity_detail", e.target.value)}
              placeholder="AI 會從逐字稿整理具體支援做法；沒有相關內容便留空。亦可自行補充。"
              rows={3}
              style={{ marginTop: 8 }}
            />
          </div>
          {analysis && (
            <div className="form-group full classification-status" role="status">
              <p>已完成分類：{analysis.focus.length ? analysis.focus.join("、") : "其他事項"}</p>
              <p>{analysis.diversity.length ? `照顧學習多樣性：${analysis.diversity.join("、")}` : "未選取照顧學習多樣性項目；沒有相關內容時會留空。"}</p>
              <details className="classification-preview">
                <summary>查看按議題整理的重點</summary>
                {analysis.sections.map((section, index) => (
                  <div className="agenda-section" key={`${section.topic}-${index}`}>
                    <h3>{section.topic}</h3>
                    <p>{section.content}</p>
                  </div>
                ))}
              </details>
            </div>
          )}
        </div>

        <div className="btn-row">
          <button className="btn btn-primary" onClick={handleGenerate} disabled={busy || !form.content.trim() || transcriptTooLong}>
            {loading ? "分類及生成中..." : "🤖 AI 分類並生成會議紀錄"}
          </button>
          <button className="btn btn-secondary" onClick={handleReset} disabled={busy}>重設</button>
        </div>
      </div>
      </fieldset>

      {/* 結果 */}
      {(result || loading) && (
        <div className="result-card" ref={resultRef}>
          <h2>📄 生成結果</h2>
          {loading ? (
            <div style={{ textAlign: "center", padding: 30, color: "var(--text-light)" }}>
              AI 正在分類逐字稿及生成會議紀錄<span className="loading-dots"></span>
            </div>
          ) : (
            <>
              <div className="result-content">{result}</div>
              <div className="btn-row">
                <button className="btn btn-primary" onClick={handleDownloadDocx} disabled={busy}>📥 下載 DOCX</button>
                <button className="btn btn-primary" onClick={handleCopy} disabled={busy}>📋 複製紀錄</button>
                <button className="btn btn-secondary" onClick={() => handleProcess("generate", false)} disabled={busy}>🔄 重新生成</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
