import React, { useState } from "react";
import { html } from "htm/react";
import {
  parseFirebaseConfigInput,
  saveFirebaseConfigToStorage,
  clearSavedFirebaseConfig
} from "../firebaseConfig.js";

export function FirebaseSetupModal({ isOpen, onClose, currentConfig, onConfigSaved, onEnterDemo }) {
  const [rawInput, setRawInput] = useState(
    currentConfig && currentConfig.apiKey !== "YOUR_API_KEY"
      ? JSON.stringify(currentConfig, null, 2)
      : ""
  );
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    setError("");
    try {
      const parsed = parseFirebaseConfigInput(rawInput);
      saveFirebaseConfigToStorage(parsed);
      onConfigSaved(parsed);
    } catch (err) {
      setError(err.message || "設定格式錯誤，請重新檢查。");
    }
  };

  const handleReset = () => {
    clearSavedFirebaseConfig();
    setRawInput("");
    window.location.reload();
  };

  return html`
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-100">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 text-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span>🔥</span> 連結 Firebase 專案「My To-Do List」
            </h2>
            <p className="text-xs text-indigo-100 mt-1">
              貼上 Firebase Console 的 Web SDK 設定即可啟用 Google 登入與雲端即時協作
            </p>
          </div>
          ${onClose &&
          html`
            <button
              onClick=${onClose}
              className="text-white/80 hover:text-white text-xl leading-none px-2 py-1 rounded-lg hover:bg-white/10"
            >
              ✕
            </button>
          `}
        </div>

        <form onSubmit=${handleSave} className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-1.5">
            <div className="font-semibold text-amber-950">如何取得設定並啟用登入：</div>
            <ol className="list-decimal list-inside space-y-1 text-amber-800">
              <li>
                前往 <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="underline font-medium">Firebase Console</a> 選擇專案 <strong>My To-Do List</strong>
              </li>
              <li>在「Project settings (專案設定)」下方「Your apps」複製 <code className="bg-amber-100 px-1 rounded">firebaseConfig</code></li>
              <li>在「Authentication → Sign-in method」啟用 <strong>Google</strong> 登入（並確認 Authorized domains 包含 <code className="bg-amber-100 px-1 rounded">localhost</code>）</li>
              <li>在「Firestore Database」建立資料庫，並套用專案根目錄的 <code className="bg-amber-100 px-1 rounded">firestore.rules</code></li>
            </ol>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              貼上 <code className="text-indigo-600">firebaseConfig</code> 物件（支援整段程式碼或 JSON）：
            </label>
            <textarea
              rows="8"
              value=${rawInput}
              onChange=${(e) => setRawInput(e.target.value)}
              placeholder=${`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "my-to-do-list-1a157.firebaseapp.com",\n  projectId: "my-to-do-list-1a157",\n  storageBucket: "my-to-do-list-1a157.firebasestorage.app",\n  messagingSenderId: "...",\n  appId: "..."\n};`}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-xs text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
            ></textarea>
            <p className="text-[11px] text-slate-400 mt-1">
              提示：您也可以直接編輯專案中的 <code className="text-slate-600">src/firebaseConfig.js</code> 檔案。
            </p>
          </div>

          ${error &&
          html`
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700">
              ⚠️ ${error}
            </div>
          `}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              ${onEnterDemo &&
              html`
                <button
                  type="button"
                  onClick=${onEnterDemo}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
                >
                  先使用「本地展示模式」預覽介面
                </button>
              `}
              <button
                type="button"
                onClick=${handleReset}
                className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-rose-600 transition"
              >
                清除快取設定
              </button>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 transition"
            >
              儲存並連線 Firebase
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}
