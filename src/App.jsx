import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy
} from "firebase/firestore";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

const CATEGORIES = ["all", "meals", "snacks", "drinks", "desserts"];

export default function App() {
  const [view, setView] = useState("student");
  const [ownerTab, setOwnerTab] = useState("orders");
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [user, setUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", price: "", cat: "meals", emoji: "" });
  const [toast, setToast] = useState("");

  // Listen to menu items from Firebase
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "menu"), (snap) => {
      setMenuItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Listen to orders from Firebase
  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  // CART FUNCTIONS
  function addToCart(item) {
    if (!item.available) return;
    setCart((prev) => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
  }

  function changeQty(id, delta) {
    setCart((prev) => {
      const next = { ...prev, [id]: (prev[id] || 0) + delta };
      if (next[id] <= 0) delete next[id];
      return next;
    });
  }

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(cart).reduce((total, [id, qty]) => {
    const item = menuItems.find((i) => i.id === id);
    return total + (item ? item.price * qty : 0);
  }, 0);

  async function placeOrder() {
    if (cartCount === 0) return;
    const items = Object.entries(cart).map(([id, qty]) => {
      const item = menuItems.find((i) => i.id === id);
      return { name: item.name, qty, price: item.price * qty };
    });
    await addDoc(collection(db, "orders"), {
      items,
      total: cartTotal,
      status: "pending",
      createdAt: serverTimestamp(),
    });
    setCart({});
    setCartOpen(false);
    showToast("Order placed successfully!");
  }

  // OWNER FUNCTIONS
  async function cycleStatus(order) {
    const statuses = ["pending", "preparing", "ready"];
    const next = statuses[(statuses.indexOf(order.status) + 1) % statuses.length];
    await updateDoc(doc(db, "orders", order.id), { status: next });
  }

  async function toggleAvail(item) {
    await updateDoc(doc(db, "menu", item.id), { available: !item.available });
  }

  async function removeMenuItem(id) {
    await deleteDoc(doc(db, "menu", id));
    showToast("Item removed!");
  }

  async function saveNewItem() {
    if (!newItem.name || !newItem.price) return;
    await addDoc(collection(db, "menu"), {
      name: newItem.name,
      price: parseInt(newItem.price),
      cat: newItem.cat,
      emoji: newItem.emoji || "🍽️",
      rating: 4.0,
      available: true,
    });
    setNewItem({ name: "", price: "", cat: "meals", emoji: "" });
    setShowAddModal(false);
    showToast("Item added to menu!");
  }

  async function handleLogin(e) {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      setLoginError("");
    } catch {
      setLoginError("Invalid email or password.");
    }
  }

  const filtered = filter === "all" ? menuItems : menuItems.filter((i) => i.cat === filter);

  const catColor = (cat) =>
    ({ meals: "#FAEEDA", snacks: "#EAF3DE", drinks: "#E6F1FB", desserts: "#FBEAF0" }[cat] || "#F1EFE8");

  const statusColor = (s) =>
    ({ pending: { bg: "#FAEEDA", color: "#854F0B" }, preparing: { bg: "#E6F1FB", color: "#185FA5" }, ready: { bg: "#EAF3DE", color: "#3B6D11" } }[s] || {});

  return (
    <div style={{ fontFamily: "Segoe UI, sans-serif", minHeight: "100vh", background: "#F5F4F0" }}>

      {/* NAV */}
      <nav style={{ background: "white", borderBottom: "1px solid #E5E5E0", padding: "0 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: "#D85A30", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🍽️</div>
          <span style={{ fontWeight: 600, fontSize: 16 }}><span style={{ color: "#D85A30" }}>Campus</span>Canteen</span>
        </div>
        <div style={{ display: "flex", background: "#F5F4F0", border: "1px solid #E5E5E0", borderRadius: 8, overflow: "hidden" }}>
          {["student", "owner"].map((v) => (
            <button key={v} onClick={() => setView(v)} style={{ padding: "6px 16px", border: "none", background: view === v ? "white" : "transparent", fontWeight: view === v ? 600 : 400, cursor: "pointer", fontSize: 13, color: view === v ? "#1A1A1A" : "#666" }}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        {view === "student" && (
          <button onClick={() => setCartOpen(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "#D85A30", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            🛒 Cart <span style={{ background: "white", color: "#D85A30", borderRadius: "50%", width: 18, height: 18, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{cartCount}</span>
          </button>
        )}
        {view === "owner" && user && (
          <button onClick={() => signOut(auth)} style={{ padding: "6px 14px", background: "transparent", border: "1px solid #E5E5E0", borderRadius: 8, fontSize: 13, cursor: "pointer", color: "#666" }}>Logout</button>
        )}
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem" }}>

        {/* STUDENT VIEW */}
        {view === "student" && (
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1.25rem" }}>
              {CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => setFilter(cat)} style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: filter === cat ? 600 : 400, cursor: "pointer", border: "1px solid", borderColor: filter === cat ? "#D85A30" : "#E5E5E0", background: filter === cat ? "#D85A30" : "white", color: filter === cat ? "white" : "#666" }}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
              {filtered.map((item) => {
                const qty = cart[item.id] || 0;
                return (
                  <div key={item.id} style={{ background: "white", border: "1px solid #E5E5E0", borderRadius: 12, overflow: "hidden", opacity: item.available ? 1 : 0.5, transition: "transform 0.15s" }}>
                    <div style={{ height: 100, background: catColor(item.cat), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, position: "relative" }}>
                      {item.emoji}
                      <span style={{ position: "absolute", top: 8, right: 8, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: item.available ? "#EAF3DE" : "#FCEBEB", color: item.available ? "#3B6D11" : "#A32D2D" }}>
                        {item.available ? "Available" : "Sold Out"}
                      </span>
                    </div>
                    <div style={{ padding: 12 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 8, textTransform: "capitalize" }}>{item.cat}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, color: "#D85A30", fontSize: 15 }}>₹{item.price}</span>
                        <span style={{ fontSize: 12, color: "#888" }}>⭐ {item.rating}</span>
                      </div>
                      {item.available && (
                        qty === 0
                          ? <button onClick={() => addToCart(item)} style={{ width: "100%", marginTop: 10, padding: 7, background: "transparent", border: "1px solid #D85A30", color: "#D85A30", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add to Order</button>
                          : <div style={{ display: "flex", marginTop: 10, border: "1px solid #D85A30", borderRadius: 8, overflow: "hidden" }}>
                              <button onClick={() => changeQty(item.id, -1)} style={{ flex: 1, padding: 7, border: "none", background: "transparent", color: "#D85A30", fontSize: 18, cursor: "pointer", fontWeight: 700 }}>−</button>
                              <span style={{ flex: 1, textAlign: "center", padding: 7, fontWeight: 600 }}>{qty}</span>
                              <button onClick={() => changeQty(item.id, 1)} style={{ flex: 1, padding: 7, border: "none", background: "transparent", color: "#D85A30", fontSize: 18, cursor: "pointer", fontWeight: 700 }}>+</button>
                            </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* OWNER VIEW */}
        {view === "owner" && (
          !user ? (
            <div style={{ maxWidth: 360, margin: "4rem auto", background: "white", borderRadius: 16, padding: "2rem", border: "1px solid #E5E5E0" }}>
              <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                <div style={{ fontSize: 40 }}>🔐</div>
                <h2 style={{ fontWeight: 700, marginTop: 8 }}>Owner Login</h2>
                <p style={{ color: "#888", fontSize: 13 }}>Only canteen staff can access this</p>
              </div>
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Email</label>
                  <input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} type="email" placeholder="owner@canteen.com" style={{ width: "100%", padding: "8px 10px", border: "1px solid #E5E5E0", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Password</label>
                  <input value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} type="password" placeholder="••••••••" style={{ width: "100%", padding: "8px 10px", border: "1px solid #E5E5E0", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
                </div>
                {loginError && <p style={{ color: "#E24B4A", fontSize: 13, marginBottom: 8 }}>{loginError}</p>}
                <button type="submit" style={{ width: "100%", padding: 12, background: "#D85A30", color: "white", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Login</button>
              </form>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #E5E5E0", marginBottom: "1.5rem" }}>
                {["orders", "manage"].map((tab) => (
                  <button key={tab} onClick={() => setOwnerTab(tab)} style={{ padding: "10px 20px", border: "none", background: "transparent", fontSize: 14, fontWeight: ownerTab === tab ? 600 : 400, color: ownerTab === tab ? "#D85A30" : "#888", borderBottom: ownerTab === tab ? "2px solid #D85A30" : "2px solid transparent", cursor: "pointer" }}>
                    {tab === "orders" ? "Live Orders" : "Manage Menu"}
                  </button>
                ))}
              </div>

              {/* ORDERS TAB */}
              {ownerTab === "orders" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                  {orders.length === 0
                    ? <p style={{ color: "#888", textAlign: "center", padding: "3rem", gridColumn: "1/-1" }}>No orders yet. Waiting for students... 👀</p>
                    : orders.map((order) => (
                      <div key={order.id} style={{ background: "white", border: "1px solid #E5E5E0", borderRadius: 12, padding: "1rem 1.25rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>Order #{order.id.slice(-4).toUpperCase()}</div>
                            <div style={{ fontSize: 11, color: "#888" }}>{order.createdAt?.toDate?.().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) || "Just now"}</div>
                          </div>
                          <span onClick={() => cycleStatus(order)} style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, cursor: "pointer", ...statusColor(order.status) }}>
                            {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)} ▾
                          </span>
                        </div>
                        {order.items?.map((it, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#666", padding: "2px 0" }}>
                            <span>{it.name} × {it.qty}</span>
                            <span style={{ fontWeight: 600, color: "#1A1A1A" }}>₹{it.price}</span>
                          </div>
                        ))}
                        <hr style={{ border: "none", borderTop: "1px solid #E5E5E0", margin: "8px 0" }} />
                        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}>
                          <span>Total</span><span>₹{order.total}</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* MANAGE TAB */}
              {ownerTab === "manage" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
                    <button onClick={() => setShowAddModal(true)} style={{ padding: "8px 16px", background: "#D85A30", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Add Item</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                    {menuItems.map((item) => (
                      <div key={item.id} style={{ background: "white", border: "1px solid #E5E5E0", borderRadius: 12, padding: "1rem 1.25rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                          <span style={{ fontSize: 28 }}>{item.emoji}</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                            <div style={{ fontSize: 12, color: "#888" }}>₹{item.price} · {item.cat}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, fontSize: 12, color: "#666", cursor: "pointer" }}>
                            <div onClick={() => toggleAvail(item)} style={{ width: 36, height: 20, borderRadius: 20, background: item.available ? "#1D9E75" : "#ccc", position: "relative", cursor: "pointer", transition: ".2s" }}>
                              <div style={{ position: "absolute", width: 14, height: 14, background: "white", borderRadius: "50%", top: 3, left: item.available ? 19 : 3, transition: ".2s" }} />
                            </div>
                            {item.available ? "Available" : "Unavailable"}
                          </label>
                          <button onClick={() => removeMenuItem(item.id)} style={{ padding: "5px 10px", background: "transparent", border: "1px solid #E24B4A", color: "#E24B4A", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* CART PANEL */}
      {cartOpen && <div onClick={() => setCartOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 200 }} />}
      <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 340, background: "white", borderLeft: "1px solid #E5E5E0", zIndex: 201, display: "flex", flexDirection: "column", transform: cartOpen ? "translateX(0)" : "translateX(100%)", transition: "transform 0.25s" }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #E5E5E0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontWeight: 700, fontSize: 16 }}>Your Order</h2>
          <button onClick={() => setCartOpen(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#888" }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem" }}>
          {cartCount === 0
            ? <p style={{ color: "#888", fontSize: 14, textAlign: "center", paddingTop: "2rem" }}>Your cart is empty</p>
            : Object.entries(cart).map(([id, qty]) => {
                const item = menuItems.find((i) => i.id === id);
                if (!item) return null;
                return (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #F0F0EC" }}>
                    <span style={{ fontSize: 24 }}>{item.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: "#888" }}>₹{item.price} × {qty} = ₹{item.price * qty}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <button onClick={() => changeQty(id, -1)} style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #E5E5E0", background: "#F5F4F0", cursor: "pointer" }}>−</button>
                      <span style={{ fontSize: 13, fontWeight: 600, minWidth: 16, textAlign: "center" }}>{qty}</span>
                      <button onClick={() => changeQty(id, 1)} style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #E5E5E0", background: "#F5F4F0", cursor: "pointer" }}>+</button>
                    </div>
                  </div>
                );
              })}
        </div>
        {cartCount > 0 && (
          <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid #E5E5E0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
              <span>Total</span><span>₹{cartTotal}</span>
            </div>
            <button onClick={placeOrder} style={{ width: "100%", padding: 12, background: "#D85A30", color: "white", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Place Order</button>
          </div>
        )}
      </div>

      {/* ADD ITEM MODAL */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 16, width: 380, padding: "1.5rem", border: "1px solid #E5E5E0" }}>
            <h3 style={{ fontWeight: 700, marginBottom: "1rem" }}>Add Menu Item</h3>
            {[["Item Name", "name", "text", "e.g. Paneer Butter Masala"], ["Price (₹)", "price", "number", "e.g. 60"], ["Emoji", "emoji", "text", "e.g. 🍛"]].map(([label, key, type, placeholder]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>{label}</label>
                <input type={type} placeholder={placeholder} value={newItem[key]} onChange={(e) => setNewItem((p) => ({ ...p, [key]: e.target.value }))} style={{ width: "100%", padding: "8px 10px", border: "1px solid #E5E5E0", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Category</label>
              <select value={newItem.cat} onChange={(e) => setNewItem((p) => ({ ...p, cat: e.target.value }))} style={{ width: "100%", padding: "8px 10px", border: "1px solid #E5E5E0", borderRadius: 8, fontSize: 14 }}>
                {["meals", "snacks", "drinks", "desserts","tiffen"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: "1rem" }}>
              <button onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #E5E5E0", background: "transparent", cursor: "pointer", fontSize: 14 }}>Cancel</button>
              <button onClick={saveNewItem} style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: "#D85A30", color: "white", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>Add Item</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      <div style={{ position: "fixed", bottom: 24, left: "50%", transform: `translateX(-50%) translateY(${toast ? 0 : 80}px)`, background: "#1D9E75", color: "white", padding: "10px 20px", borderRadius: 24, fontSize: 13, fontWeight: 600, zIndex: 500, transition: "transform 0.3s", whiteSpace: "nowrap" }}>
        ✓ {toast}
      </div>
    </div>
  );
}
