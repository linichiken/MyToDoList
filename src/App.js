import React, { useState, useEffect, useMemo } from "react";
import { html } from "htm/react";
import {
  initFirebase,
  loginWithGoogle,
  logoutUser,
  subscribeToAuth,
  subscribeToUserLists,
  createCollaborativeList,
  deleteCollaborativeList,
  inviteCollaboratorByEmail,
  removeCollaboratorEmail,
  joinListByInviteCode,
  subscribeToListTodos,
  addTodoItem,
  toggleTodoCompleted,
  updateTodoDetails,
  deleteTodoItem
} from "./firebase.js";
import { FirebaseSetupModal } from "./components/FirebaseSetupModal.js";
import { CollaboratorsModal } from "./components/CollaboratorsModal.js";

const DEMO_USER = {
  uid: "demo-user-1",
  email: "demo.user@gmail.com",
  displayName: "王小明 (展示模式)"
};

const INITIAL_DEMO_LISTS = [
  {
    id: "demo-list-1",
    name: "🚀 產品上線籌備清單",
    description: "與設計、工程團隊共同追蹤的發佈待辦事項",
    ownerId: "demo-user-1",
    ownerEmail: "demo.user@gmail.com",
    memberIds: ["demo-user-1", "demo-user-2"],
    memberEmails: ["demo.user@gmail.com", "alex.chen@gmail.com", "sarah.lin@gmail.com"],
    inviteCode: "TEAM88"
  },
  {
    id: "demo-list-2",
    name: "🛒 週末露營採買清單",
    description: "多人共同認領的露營食材與裝備",
    ownerId: "demo-user-1",
    ownerEmail: "demo.user@gmail.com",
    memberIds: ["demo-user-1"],
    memberEmails: ["demo.user@gmail.com", "sarah.lin@gmail.com"],
    inviteCode: "CAMP26"
  }
];

const INITIAL_DEMO_TODOS = {
  "demo-list-1": [
    {
      id: "t-1",
      text: "完成 Firebase Google 登入與 Firestore 安全規則設定",
      completed: true,
      priority: "high",
      dueDate: "2026-11-10",
      assigneeEmail: "demo.user@gmail.com",
      createdByName: "王小明"
    },
    {
      id: "t-2",
      text: "確認多人即時同步邀請碼與協作者權限測試",
      completed: false,
      priority: "high",
      dueDate: "2026-11-12",
      assigneeEmail: "alex.chen@gmail.com",
      createdByName: "Alex Chen"
    },
    {
      id: "t-3",
      text: "整理首頁響應式排版與深色細節微調",
      completed: false,
      priority: "medium",
      dueDate: "2026-11-14",
      assigneeEmail: "sarah.lin@gmail.com",
      createdByName: "Sarah Lin"
    }
  ],
  "demo-list-2": [
    {
      id: "t-4",
      text: "準備四人帳篷與天幕營釘",
      completed: false,
      priority: "high",
      dueDate: "2026-11-15",
      assigneeEmail: "demo.user@gmail.com",
      createdByName: "王小明"
    }
  ]
};

export function App() {
  const [fbState, setFbState] = useState(() => initFirebase());
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showCollabModal, setShowCollabModal] = useState(false);

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  const [lists, setLists] = useState([]);
  const [activeListId, setActiveListId] = useState(null);
  const [todos, setTodos] = useState([]);
  const [demoTodosMap, setDemoTodosMap] = useState(INITIAL_DEMO_TODOS);

  // 新建清單與加入邀請碼表單狀態
  const [newListName, setNewListName] = useState("");
  const [newListDesc, setNewListDesc] = useState("");
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [bannerNotice, setBannerNotice] = useState("");

  // 新增待辦事項表單狀態
  const [todoText, setTodoText] = useState("");
  const [todoPriority, setTodoPriority] = useState("medium");
  const [todoDueDate, setTodoDueDate] = useState("");
  const [todoAssignee, setTodoAssignee] = useState("");
  const [filterMode, setFilterMode] = useState("all"); // all | active | completed | mine
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [editingTodoText, setEditingTodoText] = useState("");

  // 檢查網址是否帶有 ?invite=CODE
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("invite");
    if (code) {
      setInviteCodeInput(code.toUpperCase());
      setBannerNotice(`偵測到邀請碼「${code.toUpperCase()}」，登入後可點擊左側「加入」立即參與清單！`);
    }
  }, []);

  // 監聽 Firebase Auth 狀態
  useEffect(() => {
    if (isDemoMode) {
      setUser(DEMO_USER);
      setLists(INITIAL_DEMO_LISTS);
      setActiveListId(INITIAL_DEMO_LISTS[0].id);
      setAuthLoading(false);
      return;
    }

    if (!fbState.initialized) {
      setAuthLoading(false);
      setShowSetupModal(true);
      return;
    }

    setAuthLoading(true);
    const unsub = subscribeToAuth((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsub();
  }, [fbState.initialized, isDemoMode]);

  // 監聽使用者的所有協作清單
  useEffect(() => {
    if (isDemoMode) return;
    if (!fbState.initialized || !user) {
      setLists([]);
      setActiveListId(null);
      return;
    }

    const unsub = subscribeToUserLists(
      user,
      (fetchedLists) => {
        setLists(fetchedLists);
        setActiveListId((prevId) => {
          if (prevId && fetchedLists.some((l) => l.id === prevId)) return prevId;
          return fetchedLists.length > 0 ? fetchedLists[0].id : null;
        });
      },
      (err) => {
        setAuthError(`讀取清單失敗：${err.message}`);
      }
    );
    return () => unsub();
  }, [fbState.initialized, user, isDemoMode]);

  // 監聽目前選中清單的待辦事項
  useEffect(() => {
    if (isDemoMode) {
      setTodos(demoTodosMap[activeListId] || []);
      return;
    }
    if (!fbState.initialized || !user || !activeListId) {
      setTodos([]);
      return;
    }
    const unsub = subscribeToListTodos(
      activeListId,
      (items) => setTodos(items),
      (err) => setAuthError(`讀取待辦事項失敗：${err.message}`)
    );
    return () => unsub();
  }, [fbState.initialized, user, activeListId, isDemoMode, demoTodosMap]);

  const activeList = useMemo(
    () => lists.find((l) => l.id === activeListId) || null,
    [lists, activeListId]
  );

  const filteredTodos = useMemo(() => {
    const myEmail = (user?.email || "").toLowerCase();
    return todos.filter((item) => {
      if (filterMode === "active") return !item.completed;
      if (filterMode === "completed") return item.completed;
      if (filterMode === "mine") return item.assigneeEmail === myEmail;
      return true;
    });
  }, [todos, filterMode, user]);

  const handleGoogleLogin = async () => {
    setAuthError("");
    try {
      await loginWithGoogle();
    } catch (err) {
      let friendly = err.message || "Google 登入失敗";
      if (err.code === "auth/unauthorized-domain") {
        friendly =
          "網域尚未授權 (auth/unauthorized-domain)：請至 Firebase Console → Authentication → Settings → Authorized domains 新增 localhost。";
      } else if (err.code === "auth/operation-not-allowed") {
        friendly =
          "尚未啟用 Google 登入：請至 Firebase Console → Authentication → Sign-in method 啟用 Google 提供者。";
      }
      setAuthError(friendly);
    }
  };

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    if (isDemoMode) {
      const id = "demo-list-" + Date.now();
      const newList = {
        id,
        name: newListName.trim(),
        description: newListDesc.trim(),
        ownerId: user.uid,
        ownerEmail: user.email,
        memberIds: [user.uid],
        memberEmails: [user.email],
        inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase()
      };
      setLists((prev) => [...prev, newList]);
      setDemoTodosMap((prev) => ({ ...prev, [id]: [] }));
      setActiveListId(id);
      setNewListName("");
      setNewListDesc("");
      setShowNewListForm(false);
      return;
    }

    try {
      const id = await createCollaborativeList(user, {
        name: newListName,
        description: newListDesc
      });
      setActiveListId(id);
      setNewListName("");
      setNewListDesc("");
      setShowNewListForm(false);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleDeleteList = async (listId) => {
    if (!window.confirm("確定要刪除此待辦清單嗎？")) return;
    if (isDemoMode) {
      setLists((prev) => prev.filter((l) => l.id !== listId));
      return;
    }
    try {
      await deleteCollaborativeList(listId);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleJoinByCode = async (e) => {
    e.preventDefault();
    if (!inviteCodeInput.trim()) return;
    if (isDemoMode) {
      setBannerNotice("展示模式下已模擬加入清單！連線真實 Firebase 後即可跨帳號即時同步。");
      setInviteCodeInput("");
      return;
    }
    try {
      const joined = await joinListByInviteCode(user, inviteCodeInput);
      setActiveListId(joined.id);
      setInviteCodeInput("");
      setBannerNotice(`已成功加入協作清單「${joined.name}」！`);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleAddTodo = async (e) => {
    e.preventDefault();
    if (!todoText.trim() || !activeListId) return;

    if (isDemoMode) {
      const newItem = {
        id: "t-" + Date.now(),
        text: todoText.trim(),
        completed: false,
        priority: todoPriority,
        dueDate: todoDueDate,
        assigneeEmail: todoAssignee,
        createdByName: user.displayName
      };
      setDemoTodosMap((prev) => ({
        ...prev,
        [activeListId]: [newItem, ...(prev[activeListId] || [])]
      }));
      setTodoText("");
      setTodoDueDate("");
      return;
    }

    try {
      await addTodoItem(activeListId, user, {
        text: todoText,
        priority: todoPriority,
        dueDate: todoDueDate,
        assigneeEmail: todoAssignee
      });
      setTodoText("");
      setTodoDueDate("");
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleToggleTodo = async (todo) => {
    if (isDemoMode) {
      setDemoTodosMap((prev) => ({
        ...prev,
        [activeListId]: (prev[activeListId] || []).map((t) =>
          t.id === todo.id ? { ...t, completed: !t.completed } : t
        )
      }));
      return;
    }
    await toggleTodoCompleted(activeListId, todo.id, todo.completed);
  };

  const handleSaveEditTodo = async (todoId) => {
    const clean = editingTodoText.trim();
    if (!clean) return;
    if (isDemoMode) {
      setDemoTodosMap((prev) => ({
        ...prev,
        [activeListId]: (prev[activeListId] || []).map((t) =>
          t.id === todoId ? { ...t, text: clean } : t
        )
      }));
      setEditingTodoId(null);
      return;
    }
    await updateTodoDetails(activeListId, todoId, { text: clean });
    setEditingTodoId(null);
  };

  const handleDeleteTodo = async (todoId) => {
    if (isDemoMode) {
      setDemoTodosMap((prev) => ({
        ...prev,
        [activeListId]: (prev[activeListId] || []).filter((t) => t.id !== todoId)
      }));
      return;
    }
    await deleteTodoItem(activeListId, todoId);
  };

  const handleInviteEmail = async (listId, email) => {
    if (isDemoMode) {
      setLists((prev) =>
        prev.map((l) =>
          l.id === listId
            ? {
                ...l,
                memberEmails: Array.from(
                  new Set([...(l.memberEmails || []), email.trim().toLowerCase()])
                )
              }
            : l
        )
      );
      return;
    }
    await inviteCollaboratorByEmail(listId, email);
  };

  const handleRemoveEmail = async (listId, email) => {
    if (isDemoMode) {
      setLists((prev) =>
        prev.map((l) =>
          l.id === listId
            ? {
                ...l,
                memberEmails: (l.memberEmails || []).filter((e) => e !== email)
              }
            : l
        )
      );
      return;
    }
    await removeCollaboratorEmail(listId, email);
  };

  const priorityBadge = (priority) => {
    if (priority === "high") {
      return html`<span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-rose-100 text-rose-700">高優先</span>`;
    }
    if (priority === "low") {
      return html`<span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-slate-100 text-slate-600">低優先</span>`;
    }
    return html`<span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-100 text-amber-800">中優先</span>`;
  };

  return html`
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <!-- 頂部導覽列 -->
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              ✓
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-lg tracking-tight text-slate-900">
                  MyToDoList
                </h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  FirebaseProject: My To-Do List
                </span>
                ${isDemoMode &&
                html`
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    本地展示模式
                  </span>
                `}
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Google 帳號登入 · 多人即時同步協作清單
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick=${() => setShowSetupModal(true)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-indigo-300 bg-slate-50 hover:bg-indigo-50/50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition"
            >
              <span>🔥</span>
              <span>Firebase 設定</span>
            </button>

            ${user &&
            html`
              <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
                ${user.photoURL
                  ? html`<img src=${user.photoURL} alt="" className="w-8 h-8 rounded-full border border-slate-200" />`
                  : html`
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center uppercase">
                        ${(user.displayName || user.email || "U")[0]}
                      </div>
                    `}
                <div className="hidden md:block text-left">
                  <div className="text-xs font-bold text-slate-800 leading-tight">
                    ${user.displayName || "使用者"}
                  </div>
                  <div className="text-[11px] text-slate-500 leading-tight">
                    ${user.email}
                  </div>
                </div>
                <button
                  onClick=${() => {
                    if (isDemoMode) {
                      setIsDemoMode(false);
                      setUser(null);
                    } else {
                      logoutUser();
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition"
                >
                  登出
                </button>
              </div>
            `}
          </div>
        </div>
      </header>

      <!-- 訊息提示橫幅 -->
      ${bannerNotice &&
      html`
        <div className="bg-indigo-600 text-white px-4 py-2 text-xs font-medium flex items-center justify-between max-w-7xl w-full mx-auto mt-2 rounded-xl">
          <span>✨ ${bannerNotice}</span>
          <button onClick=${() => setBannerNotice("")} className="underline ml-4">關閉</button>
        </div>
      `}
      ${authError &&
      html`
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 text-xs font-medium flex items-center justify-between max-w-7xl w-full mx-auto mt-3 rounded-xl">
          <span>⚠️ ${authError}</span>
          <button onClick=${() => setAuthError("")} className="text-rose-500 hover:text-rose-800 font-bold ml-4">✕</button>
        </div>
      `}

      <!-- 主要內容區 -->
      ${authLoading
        ? html`
            <div className="flex-1 flex items-center justify-center">
              <div className="text-sm text-slate-500 animate-pulse">正在連線至 Firebase...</div>
            </div>
          `
        : !user
        ? html`
            <!-- 未登入：Google 登入歡迎頁 -->
            <main className="flex-1 flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 max-w-md w-full p-8 text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-3xl font-bold mx-auto shadow-lg shadow-indigo-200">
                  ✓
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-extrabold text-slate-900">
                    歡迎使用 MyToDoList
                  </h2>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    專為團隊與好友打造的多人協作待辦清單。支援 Google 快速登入、邀請碼共享、任務指派與 Cloud Firestore 即時同步。
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <button
                    onClick=${handleGoogleLogin}
                    disabled=${!fbState.initialized}
                    className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 font-semibold text-sm border border-slate-300 shadow-sm flex items-center justify-center gap-3 transition disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                      />
                    </svg>
                    <span>使用 Google 帳號登入</span>
                  </button>

                  ${!fbState.initialized &&
                  html`
                    <button
                      onClick=${() => setShowSetupModal(true)}
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition"
                    >
                      🔥 設定 Firebase 專案 (My To-Do List)
                    </button>
                  `}

                  <button
                    onClick=${() => setIsDemoMode(true)}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition"
                  >
                    先進入「本地展示模式」體驗完整功能 →
                  </button>
                </div>
              </div>
            </main>
          `
        : html`
            <!-- 已登入：左側協作清單列 + 右側待辦事項面板 -->
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              <!-- 左欄：清單導覽與加入邀請碼 -->
              <aside className="lg:col-span-4 xl:col-span-3 space-y-5">
                <!-- 協作清單列表 -->
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      我的協作清單 (${lists.length})
                    </h2>
                    <button
                      onClick=${() => setShowNewListForm(!showNewListForm)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <span>＋ 建立清單</span>
                    </button>
                  </div>

                  ${showNewListForm &&
                  html`
                    <form
                      onSubmit=${handleCreateList}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5"
                    >
                      <input
                        type="text"
                        required
                        value=${newListName}
                        onChange=${(e) => setNewListName(e.target.value)}
                        placeholder="清單名稱（例如：專案開發）"
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-indigo-500"
                      />
                      <input
                        type="text"
                        value=${newListDesc}
                        onChange=${(e) => setNewListDesc(e.target.value)}
                        placeholder="簡短說明（選填）"
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-indigo-500"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick=${() => setShowNewListForm(false)}
                          className="px-2.5 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-200"
                        >
                          取消
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                          建立
                        </button>
                      </div>
                    </form>
                  `}

                  ${lists.length === 0
                    ? html`
                        <div className="text-center py-6 text-xs text-slate-400">
                          目前還沒有任何清單，點擊右上角「＋ 建立清單」或輸入邀請碼加入！
                        </div>
                      `
                    : html`
                        <div className="space-y-1.5">
                          ${lists.map((list) => {
                            const isSelected = list.id === activeListId;
                            const memberCount = Math.max(
                              list.memberEmails?.length || 1,
                              list.memberIds?.length || 1
                            );
                            return html`
                              <div
                                key=${list.id}
                                onClick=${() => setActiveListId(list.id)}
                                className=${`group cursor-pointer rounded-xl px-3.5 py-2.5 transition flex items-center justify-between ${
                                  isSelected
                                    ? "bg-indigo-600 text-white shadow-sm"
                                    : "hover:bg-slate-100 text-slate-700"
                                }`}
                              >
                                <div className="truncate pr-2">
                                  <div className="font-semibold text-sm truncate">
                                    ${list.name}
                                  </div>
                                  <div
                                    className=${`text-[11px] flex items-center gap-2 mt-0.5 ${
                                      isSelected ? "text-indigo-100" : "text-slate-400"
                                    }`}
                                  >
                                    <span>👥 ${memberCount} 位成員</span>
                                    <span>·</span>
                                    <span className="font-mono">邀請碼 ${list.inviteCode}</span>
                                  </div>
                                </div>
                                ${list.ownerId === user.uid &&
                                html`
                                  <button
                                    type="button"
                                    title="刪除清單"
                                    onClick=${(e) => {
                                      e.stopPropagation();
                                      handleDeleteList(list.id);
                                    }}
                                    className=${`opacity-0 group-hover:opacity-100 text-xs px-1.5 py-0.5 rounded ${
                                      isSelected
                                        ? "hover:bg-indigo-500 text-indigo-100"
                                        : "hover:bg-rose-100 text-rose-500"
                                    }`}
                                  >
                                    刪除
                                  </button>
                                `}
                              </div>
                            `;
                          })}
                        </div>
                      `}
                </div>

                <!-- 輸入邀請碼加入別人的清單 -->
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    透過邀請碼加入清單
                  </h3>
                  <form onSubmit=${handleJoinByCode} className="flex gap-2">
                    <input
                      type="text"
                      value=${inviteCodeInput}
                      onChange=${(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                      placeholder="輸入 6 碼邀請碼"
                      className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono uppercase tracking-wider focus:border-indigo-500 outline-none"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shrink-0"
                    >
                      加入
                    </button>
                  </form>
                </div>
              </aside>

              <!-- 右欄：選中清單的待辦事項與協作面板 -->
              <section className="lg:col-span-8 xl:col-span-9">
                ${!activeList
                  ? html`
                      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
                        <div className="text-4xl">📋</div>
                        <h3 className="text-base font-bold text-slate-800">
                          請先選擇或建立一個協作待辦清單
                        </h3>
                        <p className="text-xs text-slate-500">
                          建立清單後，您可以透過 Email 或邀請碼邀請朋友共同編輯。
                        </p>
                      </div>
                    `
                  : html`
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <!-- 清單標題與協作者資訊列 -->
                        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2.5">
                              <h2 className="text-xl font-extrabold text-slate-900">
                                ${activeList.name}
                              </h2>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                                即時同步中
                              </span>
                            </div>
                            ${activeList.description &&
                            html`
                              <p className="text-xs text-slate-500 mt-1">
                                ${activeList.description}
                              </p>
                            `}
                          </div>

                          <div className="flex items-center gap-2">
                            <!-- 成員頭像縮圖 -->
                            <div className="flex -space-x-2 overflow-hidden mr-1">
                              ${(activeList.memberEmails || [user.email])
                                .slice(0, 5)
                                .map(
                                  (email) => html`
                                    <div
                                      key=${email}
                                      title=${email}
                                      className="inline-flex h-7 w-7 rounded-full ring-2 ring-white bg-indigo-100 text-indigo-700 text-xs font-bold items-center justify-center uppercase"
                                    >
                                      ${email[0] || "U"}
                                    </div>
                                  `
                                )}
                            </div>
                            <button
                              type="button"
                              onClick=${() => setShowCollabModal(true)}
                              className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center gap-1.5 transition"
                            >
                              <span>👥</span>
                              <span>協作成員與邀請碼 (${activeList.inviteCode})</span>
                            </button>
                          </div>
                        </div>

                        <!-- 新增待辦事項表單 -->
                        <form
                          onSubmit=${handleAddTodo}
                          className="p-4 sm:p-6 bg-slate-50/70 border-b border-slate-100 space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row gap-2.5">
                            <input
                              type="text"
                              required
                              value=${todoText}
                              onChange=${(e) => setTodoText(e.target.value)}
                              placeholder="輸入新的待辦事項，按 Enter 或點擊新增..."
                              className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                            />
                            <button
                              type="submit"
                              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition shrink-0"
                            >
                              ＋ 新增事項
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <label className="flex items-center gap-1.5 text-slate-600">
                              <span className="font-medium">優先順序：</span>
                              <select
                                value=${todoPriority}
                                onChange=${(e) => setTodoPriority(e.target.value)}
                                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs outline-none"
                              >
                                <option value="high">🔴 高優先</option>
                                <option value="medium">🟡 中優先</option>
                                <option value="low">⚪ 低優先</option>
                              </select>
                            </label>

                            <label className="flex items-center gap-1.5 text-slate-600">
                              <span className="font-medium">指派給：</span>
                              <select
                                value=${todoAssignee}
                                onChange=${(e) => setTodoAssignee(e.target.value)}
                                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs outline-none"
                              >
                                <option value="">未指派 (所有人)</option>
                                ${(activeList.memberEmails || [user.email]).map(
                                  (email) => html`
                                    <option key=${email} value=${email}>
                                      ${email}
                                    </option>
                                  `
                                )}
                              </select>
                            </label>

                            <label className="flex items-center gap-1.5 text-slate-600">
                              <span className="font-medium">到期日：</span>
                              <input
                                type="date"
                                value=${todoDueDate}
                                onChange=${(e) => setTodoDueDate(e.target.value)}
                                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs outline-none"
                              />
                            </label>
                          </div>
                        </form>

                        <!-- 篩選列 -->
                        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            ${[
                              { id: "all", label: `全部 (${todos.length})` },
                              {
                                id: "active",
                                label: `進行中 (${todos.filter((t) => !t.completed).length})`
                              },
                              {
                                id: "completed",
                                label: `已完成 (${todos.filter((t) => t.completed).length})`
                              },
                              { id: "mine", label: "指派給我" }
                            ].map(
                              (tab) => html`
                                <button
                                  key=${tab.id}
                                  type="button"
                                  onClick=${() => setFilterMode(tab.id)}
                                  className=${`px-3 py-1.5 rounded-lg font-semibold transition ${
                                    filterMode === tab.id
                                      ? "bg-slate-900 text-white"
                                      : "text-slate-600 hover:bg-slate-100"
                                  }`}
                                >
                                  ${tab.label}
                                </button>
                              `
                            )}
                          </div>
                        </div>

                        <!-- 待辦事項列表 -->
                        <div className="divide-y divide-slate-100">
                          ${filteredTodos.length === 0
                            ? html`
                                <div className="p-10 text-center text-xs text-slate-400">
                                  沒有符合條件的待辦事項。在上方新增第一筆任務吧！
                                </div>
                              `
                            : filteredTodos.map(
                                (todo) => html`
                                  <div
                                    key=${todo.id}
                                    className=${`p-4 sm:px-6 flex items-start justify-between gap-3 transition ${
                                      todo.completed ? "bg-slate-50/60" : "hover:bg-slate-50/40"
                                    }`}
                                  >
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                      <input
                                        type="checkbox"
                                        checked=${Boolean(todo.completed)}
                                        onChange=${() => handleToggleTodo(todo)}
                                        className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                      />
                                      <div className="flex-1 min-w-0">
                                        ${editingTodoId === todo.id
                                          ? html`
                                              <div className="flex gap-2">
                                                <input
                                                  type="text"
                                                  value=${editingTodoText}
                                                  onChange=${(e) =>
                                                    setEditingTodoText(e.target.value)}
                                                  className="flex-1 rounded-lg border border-indigo-300 px-2.5 py-1 text-sm outline-none"
                                                />
                                                <button
                                                  type="button"
                                                  onClick=${() => handleSaveEditTodo(todo.id)}
                                                  className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold"
                                                >
                                                  儲存
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick=${() => setEditingTodoId(null)}
                                                  className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs"
                                                >
                                                  取消
                                                </button>
                                              </div>
                                            `
                                          : html`
                                              <div
                                                className=${`text-sm font-medium break-words ${
                                                  todo.completed
                                                    ? "line-through text-slate-400"
                                                    : "text-slate-800"
                                                }`}
                                              >
                                                ${todo.text}
                                              </div>
                                            `}

                                        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                                          ${priorityBadge(todo.priority)}
                                          ${todo.assigneeEmail &&
                                          html`
                                            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                                              👤 指派：${todo.assigneeEmail}
                                            </span>
                                          `}
                                          ${todo.dueDate &&
                                          html`
                                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                              📅 到期：${todo.dueDate}
                                            </span>
                                          `}
                                          ${todo.createdByName &&
                                          html`<span>建立者：${todo.createdByName}</span>`}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick=${() => {
                                          setEditingTodoId(todo.id);
                                          setEditingTodoText(todo.text);
                                        }}
                                        className="px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                                      >
                                        編輯
                                      </button>
                                      <button
                                        type="button"
                                        onClick=${() => handleDeleteTodo(todo.id)}
                                        className="px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                      >
                                        刪除
                                      </button>
                                    </div>
                                  </div>
                                `
                              )}
                        </div>
                      </div>
                    `}
              </section>
            </main>
          `}

      <!-- Firebase 設定彈窗 -->
      <${FirebaseSetupModal}
        isOpen=${showSetupModal}
        onClose=${() => setShowSetupModal(false)}
        currentConfig=${fbState.config}
        onConfigSaved=${() => {
          setIsDemoMode(false);
          setFbState(initFirebase());
          setShowSetupModal(false);
        }}
        onEnterDemo=${() => {
          setIsDemoMode(true);
          setShowSetupModal(false);
        }}
      />

      <!-- 協作成員管理彈窗 -->
      <${CollaboratorsModal}
        isOpen=${showCollabModal}
        onClose=${() => setShowCollabModal(false)}
        activeList=${activeList}
        currentUser=${user}
        onInviteEmail=${handleInviteEmail}
        onRemoveEmail=${handleRemoveEmail}
      />
    </div>
  `;
}
