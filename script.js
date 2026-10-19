// ジルアーナマチャラ亭 メニュー・オーダーシステム

// ===== 定数 =====
const STORAGE_CURRENT = "jiru_current_order"; // 会計前の注文
const STORAGE_ORDERS = "jiru_orders"; // 会計確定済みの注文の一覧
const DRINK_CATEGORIES = ["soft", "alcohol"];
const ADULT_AGE = 20;

// ===== 状態 =====
let state = null; // 会計前の注文（受付〜会計確定まで）
let currentCategory = CATEGORIES[0].id;
let messageTimer = null;

// ===== 便利な関数 =====
function $(id) {
  return document.getElementById(id);
}

function yen(n) {
  return n.toLocaleString("ja-JP") + "円";
}

function findMenu(menuId) {
  return MENU.find((m) => m.id === menuId);
}

function findCustomer(customerId) {
  return state.customers.find((c) => c.customerId === customerId);
}

function categoryName(categoryId) {
  const c = CATEGORIES.find((cat) => cat.id === categoryId);
  return c ? c.name : "";
}

function isDrink(menu) {
  return DRINK_CATEGORIES.includes(menu.category);
}

function isAdult(age) {
  return age >= ADULT_AGE;
}

// 年齢から年代を決める（0〜9歳は 10代 に含める）
function ageGroupOf(age) {
  if (age < 20) return "10代";
  if (age >= 60) return "60代以上";
  return Math.floor(age / 10) * 10 + "代";
}

// 指定したアレルギーを含むか
function hasSelectedAllergy(menu) {
  return menu.allergens.some((a) => state.allergies.includes(a));
}

function guestLabel(customer, index) {
  return `${index + 1}人目（${customer.age}歳・${customer.gender}）`;
}

// ===== localStorage =====
function loadJSON(key, fallback) {
  try {
    const text = localStorage.getItem(key);
    return text ? JSON.parse(text) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

function removeKey(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    // 消せなくても動作は続ける
  }
}

function saveCurrent() {
  if (!saveJSON(STORAGE_CURRENT, state)) {
    showMessage("注文データを保存できませんでした（ブラウザの設定を確認してください）", true);
  }
}

// ===== 入力チェック =====
// 整数かどうかと範囲をチェックする。{ ok, value } か { ok: false, message } を返す
function checkInteger(raw, label, min, max) {
  const text = String(raw == null ? "" : raw)
    .trim()
    .replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[－ー−]/g, "-");

  if (text === "") return { ok: false, message: `${label}を入力してください` };
  if (/^-/.test(text)) return { ok: false, message: `${label}にマイナスは入力できません` };
  if (/^\d+\.\d+$/.test(text)) return { ok: false, message: `${label}に小数は入力できません` };
  if (!/^\d+$/.test(text)) return { ok: false, message: `${label}は数字で入力してください` };

  const value = Number(text);
  if (value < min || value > max) {
    return { ok: false, message: `${label}は${min}〜${max}の範囲で入力してください` };
  }
  return { ok: true, value: value };
}

// ===== お知らせ表示 =====
function showMessage(text, isError) {
  const box = $("message");
  box.textContent = text;
  box.classList.toggle("is-error", Boolean(isError));
  box.hidden = false;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => {
    box.hidden = true;
  }, isError ? 4000 : 2500);
}

// ===== 画面の切り替え =====
function showScreen(name) {
  ["reception", "order", "confirm", "complete"].forEach((s) => {
    $("screen-" + s).hidden = s !== name;
  });
  window.scrollTo(0, 0);
}

// ===== ① 受付画面 =====
function initReception() {
  $("allergy-list").innerHTML = ALLERGENS.map(
    (a) => `<label class="check"><input type="checkbox" value="${a}"> ${a}</label>`
  ).join("");

  $("people-count").addEventListener("input", onPeopleCountInput);
  $("guest-rows").addEventListener("input", onGuestRowInput);
  $("start-btn").addEventListener("click", startOrder);
}

function resetReception() {
  $("people-count").value = "";
  $("people-error").hidden = true;
  $("guest-rows").innerHTML = '<p class="note">人数を入力すると、入力欄が表示されます。</p>';
  $("allergy-list").querySelectorAll("input").forEach((cb) => (cb.checked = false));
  $("reception-errors").hidden = true;
}

function onPeopleCountInput() {
  const result = checkInteger($("people-count").value, "人数", 1, 20);
  const error = $("people-error");
  if (!result.ok) {
    error.textContent = result.message;
    error.hidden = false;
    return;
  }
  error.hidden = true;
  renderGuestRows(result.value);
}

// 来店者の入力欄を人数分つくる（入力済みの内容は残す）
function renderGuestRows(count) {
  const box = $("guest-rows");
  const old = Array.from(box.querySelectorAll(".guest-row")).map((row) => ({
    age: row.querySelector(".guest-age").value,
    gender: row.querySelector(".guest-gender").value,
    drink: row.querySelector(".guest-drink").checked,
  }));

  let html = "";
  for (let i = 0; i < count; i++) {
    html += `
      <div class="guest-row">
        <span class="guest-no">${i + 1}人目</span>
        <label class="guest-field">年齢
          <input class="guest-age" type="text" inputmode="numeric" placeholder="例：25" autocomplete="off">
          <span>歳</span>
        </label>
        <label class="guest-field">性別
          <select class="guest-gender">
            <option value="">選択</option>
            <option value="男性">男性</option>
            <option value="女性">女性</option>
            <option value="回答しない">回答しない</option>
          </select>
        </label>
        <label class="guest-field check">
          <input class="guest-drink" type="checkbox"> 飲み放題
          <span class="plan-note">+1,000円</span>
        </label>
      </div>`;
  }
  box.innerHTML = html;

  box.querySelectorAll(".guest-row").forEach((row, i) => {
    if (!old[i]) return;
    row.querySelector(".guest-age").value = old[i].age;
    row.querySelector(".guest-gender").value = old[i].gender;
    row.querySelector(".guest-drink").checked = old[i].drink;
    updatePlanNote(row);
  });
}

function onGuestRowInput(e) {
  if (e.target.classList.contains("guest-age")) {
    updatePlanNote(e.target.closest(".guest-row"));
  }
}

// 年齢に応じて、飲み放題の種類を表示する
function updatePlanNote(row) {
  const result = checkInteger(row.querySelector(".guest-age").value, "年齢", 0, 120);
  const note = row.querySelector(".plan-note");
  if (!result.ok) {
    note.textContent = "+1,000円";
  } else if (isAdult(result.value)) {
    note.textContent = "アルコール含む +1,000円";
  } else {
    note.textContent = "ソフトドリンクのみ +1,000円";
  }
}

function startOrder() {
  const errors = [];
  const countResult = checkInteger($("people-count").value, "人数", 1, 20);
  if (!countResult.ok) errors.push(countResult.message);

  const rows = Array.from($("guest-rows").querySelectorAll(".guest-row"));
  const customers = [];
  if (countResult.ok) {
    rows.forEach((row, i) => {
      const ageResult = checkInteger(row.querySelector(".guest-age").value, `${i + 1}人目の年齢`, 0, 120);
      const gender = row.querySelector(".guest-gender").value;
      const nomihodai = row.querySelector(".guest-drink").checked;
      if (!ageResult.ok) errors.push(ageResult.message);
      if (!gender) errors.push(`${i + 1}人目の性別を選んでください`);
      if (ageResult.ok && gender) {
        customers.push({
          customerId: "C" + (i + 1),
          age: ageResult.value,
          ageGroup: ageGroupOf(ageResult.value),
          gender: gender,
          nomihodai: nomihodai,
          // 20歳未満はソフトドリンクのみの飲み放題
          nomihodaiType: nomihodai ? (isAdult(ageResult.value) ? "通常" : "ソフトドリンクのみ") : null,
        });
      }
    });
  }

  const errorList = $("reception-errors");
  if (errors.length > 0) {
    errorList.innerHTML = errors.map((m) => `<li>${m}</li>`).join("");
    errorList.hidden = false;
    return;
  }
  errorList.hidden = true;

  const allergies = Array.from($("allergy-list").querySelectorAll("input:checked")).map((cb) => cb.value);
  state = {
    orderId: "O" + Date.now(),
    orderedAt: new Date().toISOString(),
    peopleCount: countResult.value,
    customers: customers,
    allergies: allergies,
    lines: [],
    staffCalls: [],
    nextLineNo: 1,
    status: "注文中",
  };
  saveCurrent();
  enterOrderScreen();
}

// ===== ② 注文画面 =====
function initOrderScreen() {
  $("category-tabs").addEventListener("click", (e) => {
    const tab = e.target.closest("[data-category]");
    if (!tab) return;
    currentCategory = tab.dataset.category;
    renderTabs();
    renderMenu();
  });
  $("menu-list").addEventListener("click", onMenuClick);
  $("order-list").addEventListener("click", onOrderListClick);
  $("order-list").addEventListener("change", onOrderListChange);
  $("recommend-person").addEventListener("change", renderRecommend);
  $("to-confirm-btn").addEventListener("click", enterConfirmScreen);
  $("call-staff-btn").addEventListener("click", callStaff);
}

// 店員呼び出し（画面に表示し、呼び出した日時を記録する）
function callStaff() {
  if (!Array.isArray(state.staffCalls)) state.staffCalls = [];
  state.staffCalls.push({ calledAt: new Date().toISOString() });
  saveCurrent();
  showMessage("店員を呼び出しました。少々お待ちください。", false);
}

function enterOrderScreen() {
  currentCategory = CATEGORIES[0].id;
  const nomihodaiCount = state.customers.filter((c) => c.nomihodai).length;
  const allergyText = state.allergies.length > 0 ? state.allergies.join("・") : "なし";
  $("order-info").textContent =
    `${state.peopleCount}名様 ／ 飲み放題 ${nomihodaiCount}名 ／ アレルギー指定：${allergyText}`;

  $("recommend-person").innerHTML = state.customers
    .map((c, i) => `<option value="${c.customerId}">${guestLabel(c, i)}</option>`)
    .join("");

  renderTabs();
  renderMenu();
  renderRecommend();
  renderRanking();
  renderOrderList();
  showScreen("order");
}

function renderTabs() {
  $("category-tabs").innerHTML = CATEGORIES.map((c) => {
    const active = c.id === currentCategory;
    return `<button type="button" role="tab" class="tab${active ? " is-active" : ""}"
      aria-selected="${active}" data-category="${c.id}">${c.name}</button>`;
  }).join("");
}

function priceLabel(menu) {
  if (menu.category === "chicken") return "食べ放題（0円）";
  if (isDrink(menu)) return `単品 ${yen(menu.price)}／飲み放題 0円`;
  return yen(menu.price);
}

function allergyLabel(menu) {
  return "アレルギー：" + (menu.allergens.length > 0 ? menu.allergens.join("・") : "なし");
}

// 「誰の分か」の選択肢（20歳未満はアルコールを選べない）
function whoOptions(menu) {
  const options = state.customers.map((c, i) => {
    const plan = c.nomihodai ? "飲み放題" : "単品";
    const blocked = menu.category === "alcohol" && !isAdult(c.age);
    const note = blocked ? "・20歳未満" : "";
    return `<option value="${c.customerId}"${blocked ? " disabled" : ""}>${i + 1}人目（${c.age}歳・${plan}${note}）</option>`;
  });
  return '<option value="">誰の分？</option>' + options.join("");
}

function renderMenu() {
  const items = MENU.filter((m) => m.category === currentCategory && !hasSelectedAllergy(m));
  if (items.length === 0) {
    $("menu-list").innerHTML = '<p class="note">アレルギーの指定により、表示できるメニューがありません。</p>';
    return;
  }
  $("menu-list").innerHTML = items
    .map(
      (m) => `
      <div class="menu-card" data-id="${m.id}">
        <p class="menu-name">${m.name}</p>
        <p class="menu-price">${priceLabel(m)}</p>
        <p class="menu-allergy">${allergyLabel(m)}</p>
        ${isDrink(m) ? `<select class="who-select" aria-label="誰の分か">${whoOptions(m)}</select>` : ""}
        <div class="qty">
          <button type="button" class="qty-btn" data-act="minus" aria-label="1つ減らす">−</button>
          <input class="qty-input" type="text" inputmode="numeric" value="1" aria-label="数量">
          <button type="button" class="qty-btn" data-act="plus" aria-label="1つ増やす">＋</button>
        </div>
        <button type="button" class="btn btn-main order-btn" data-act="order">注文する</button>
      </div>`
    )
    .join("");
}

function onMenuClick(e) {
  const button = e.target.closest("[data-act]");
  if (!button) return;
  const card = button.closest(".menu-card");
  const input = card.querySelector(".qty-input");
  const act = button.dataset.act;

  if (act === "minus" || act === "plus") {
    const result = checkInteger(input.value, "数量", 1, 99);
    const now = result.ok ? result.value : 1;
    input.value = Math.min(99, Math.max(1, now + (act === "plus" ? 1 : -1)));
    return;
  }

  const who = card.querySelector(".who-select");
  const ok = placeOrder(card.dataset.id, input.value, who ? who.value : null);
  if (ok) input.value = 1;
}

// 注文する。成功したら true を返す
function placeOrder(menuId, qtyRaw, customerId) {
  const menu = findMenu(menuId);
  if (!menu) return false;
  if (hasSelectedAllergy(menu)) {
    showMessage("指定したアレルギーを含むため注文できません", true);
    return false;
  }

  const qty = checkInteger(qtyRaw, "数量", 1, 99);
  if (!qty.ok) {
    showMessage(qty.message, true);
    return false;
  }

  let plan = null;
  if (isDrink(menu)) {
    const customer = customerId ? findCustomer(customerId) : null;
    if (!customer) {
      showMessage("ドリンクは「誰の分か」を選んでください", true);
      return false;
    }
    if (menu.category === "alcohol" && !isAdult(customer.age)) {
      showMessage("20歳未満の方はアルコールを注文できません", true);
      return false;
    }
    plan = customer.nomihodai ? "飲み放題" : "単品";
  } else {
    customerId = null;
  }
  const unitPrice = plan === "飲み放題" ? 0 : menu.price;

  // 同じ品（ドリンクは同じ人・同じ扱い）の注文はまとめる
  const same = state.lines.find(
    (l) => l.menuId === menuId && l.customerId === customerId && l.plan === plan
  );
  if (same) {
    if (same.quantity + qty.value > 99) {
      showMessage("1品の数量は99個までです", true);
      return false;
    }
    same.quantity += qty.value;
  } else {
    state.lines.push({
      lineId: "L" + state.nextLineNo++,
      menuId: menu.id,
      menuName: menu.name,
      category: menu.category,
      quantity: qty.value,
      unitPrice: unitPrice,
      customerId: customerId,
      plan: plan,
    });
  }

  saveCurrent();
  renderOrderList();
  showMessage(`${menu.name} ×${qty.value} を注文しました`, false);
  return true;
}

function renderRecommend() {
  const customer = findCustomer($("recommend-person").value) || state.customers[0];
  const drinkId = RECOMMEND_DRINK[customer.gender][isAdult(customer.age) ? "adult" : "minor"];
  const ids = RECOMMEND_FOOD[customer.ageGroup].concat(drinkId);
  const items = ids.map(findMenu).filter((m) => m && !hasSelectedAllergy(m));

  if (items.length === 0) {
    $("recommend-list").innerHTML = '<li class="note">アレルギーの指定により、表示できるおすすめがありません。</li>';
    return;
  }
  $("recommend-list").innerHTML =
    `<li class="recommend-reason">${customer.ageGroup}・${customer.gender}の方へ</li>` +
    items
      .map(
        (m) => `<li><span class="recommend-name">${m.name}</span>
          <span class="recommend-cat">${categoryName(m.category)}</span></li>`
      )
      .join("");
}

// 会計確定済みの注文から、鶏肉の注文個数を集計する
function computeRanking() {
  const orders = loadJSON(STORAGE_ORDERS, []);
  const counts = {};
  (Array.isArray(orders) ? orders : []).forEach((order) => {
    (order.items || []).forEach((item) => {
      const menu = findMenu(item.menuId);
      if (menu && menu.category === "chicken") {
        counts[item.menuId] = (counts[item.menuId] || 0) + item.quantity;
      }
    });
  });
  return MENU.filter((m) => counts[m.id] > 0)
    .map((m) => ({ name: m.name, count: counts[m.id] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function renderRanking() {
  const ranking = computeRanking();
  if (ranking.length === 0) {
    $("ranking-list").innerHTML = '<li class="note">まだ注文がありません</li>';
    return;
  }
  $("ranking-list").innerHTML = ranking
    .map(
      (r, i) => `<li class="rank-${i + 1}"><span class="rank-no">${i + 1}位</span>
        <span class="rank-name">${r.name}</span><span class="rank-count">${r.count}個</span></li>`
    )
    .join("");
}

function lineLabel(line) {
  if (!line.customerId) return "";
  const index = state.customers.findIndex((c) => c.customerId === line.customerId);
  return `<span class="line-tag${line.plan === "飲み放題" ? " is-free" : ""}">${index + 1}人目・${line.plan}</span>`;
}

function renderOrderList() {
  if (state.lines.length === 0) {
    $("order-list").innerHTML = '<li class="note">まだ注文はありません</li>';
  } else {
    $("order-list").innerHTML = state.lines
      .map(
        (l) => `
        <li class="order-line" data-line="${l.lineId}">
          <div class="line-head">
            <span class="line-name">${l.menuName}</span>
            ${lineLabel(l)}
          </div>
          <div class="line-body">
            <div class="qty qty-small">
              <button type="button" class="qty-btn" data-act="minus" aria-label="1つ減らす">−</button>
              <input class="qty-input" type="text" inputmode="numeric" value="${l.quantity}" aria-label="数量">
              <button type="button" class="qty-btn" data-act="plus" aria-label="1つ増やす">＋</button>
            </div>
            <span class="line-price">${yen(l.unitPrice * l.quantity)}</span>
          </div>
        </li>`
      )
      .join("");
  }
  $("order-total").textContent = "現在のお会計（目安）：" + yen(calcBill().total);
}

function onOrderListClick(e) {
  const button = e.target.closest("[data-act]");
  if (!button) return;
  const line = state.lines.find((l) => l.lineId === button.closest(".order-line").dataset.line);
  if (!line) return;
  setLineQuantity(line, line.quantity + (button.dataset.act === "plus" ? 1 : -1));
}

function onOrderListChange(e) {
  if (!e.target.classList.contains("qty-input")) return;
  const line = state.lines.find((l) => l.lineId === e.target.closest(".order-line").dataset.line);
  if (!line) return;
  setLineQuantity(line, e.target.value);
}

// 注文済みの数量を変える（0 で取り消し）
function setLineQuantity(line, raw) {
  const result = checkInteger(raw, "数量", 0, 99);
  if (!result.ok) {
    showMessage(result.message, true);
    renderOrderList();
    return;
  }
  if (result.value === 0) {
    state.lines = state.lines.filter((l) => l !== line);
    showMessage(`${line.menuName} を取り消しました`, false);
  } else {
    line.quantity = result.value;
  }
  saveCurrent();
  renderOrderList();
}

// ===== 会計 =====
function calcBill() {
  const sumOf = (filter) =>
    state.lines.filter(filter).reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  const tabehodai = PRICE.tabehodai * state.customers.length;
  const nomihodai = PRICE.nomihodai * state.customers.filter((c) => c.nomihodai).length;
  const ippin = sumOf((l) => l.category === "ippin");
  const dessert = sumOf((l) => l.category === "dessert");
  const tanpinDrink = sumOf((l) => DRINK_CATEGORIES.includes(l.category) && l.plan === "単品");

  return {
    tabehodai: tabehodai,
    nomihodai: nomihodai,
    ippin: ippin,
    dessert: dessert,
    tanpinDrink: tanpinDrink,
    total: tabehodai + nomihodai + ippin + dessert + tanpinDrink,
  };
}

// ===== ③ 会計確認画面 =====
function enterConfirmScreen() {
  const bill = calcBill();
  const people = state.customers.length;
  const nomihodaiPeople = state.customers.filter((c) => c.nomihodai).length;
  const rows = [
    ["食べ放題", `${yen(PRICE.tabehodai)} × ${people}人`, bill.tabehodai],
    ["飲み放題", `${yen(PRICE.nomihodai)} × ${nomihodaiPeople}人`, bill.nomihodai],
    ["一品料理", "", bill.ippin],
    ["デザート", "", bill.dessert],
    ["単品ドリンク", "", bill.tanpinDrink],
  ];
  $("bill-body").innerHTML = rows
    .map(
      ([name, detail, amount]) => `
      <tr>
        <th>${name}<span class="bill-detail">${detail}</span></th>
        <td>${yen(amount)}</td>
      </tr>`
    )
    .join("");
  $("bill-total").textContent = yen(bill.total);
  showScreen("confirm");
}

// ===== ④ 会計確定 =====
function checkout() {
  const bill = calcBill();
  const confirmedAt = new Date().toISOString();
  const toItem = (l) => ({
    menuId: l.menuId,
    menuName: l.menuName,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    subtotal: l.unitPrice * l.quantity,
  });

  const record = {
    orderId: state.orderId,
    orderedAt: state.orderedAt,
    peopleCount: state.peopleCount,
    customers: state.customers,
    allergies: state.allergies,
    items: state.lines.filter((l) => !l.customerId).map(toItem),
    drinkItems: state.lines
      .filter((l) => l.customerId)
      .map((l) => Object.assign({ customerId: l.customerId, plan: l.plan }, toItem(l))),
    staffCalls: state.staffCalls || [],
    bill: Object.assign({}, bill, { confirmedAt: confirmedAt }),
    status: "終了",
  };

  const orders = loadJSON(STORAGE_ORDERS, []);
  const list = Array.isArray(orders) ? orders : [];
  list.push(record);
  if (!saveJSON(STORAGE_ORDERS, list)) {
    showMessage("会計データを保存できませんでした（ブラウザの設定を確認してください）", true);
    return;
  }
  removeKey(STORAGE_CURRENT);
  state = null;

  $("complete-total").textContent = yen(bill.total);
  showScreen("complete");
}

function startNewOrder() {
  resetReception();
  showScreen("reception");
}

// ===== 起動 =====
function init() {
  initReception();
  initOrderScreen();
  $("back-btn").addEventListener("click", () => showScreen("order"));
  $("checkout-btn").addEventListener("click", checkout);
  $("new-order-btn").addEventListener("click", startNewOrder);

  // 会計前の注文が残っていれば、注文画面から再開する
  const saved = loadJSON(STORAGE_CURRENT, null);
  if (saved && saved.status === "注文中" && Array.isArray(saved.customers) && saved.customers.length > 0) {
    state = saved;
    enterOrderScreen();
  } else {
    showScreen("reception");
  }
}

init();
