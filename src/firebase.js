import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from "firebase/firestore";
import { getActiveFirebaseConfig, isConfigValid } from "./firebaseConfig.js";

let app = null;
let auth = null;
let db = null;
let googleProvider = null;

export function initFirebase() {
  const config = getActiveFirebaseConfig();
  if (!isConfigValid(config)) {
    return { initialized: false, app: null, auth: null, db: null, config };
  }
  try {
    app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: "select_account" });
    return { initialized: true, app, auth, db, config };
  } catch (error) {
    console.error("Firebase 初始化失敗:", error);
    return { initialized: false, app: null, auth: null, db: null, config, error };
  }
}

export async function loginWithGoogle() {
  if (!auth || !googleProvider) {
    throw new Error("Firebase 尚未完成設定");
  }
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  await syncUserProfile(user);
  return user;
}

export async function logoutUser() {
  if (!auth) return;
  await signOut(auth);
}

export function subscribeToAuth(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        await syncUserProfile(user);
      } catch (e) {
        console.warn("同步使用者資料略過:", e);
      }
    }
    callback(user);
  });
}

export async function syncUserProfile(user) {
  if (!db || !user) return;
  const userRef = doc(db, "users", user.uid);
  await setDoc(
    userRef,
    {
      uid: user.uid,
      email: (user.email || "").toLowerCase(),
      displayName: user.displayName || user.email?.split("@")[0] || "使用者",
      photoURL: user.photoURL || null,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * 監聽使用者參與或受邀的所有協作清單
 * 同時支援 memberIds 包含 uid 或 memberEmails 包含 email
 */
export function subscribeToUserLists(user, onUpdate, onError) {
  if (!db || !user) return () => {};
  const listsRef = collection(db, "lists");
  const userEmail = (user.email || "").toLowerCase();

  let byUidMap = new Map();
  let byEmailMap = new Map();

  const emitMerged = () => {
    const mergedMap = new Map([...byEmailMap, ...byUidMap]);
    const listArray = Array.from(mergedMap.values()).sort((a, b) => {
      const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tA - tB;
    });
    onUpdate(listArray);
  };

  const qUid = query(listsRef, where("memberIds", "array-contains", user.uid));
  const unsubUid = onSnapshot(
    qUid,
    (snap) => {
      byUidMap.clear();
      snap.forEach((docSnap) => {
        byUidMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
      });
      emitMerged();
    },
    (err) => {
      console.error("讀取清單 (UID) 發生錯誤:", err);
      if (onError) onError(err);
    }
  );

  let unsubEmail = () => {};
  if (userEmail) {
    const qEmail = query(listsRef, where("memberEmails", "array-contains", userEmail));
    unsubEmail = onSnapshot(
      qEmail,
      (snap) => {
        byEmailMap.clear();
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          byEmailMap.set(docSnap.id, { id: docSnap.id, ...data });
          // 若使用者是透過 Email 被邀請，登入後自動將其 UID 加入 memberIds
          if (Array.isArray(data.memberIds) && !data.memberIds.includes(user.uid)) {
            updateDoc(doc(db, "lists", docSnap.id), {
              memberIds: arrayUnion(user.uid),
              updatedAt: serverTimestamp()
            }).catch(() => {});
          }
        });
        emitMerged();
      },
      (err) => {
        console.warn("讀取受邀清單 (Email) 發生錯誤:", err);
      }
    );
  }

  return () => {
    unsubUid();
    unsubEmail();
  };
}

export async function createCollaborativeList(user, { name, description = "" }) {
  if (!db || !user) throw new Error("請先登入");
  const cleanName = name.trim();
  if (!cleanName) throw new Error("清單名稱不能為空");

  const email = (user.email || "").toLowerCase();
  const payload = {
    name: cleanName,
    description: description.trim(),
    ownerId: user.uid,
    ownerEmail: email,
    memberIds: [user.uid],
    memberEmails: email ? [email] : [],
    inviteCode: generateInviteCode(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, "lists"), payload);
  return docRef.id;
}

export async function deleteCollaborativeList(listId) {
  if (!db) return;
  await deleteDoc(doc(db, "lists", listId));
}

export async function inviteCollaboratorByEmail(listId, emailInput) {
  if (!db) throw new Error("資料庫未連線");
  const cleanEmail = emailInput.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("請輸入有效的 Email 地址");
  }
  const listRef = doc(db, "lists", listId);
  await updateDoc(listRef, {
    memberEmails: arrayUnion(cleanEmail),
    updatedAt: serverTimestamp()
  });
}

export async function removeCollaboratorEmail(listId, emailToRemove) {
  if (!db) return;
  const listRef = doc(db, "lists", listId);
  await updateDoc(listRef, {
    memberEmails: arrayRemove(emailToRemove),
    updatedAt: serverTimestamp()
  });
}

export async function joinListByInviteCode(user, codeInput) {
  if (!db || !user) throw new Error("請先登入");
  const cleanCode = codeInput.trim().toUpperCase();
  if (!cleanCode) throw new Error("請輸入邀請碼");

  const listsRef = collection(db, "lists");
  const q = query(listsRef, where("inviteCode", "==", cleanCode));
  const snap = await getDocs(q);

  if (snap.empty) {
    throw new Error(`找不到邀請碼為「${cleanCode}」的待辦清單`);
  }

  const targetDoc = snap.docs[0];
  const userEmail = (user.email || "").toLowerCase();
  const updates = {
    memberIds: arrayUnion(user.uid),
    updatedAt: serverTimestamp()
  };
  if (userEmail) {
    updates.memberEmails = arrayUnion(userEmail);
  }

  await updateDoc(doc(db, "lists", targetDoc.id), updates);
  return { id: targetDoc.id, ...targetDoc.data() };
}

export function subscribeToListTodos(listId, onUpdate, onError) {
  if (!db || !listId) return () => {};
  const todosRef = collection(db, "lists", listId, "todos");

  return onSnapshot(
    todosRef,
    (snap) => {
      const items = [];
      snap.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() });
      });
      items.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const pOrder = { high: 0, medium: 1, low: 2 };
        const pA = pOrder[a.priority] ?? 1;
        const pB = pOrder[b.priority] ?? 1;
        if (pA !== pB) return pA - pB;
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tB - tA;
      });
      onUpdate(items);
    },
    (err) => {
      console.error("讀取待辦事項錯誤:", err);
      if (onError) onError(err);
    }
  );
}

export async function addTodoItem(listId, user, { text, priority = "medium", dueDate = "", assigneeEmail = "" }) {
  if (!db || !user || !listId) throw new Error("缺少必要參數");
  const cleanText = text.trim();
  if (!cleanText) throw new Error("待辦事項內容不能為空");

  const todosRef = collection(db, "lists", listId, "todos");
  await addDoc(todosRef, {
    text: cleanText,
    completed: false,
    priority,
    dueDate: dueDate || "",
    assigneeEmail: assigneeEmail ? assigneeEmail.trim().toLowerCase() : "",
    assigneeName: assigneeEmail ? assigneeEmail.split("@")[0] : "",
    createdBy: user.uid,
    createdByName: user.displayName || user.email?.split("@")[0] || "成員",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function toggleTodoCompleted(listId, todoId, currentCompleted) {
  if (!db || !listId || !todoId) return;
  const todoRef = doc(db, "lists", listId, "todos", todoId);
  await updateDoc(todoRef, {
    completed: !currentCompleted,
    updatedAt: serverTimestamp()
  });
}

export async function updateTodoDetails(listId, todoId, updates) {
  if (!db || !listId || !todoId) return;
  const todoRef = doc(db, "lists", listId, "todos", todoId);
  await updateDoc(todoRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

export async function deleteTodoItem(listId, todoId) {
  if (!db || !listId || !todoId) return;
  const todoRef = doc(db, "lists", listId, "todos", todoId);
  await deleteDoc(todoRef);
}
