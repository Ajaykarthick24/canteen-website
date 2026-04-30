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

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "menu"), (snap) => {
      setMenuItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  function addToCart(item) {
    if (!item.available) return;
    setCart((prev) => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
    showToast(`${item.name} added!`);
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
      items, total: cartTotal, status: "pending", createdAt: serverTimestamp(),
    });
    setCart({});
    setCartOpen(false);
    showToast("Order placed successfully! 🎉");
  }

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
      name: newItem.name, price: parseInt(newItem.price),
      cat: newItem.cat, emoji: newItem.emoji || "🍽️",
      rating: 4.0, available: true,
    });
    setNewItem({ name: "", price: "", cat: "meals", emoji: "" });
    setShowAddModal(false);
    showToast("Item added!");
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
    ({ meals: "#FFF3E8", snacks: "#EAF3DE", drinks: "#E6F1FB", desserts: "#FBEAF0" }[cat] || "#F5F4F0");

  const catEmoji = (cat) =>
    ({ meals: "🍱", snacks: "🥪", drinks: "🥤", desserts: "🍮", all: "🍽️" }[cat] || "🍽️");

  const statusStyle = (s) =>
    ({ pending: { bg: "#FFF3E8", color: "#C85A00", label: "Pending" }, preparing: { bg: "#E6F1FB", color: "#185FA5", label: "Preparing" }, ready: { bg: "#EAF3DE", color: "#3B6D11", label: "Ready ✓" } }[s] || { bg: "#eee", color: "#333", label: s });

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", minHeight: "100vh", background: "#F5F4F0", maxWidth: 480, margin: "0 auto", position: "relative" }}>

      {/* TOP NAV */}
      <nav style={{ background: "white", borderBottom: "1px solid #E5E5E0", padding: "0 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", height: 54, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 24 }}>🍽️</span>
          <span style={{ fontWeight: 700, fontSize: 16 }}>
            <span style={{ color: "#D85A30" }}>Campus</span>Canteen
          </span>
        </div>
        {view === "student" && (
          <button onClick={() => setCartOpen(true)} style={{ position: "relative", background: "#D85A30", color: "white", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            🛒
            {cartCount > 0 && (
              <span style={{ position: "absolute", top: -6, right: -6, background: "#1D9E75", color: "white", borderRadius: "50%", width: 20, height: 20, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid white" }}>
                {cartCount}
              </span>
            )}
          </button>
        )}
        {view === "owner" && user && (
          <button onClick={() => signOut(auth)} style={{ padding: "6px 12px", background: "transparent", border: "1px solid #E5E5E0", borderRadius: 8, fontSize: 12, cursor: "pointer", color: "#888" }}>Logout</button>
        )}
      </nav>

      {/* STUDENT VIEW */}
      {view === "student" && (
        <div style={{ paddingBottom: 100 }}>

          {/* HERO BANNER */}
          <div style={{ background: "linear-gradient(135deg, #D85A30, #F4845F)", color: "white", padding: "1.25rem 1rem", textAlign: "center" }}>
            <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 4 }}>Good food, good mood 😊</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>What are you craving today?</div>
          </div>

          {/* CATEGORY FILTER - Scrollable horizontal */}
          <div style={{ overflowX: "auto", display: "flex", gap: 8, padding: "1rem", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
            {CATEGORIES.map((cat) => (
              <button key={cat} onClick={() => setFilter(cat)} style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 14px", borderRadius: 12, border: "1.5px solid", borderColor: filter === cat ? "#D85A30" : "#E5E5E0", background: filter === cat ? "#FFF3E8" : "white", cursor: "pointer", minWidth: 64 }}>
                <span style={{ fontSize: 20 }}>{catEmoji(cat)}</span>
                <span style={{ fontSize: 11, fontWeight: filter === cat ? 700 : 400, color: filter === cat ? "#D85A30" : "#666", whiteSpace: "nowrap" }}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </span>
              </button>
            ))}
          </div>

          {/* MENU LIST */}
          <div style={{ padding: "0 1rem", display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.length === 0 && (
              <div style={{ textAlign: "center", color: "#aaa", padding: "3rem 0", fontSize: 14 }}>No items found</div>
            )}
            {filtered.map((item) => {
              const qty = cart[item.id] || 0;
              return (
                <div key={item.id} style={{ background: "white", borderRadius: 14, overflow: "hidden", border: "1px solid #F0F0EC", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", opacity: item.available ? 1 : 0.55, display: "flex", alignItems: "stretch" }}>
                  <div style={{ width: 80, minHeight: 90, background: catColor(item.cat), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, flexShrink: 0 }}>
                    {item.emoji}
                  </div>
                  <div style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#1A1A1A" }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: "#aaa", textTransform: "capitalize", marginTop: 1 }}>{item.cat}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: item.available ? "#EAF3DE" : "#FCEBEB", color: item.available ? "#3B6D11" : "#A32D2D", whiteSpace: "nowrap", marginLeft: 6 }}>
                        {item.available ? "Available" : "Sold Out"}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                      <div>
                        <span style={{ fontWeight: 800, color: "#D85A30", fontSize: 16 }}>₹{item.price}</span>
                        <span style={{ fontSize: 11, color: "#aaa", marginLeft: 8 }}>⭐ {item.rating}</span>
                      </div>
                      {item.available && (
                        qty === 0
                          ? <button onClick={() => addToCart(item)} style={{ background: "#D85A30", color: "white", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Add</button>
                          : <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #D85A30", borderRadius: 8, overflow: "hidden" }}>
                              <button onClick={() => changeQty(item.id, -1)} style={{ width: 32, height: 32, border: "none", background: "white", color: "#D85A30", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>−</button>
                              <span style={{ width: 28, textAlign: "center", fontWeight: 700, fontSize: 14, color: "#1A1A1A" }}>{qty}</span>
                              <button onClick={() => changeQty(item.id, 1)} style={{ width: 32, height: 32, border: "none", background: "white", color: "#D85A30", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>+</button>
                            </div>
                      )}
                    </div>
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
          <div style={{ padding: "2rem 1.25rem" }}>
            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <div style={{ fontSize: 48 }}>🔐</div>
              <h2 style={{ fontWeight: 700, fontSize: 20, marginTop: 8 }}>Owner Login</h2>
              <p style={{ color: "#888", fontSize: 13 }}>Only canteen staff can access this</p>
            </div>
            <form onSubmit={handleLogin}>
              {[["Email", "email", loginEmail, setLoginEmail, "owner@canteen.com"], ["Password", "password", loginPassword, setLoginPassword, "••••••••"]].map(([label, type, val, setter, ph]) => (
                <div key={label} style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, color: "#555", display: "block", marginBottom: 6, fontWeight: 600 }}>{label}</label>
                  <input type={type} placeholder={ph} value={val} onChange={(e) => setter(e.target.value)}
                    style={{ width: "100%", padding: "12px 14px", border: "1.5px solid #E5E5E0", borderRadius: 10, fontSize: 15, boxSizing: "border-box", outline: "none" }} />
                </div>
              ))}
              {loginError && <p style={{ color: "#E24B4A", fontSize: 13, marginBottom: 10 }}>{loginError}</p>}
              <button type="submit" style={{ width: "100%", padding: 14, background: "#D85A30", color: "white", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>Login</button>
            </form>
          </div>
        ) : (
          <div style={{ paddingBottom: 80 }}>
            <div style={{ display: "flex", background: "white", borderBottom: "1px solid #E5E5E0" }}>
              {[["orders", "📋 Orders"], ["manage", "⚙️ Manage"]].map(([tab, label]) => (
                <button key={tab} onClick={() => setOwnerTab(tab)} style={{ flex: 1, padding: "14px 0", border: "none", background: "transparent", fontSize: 14, fontWeight: ownerTab === tab ? 700 : 400, color: ownerTab === tab ? "#D85A30" : "#888", borderBottom: ownerTab === tab ? "2.5px solid #D85A30" : "2.5px solid transparent", cursor: "pointer" }}>
                  {label}
                </button>
              ))}
            </div>

            {ownerTab === "orders" && (
              <div style={{ padding: "1rem" }}>
                {orders.length === 0
                  ? <div style={{ textAlign: "center", color: "#aaa", padding: "4rem 0", fontSize: 14 }}>No orders yet 👀</div>
                  : orders.map((order) => {
                    const st = statusStyle(order.status);
                    return (
                      <div key={order.id} style={{ background: "white", border: "1px solid #F0F0EC", borderRadius: 14, padding: "1rem", marginBottom: 10, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>Order #{order.id.slice(-4).toUpperCase()}</div>
                            <div style={{ fontSize: 11, color: "#aaa" }}>{order.createdAt?.toDate?.().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) || "Just now"}</div>
                          </div>
                          <button onClick={() => cycleStatus(order)} style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 20, cursor: "pointer", border: "none", background: st.bg, color: st.color }}>
                            {st.label} ▾
                          </button>
                        </div>
                        {order.items?.map((it, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#555", padding: "3px 0" }}>
                            <span>{it.name} × {it.qty}</span>
                            <span style={{ fontWeight: 600, color: "#1A1A1A" }}>₹{it.price}</span>
                          </div>
                        ))}
                        <div style={{ borderTop: "1px solid #F0F0EC", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 15 }}>
                          <span>Total</span><span style={{ color: "#D85A30" }}>₹{order.total}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {ownerTab === "manage" && (
              <div style={{ padding: "1rem" }}>
                <button onClick={() => setShowAddModal(true)} style={{ width: "100%", padding: 14, background: "#D85A30", color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}>
                  + Add New Item
                </button>
                {menuItems.map((item) => (
                  <div key={item.id} style={{ background: "white", border: "1px solid #F0F0EC", borderRadius: 14, padding: "12px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <span style={{ fontSize: 30 }}>{item.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: "#aaa" }}>₹{item.price} · {item.cat}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <div onClick={() => toggleAvail(item)} style={{ width: 42, height: 24, borderRadius: 24, background: item.available ? "#1D9E75" : "#ccc", position: "relative", cursor: "pointer", transition: ".2s", flexShrink: 0 }}>
                        <div style={{ position: "absolute", width: 18, height: 18, background: "white", borderRadius: "50%", top: 3, left: item.available ? 21 : 3, transition: ".2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                      </div>
                      <button onClick={() => removeMenuItem(item.id)} style={{ padding: "4px 10px", background: "#FCEBEB", border: "none", color: "#E24B4A", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      )}

      {/* BOTTOM NAV */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "white", borderTop: "1px solid #E5E5E0", display: "flex", zIndex: 99, boxShadow: "0 -2px 12px rgba(0,0,0,0.08)" }}>
        {[["student", "🍽️", "Menu"], ["owner", "👨‍🍳", "Owner"]].map(([v, emoji, label]) => (
          <button key={v} onClick={() => setView(v)} style={{ flex: 1, padding: "10px 0 8px", border: "none", background: "transparent", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer" }}>
            <span style={{ fontSize: 22 }}>{emoji}</span>
            <span style={{ fontSize: 11, fontWeight: view === v ? 700 : 400, color: view === v ? "#D85A30" : "#aaa" }}>{label}</span>
            {view === v && <div style={{ width: 20, height: 3, background: "#D85A30", borderRadius: 2 }} />}
          </button>
        ))}
      </div>

      {/* CART SLIDE-UP PANEL */}
      {cartOpen && <div onClick={() => setCartOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200 }} />}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: `translateX(-50%) translateY(${cartOpen ? "0" : "100%"})`, width: "100%", maxWidth: 480, background: "white", borderRadius: "20px 20px 0 0", zIndex: 201, transition: "transform 0.3s ease", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 -4px 24px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 40, height: 4, background: "#E5E5E0", borderRadius: 2 }} />
        </div>
        <div style={{ padding: "0 1rem 0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #F0F0EC" }}>
          <h2 style={{ fontWeight: 700, fontSize: 17 }}>🛒 Your Order</h2>
          <button onClick={() => setCartOpen(false)} style={{ background: "#F5F4F0", border: "none", borderRadius: "50%", width: 30, height: 30, fontSize: 16, cursor: "pointer", color: "#888" }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem 1rem" }}>
          {cartCount === 0
            ? <div style={{ textAlign: "center", color: "#aaa", paddingTop: "2rem", fontSize: 14 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🛒</div>
                Your cart is empty
              </div>
            : Object.entries(cart).map(([id, qty]) => {
                const item = menuItems.find((i) => i.id === id);
                if (!item) return null;
                return (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #F5F4F0" }}>
                    <span style={{ fontSize: 28 }}>{item.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: "#aaa" }}>₹{item.price} each</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #E5E5E0", borderRadius: 8, overflow: "hidden" }}>
                      <button onClick={() => changeQty(id, -1)} style={{ width: 32, height: 32, border: "none", background: "white", fontSize: 18, fontWeight: 700, cursor: "pointer", color: "#D85A30" }}>−</button>
                      <span style={{ width: 28, textAlign: "center", fontWeight: 700, fontSize: 14 }}>{qty}</span>
                      <button onClick={() => changeQty(id, 1)} style={{ width: 32, height: 32, border: "none", background: "white", fontSize: 18, fontWeight: 700, cursor: "pointer", color: "#D85A30" }}>+</button>
                    </div>
                    <span style={{ fontWeight: 700, color: "#D85A30", fontSize: 14, minWidth: 48, textAlign: "right" }}>₹{item.price * qty}</span>
                  </div>
                );
              })}
        </div>
        {cartCount > 0 && (
          <div style={{ padding: "1rem", borderTop: "1px solid #F0F0EC" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
              <span style={{ fontWeight: 800, fontSize: 18, color: "#D85A30" }}>₹{cartTotal}</span>
            </div>
            <button onClick={placeOrder} style={{ width: "100%", padding: 16, background: "#D85A30", color: "white", border: "none", borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
              Place Order 🎉
            </button>
          </div>
        )}
      </div>

      {/* ADD ITEM MODAL */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, padding: "1.5rem 1.25rem 2rem" }}>
            <h3 style={{ fontWeight: 700, marginBottom: "1rem", fontSize: 17 }}>Add Menu Item</h3>
            {[["Item Name", "name", "text", "e.g. Paneer Butter Masala"], ["Price (₹)", "price", "number", "e.g. 60"], ["Emoji", "emoji", "text", "e.g. 🍛"]].map(([label, key, type, ph]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4, fontWeight: 600 }}>{label}</label>
                <input type={type} placeholder={ph} value={newItem[key]} onChange={(e) => setNewItem((p) => ({ ...p, [key]: e.target.value }))}
                  style={{ width: "100%", padding: "12px 14px", border: "1.5px solid #E5E5E0", borderRadius: 10, fontSize: 15, boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4, fontWeight: 600 }}>Category</label>
              <select value={newItem.cat} onChange={(e) => setNewItem((p) => ({ ...p, cat: e.target.value }))}
                style={{ width: "100%", padding: "12px 14px", border: "1.5px solid #E5E5E0", borderRadius: 10, fontSize: 15 }}>
                {["meals", "snacks", "drinks", "desserts"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: 14, borderRadius: 12, border: "1.5px solid #E5E5E0", background: "transparent", cursor: "pointer", fontSize: 15, fontWeight: 600, color: "#666" }}>Cancel</button>
              <button onClick={saveNewItem} style={{ flex: 1, padding: 14, borderRadius: 12, border: "none", background: "#D85A30", color: "white", cursor: "pointer", fontSize: 15, fontWeight: 700 }}>Add Item</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      <div style={{ position: "fixed", bottom: 80, left: "50%", transform: `translateX(-50%) translateY(${toast ? 0 : 100}px)`, background: "#1A1A1A", color: "white", padding: "10px 20px", borderRadius: 24, fontSize: 13, fontWeight: 600, zIndex: 500, transition: "transform 0.3s", whiteSpace: "nowrap", opacity: toast ? 1 : 0 }}>
        ✓ {toast}
      </div>
    </div>
  );
}
