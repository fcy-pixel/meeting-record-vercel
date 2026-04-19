"use client";

import { useState, useRef } from "react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";

const YEAR_OPTIONS = ["2023-2024", "2024-2025", "2025-2026"];
const TERM_OPTIONS = ["上學期", "下學期"];
const GRADE_OPTIONS = ["一年級", "二年級", "三年級", "四年級", "五年級", "六年級"];
const FOCUS_OPTIONS = [
  "進度擬寫", "測考擬題", "教學設計", "活動安排", "教學反思", "成績分析",
];
const DIVERSITY_OPTIONS = [
  "教學方法", "教學資源", "分層課業", "評估調適", "課程調適", "同儕學習",
];

export default function Home() {
  const [form, setForm] = useState({
    year: "2025-2026",
    term: "下學期",
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
  });

  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  function update(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleMulti(key: "focus" | "diversity", value: string) {
    setForm((prev) => {
      const arr = prev[key] as string[];
      return { ...prev, [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] };
    });
  }

  async function handleGenerate() {
    setLoading(true);
    setResult("");
    try {
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await resp.json();
      if (data.error) {
        showToast(data.error, "error");
      } else {
        setResult(data.result);
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    } catch {
      showToast("生成失敗，請重試", "error");
    }
    setLoading(false);
  }

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
    setForm({
      year: "2025-2026", term: "下學期", subject: "", grade: "",
      week_date: "", time: "3:15", location: "教員室", recorder: "",
      att_head: "", att_faith: "", att_hope: "", att_love: "",
      att_wisdom: "", att_guest: "", focus: [], content: "", diversity: [],
    });
    setResult("");
  }

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  return (
    <div className="container">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div className="page-header">
        <img src="/logo.png" alt="基慈小學" />
        <div>
          <h1>會議紀錄生成器</h1>
          <p>AI 自動生成會議紀錄 Powered by Qwen AI</p>
        </div>
      </div>

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
        <div className="form-grid">
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
          </div>
          <div className="form-group full">
            <label>會議重點內容</label>
            <textarea
              value={form.content}
              onChange={(e) => update("content", e.target.value)}
              placeholder="輸入會議重點、口語亦可，AI 會自動整理成正式紀錄"
              rows={5}
            />
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
          </div>
        </div>

        <div className="btn-row">
          <button className="btn btn-primary" onClick={handleGenerate} disabled={loading}>
            {loading ? "生成中..." : "🤖 AI 生成會議紀錄"}
          </button>
          <button className="btn btn-secondary" onClick={handleReset}>重設</button>
        </div>
      </div>

      {/* 結果 */}
      {(result || loading) && (
        <div className="result-card" ref={resultRef}>
          <h2>📄 生成結果</h2>
          {loading ? (
            <div style={{ textAlign: "center", padding: 30, color: "var(--text-light)" }}>
              AI 正在生成會議紀錄<span className="loading-dots"></span>
            </div>
          ) : (
            <>
              <div className="result-content">{result}</div>
              <div className="btn-row">
                <button className="btn btn-primary" onClick={handleDownloadDocx}>📥 下載 DOCX</button>
                <button className="btn btn-primary" onClick={handleCopy}>📋 複製紀錄</button>
                <button className="btn btn-secondary" onClick={handleGenerate}>🔄 重新生成</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
