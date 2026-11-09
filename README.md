# MyToDoList — 多人協作待辦清單 (Firebase)

支援 **Google 帳號登入** 與 **Cloud Firestore 多人即時同步協作** 的網頁應用程式，預設對應您的現有 Firebase 專案 **"My To-Do List"**。

## 功能特色

1. **Google 帳號登入 (`Firebase Authentication`)**：
   - 使用 `GoogleAuthProvider` 快速登入並自動同步使用者個人檔案。
2. **多清單與多人即時協作 (`Cloud Firestore`)**：
   - 可建立多個待辦清單（Lists），每個清單會自動產生專屬 **6 碼邀請碼** 與 **分享連結 (`?invite=CODE`)**。
   - 支援直接輸入協作者的 **Google Email** 邀請加入，或讓對方輸入邀請碼加入。
   - 清單成員可即時新增、編輯、勾選完成、設定優先順序（高/中/低）、到期日與指派負責人。
3. **內建設定精靈與本地展示模式**：
   - 啟動網頁後可直接點擊右上角 **「🔥 Firebase 設定」** 貼上 `firebaseConfig` 立即連線，或直接編輯 `src/firebaseConfig.js`。
   - 尚未貼上設定前，可點擊 **「本地展示模式」** 直接預覽與操作完整的多人協作介面。

## 啟動方式

在專案資料夾 `/Users/james/Documents/MyToDoList` 下執行內建本地伺服器（免安裝額外套件即可直接於瀏覽器執行）：

```bash
python3 -m http.server 5173
```

接著在瀏覽器開啟 `http://localhost:5173` 即可使用。

## Firebase Console 設定步驟（專案：`My To-Do List`）

1. **複製 Web SDK 設定**：
   - 前往 Firebase Console 開啟 **My To-Do List** 專案 → **Project settings (專案設定)** → 下方 **Your apps** 複製 `firebaseConfig`。
   - 貼入網頁上的 **「🔥 Firebase 設定」** 視窗，或貼入 [`src/firebaseConfig.js`](./src/firebaseConfig.js)。
2. **啟用 Google 登入**：
   - 前往 **Authentication** → **Sign-in method** → 啟用 **Google**。
   - 確認 **Settings** → **Authorized domains** 中包含 `localhost`。
3. **設定 Cloud Firestore 安全規則**：
   - 前往 **Firestore Database** → **Rules**，將專案根目錄 [`firestore.rules`](./firestore.rules) 的內容貼上並發佈（Publish）。
