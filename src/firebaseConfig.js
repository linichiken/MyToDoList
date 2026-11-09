// 請將您的 Firebase 專案 "My To-Do List" 的 Web SDK 設定貼在下方，
// 或者啟動網頁後直接在畫面上的「Firebase 專案設定」視窗貼上即可！

export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "my-to-do-list-1a157.firebaseapp.com",
  projectId: "my-to-do-list-1a157",
  storageBucket: "my-to-do-list-1a157.firebasestorage.app",
  messagingSenderId: "703850153265",
  appId: "1:703850153265:web:eec3948f4052ed2611dc10"
};

const STORAGE_KEY = "mytodolist_firebase_config_v1";

export function isConfigValid(config) {
  return Boolean(
    config &&
      typeof config.apiKey === "string" &&
      config.apiKey.trim() !== "" &&
      config.apiKey !== "YOUR_API_KEY" &&
      typeof config.projectId === "string" &&
      config.projectId.trim() !== ""
  );
}

export function getActiveFirebaseConfig() {
  if (isConfigValid(DEFAULT_FIREBASE_CONFIG)) {
    return DEFAULT_FIREBASE_CONFIG;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (isConfigValid(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("無法讀取 localStorage 中的 Firebase 設定:", e);
  }
  return DEFAULT_FIREBASE_CONFIG;
}

export function saveFirebaseConfigToStorage(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearSavedFirebaseConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 支援直接貼上 Firebase Console 複製出來的整段程式碼或 JSON
 * 例如：const firebaseConfig = { apiKey: "...", projectId: "..." };
 */
export function parseFirebaseConfigInput(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("請輸入 Firebase 設定內容");
  }
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("找不到大括號 { ... } 格式的設定物件");
  }
  const objText = match[0];
  try {
    return JSON.parse(objText);
  } catch (_) {
    // 處理 JS Object literal (無引號 key、單引號、尾隨逗號)
    const keys = [
      "apiKey",
      "authDomain",
      "projectId",
      "storageBucket",
      "messagingSenderId",
      "appId",
      "measurementId"
    ];
    const result = {};
    for (const key of keys) {
      const regex = new RegExp(`["']?${key}["']?\\s*:\\s*["']([^"']+)["']`);
      const m = objText.match(regex);
      if (m && m[1]) {
        result[key] = m[1].trim();
      }
    }
    if (!isConfigValid(result)) {
      throw new Error("無法解析 apiKey 或 projectId，請確認貼上的設定包含這兩個欄位。");
    }
    return result;
  }
}
