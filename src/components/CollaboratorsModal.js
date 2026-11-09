import React, { useState } from "react";
import { html } from "htm/react";

export function CollaboratorsModal({
  isOpen,
  onClose,
  activeList,
  currentUser,
  onInviteEmail,
  onRemoveEmail
}) {
  const [emailInput, setEmailInput] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedType, setCopiedType] = useState("");

  if (!isOpen || !activeList) return null;

  const handleAddEmail = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setStatusMsg("");
    try {
      await onInviteEmail(activeList.id, emailInput);
      setStatusMsg(`已成功將 ${emailInput.trim().toLowerCase()} 加入協作名單！`);
      setEmailInput("");
    } catch (err) {
      setErrorMsg(err.message || "邀請失敗");
    }
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(activeList.inviteCode || "");
    setCopiedType("code");
    setTimeout(() => setCopiedType(""), 2000);
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?invite=${activeList.inviteCode}`;
    navigator.clipboard.writeText(url);
    setCopiedType("link");
    setTimeout(() => setCopiedType(""), 2000);
  };

  const memberEmails = activeList.memberEmails || [];

  return html`
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <span>👥</span> 多人協作管理 — ${activeList.name}
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              邀請團隊成員共同編輯、指派與即時同步待辦事項
            </p>
          </div>
          <button
            onClick=${onClose}
            className="text-slate-400 hover:text-white px-2 py-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          <!-- 邀請碼與分享連結 -->
          <div className="bg-indigo-50/80 border border-indigo-100 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-indigo-950 uppercase tracking-wider">
                清單專屬邀請碼
              </div>
              <div className="text-2xl font-mono font-extrabold text-indigo-600 tracking-widest mt-0.5">
                ${activeList.inviteCode || "------"}
              </div>
              <div className="text-[11px] text-indigo-700 mt-0.5">
                其他使用者登入後輸入此邀請碼，即可加入此清單
              </div>
            </div>
            <div className="flex flex-col gap-1.5 w-full sm:w-auto">
              <button
                type="button"
                onClick=${copyInviteCode}
                className="px-3.5 py-1.5 rounded-lg bg-white border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition"
              >
                ${copiedType === "code" ? "✓ 已複製邀請碼" : "複製邀請碼"}
              </button>
              <button
                type="button"
                onClick=${copyShareLink}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
              >
                ${copiedType === "link" ? "✓ 已複製邀請連結" : "複製邀請連結"}
              </button>
            </div>
          </div>

          <!-- 透過 Email 直接邀請 -->
          <form onSubmit=${handleAddEmail} className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              透過 Google 帳號 Email 直接加入協作者：
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                required
                value=${emailInput}
                onChange=${(e) => setEmailInput(e.target.value)}
                placeholder="輸入協作者的 Gmail，例如 colleague@gmail.com"
                className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shrink-0"
              >
                新增成員
              </button>
            </div>
            ${statusMsg &&
            html`<p className="text-xs text-emerald-600 font-medium">✓ ${statusMsg}</p>`}
            ${errorMsg &&
            html`<p className="text-xs text-rose-600 font-medium">⚠️ ${errorMsg}</p>`}
          </form>

          <!-- 目前成員清單 -->
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-2">
              目前協作成員 (${memberEmails.length} 人)
            </div>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-48 overflow-y-auto">
              ${memberEmails.map((email) => {
                const isOwner = email === activeList.ownerEmail;
                const isMe = email === (currentUser?.email || "").toLowerCase();
                return html`
                  <div
                    key=${email}
                    className="px-3.5 py-2.5 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center uppercase shrink-0">
                        ${email[0] || "U"}
                      </span>
                      <div className="truncate">
                        <span className="font-medium text-slate-800">${email}</span>
                        ${isMe &&
                        html`<span className="ml-1.5 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">您</span>`}
                        ${isOwner &&
                        html`<span className="ml-1.5 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold">建立者</span>`}
                      </div>
                    </div>
                    ${!isOwner &&
                    activeList.ownerId === currentUser?.uid &&
                    html`
                      <button
                        type="button"
                        onClick=${() => onRemoveEmail(activeList.id, email)}
                        className="text-rose-500 hover:text-rose-700 text-[11px] font-medium px-2 py-1"
                      >
                        移除
                      </button>
                    `}
                  </div>
                `;
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
