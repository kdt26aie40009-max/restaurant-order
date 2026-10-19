// ジルアーナ＝マチャラ亭 メニュー・オーダーシステム

// ===== 定数 =====
const STORAGE_CURRENT = "jiru_current_order"; // 会計前の注文
const STORAGE_ORDERS = "jiru_orders"; // 会計確定済みの注文の一覧
const DATA_VERSION = 2; // 会計前の注文データの形のバージョン
const LAST_ORDER_MINUTES = 90; // 受付からラストオーダーまでの分数（動作確認のときは 1 などに変えて試せる）
const DRINK_CATEGORIES = ["soft", "alcohol"];
const ADULT_AGE = 20;
const PLAN_DRINKBAR = "ドリンクバー";
const PLAN_TANPIN = "単品";

// ===== 状態 =====
let state = null; // 会計前の注文（受付〜会計確定まで）
let currentCategory = CATEGORIES[0].id;
let messageTimer = null;
let clockTimer = null;
let lastOrderPassedShown = null; // 画面に反映済みのラストオーダー状態

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

function drinkbarCount() {
  return state.customers.filter((c) => c.drinkbar).length;
}

// ドリンクバーで注文できるのは、ドリンクバーを付けた人が 1 人以上いるとき
function canOrderDrinkbar() {
  return drinkbarCount() > 0;
}

// 単品で注文できるのは、ドリンクバーを付けていない人が 1 人以上いるとき
function canOrderTanpin() {
  return drinkbarCount() < state.customers.length;
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
    drinkbar: row.querySelector(".guest-drinkbar").checked,
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
          <input class="guest-drinkbar" type="checkbox"> ドリンクバー
          <span class="plan-note">+1,000円</span>
        </label>
      </div>`;
  }
  box.innerHTML = html;

  box.querySelectorAll(".guest-row").forEach((row, i) => {
    if (!old[i]) return;
    row.querySelector(".guest-age").value = old[i].age;
    row.querySelector(".guest-gender").value = old[i].gender;
    row.querySelector(".guest-drinkbar").checked = old[i].drinkbar;
  });
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
      if (!ageResult.ok) errors.push(ageResult.message);
      if (!gender) errors.push(`${i + 1}人目の性別を選んでください`);
      if (ageResult.ok && gender) {
        customers.push({
          customerId: "C" + (i + 1),
          age: ageResult.value,
          ageGroup: ageGroupOf(ageResult.value),
          gender: gender,
          drinkbar: row.querySelector(".guest-drinkbar").checked,
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
  const now = new Date();
  state = {
    version: DATA_VERSION,
    orderId: "O" + now.getTime(),
    orderedAt: now.toISOString(),
    startedAt: now.getTime(), // ラストオーダーの計算に使う
    peopleCount: countResult.value,
    customers: customers,
    allergies: allergies,
    cart: [], // まだ注文確定していない品
    lines: [], // 注文確定した品
    staffCalls: [],
    nextLineNo: 1,
    status: "注文中",
  };
  saveCurrent();
  enterOrderScreen();
}

// ===== ラストオーダー =====
function remainingMs() {
  return state.startedAt + LAST_ORDER_MINUTES * 60 * 1000 - Date.now();
}

function isLastOrderPassed() {
  return remainingMs() <= 0;
}

function startClock() {
  stopClock();
  lastOrderPassedShown = null;
  updateClock();
  clockTimer = setInterval(updateClock, 1000);
}

function stopClock() {
  clearInterval(clockTimer);
  clockTimer = null;
}

// 残り時間を表示し、ラストオーダーを過ぎたら注文ボタンを止める
function updateClock() {
  if (!state) {
    stopClock();
    return;
  }
  const passed = isLastOrderPassed();
  const box = $("last-order");
  if (passed) {
    box.textContent = "ラストオーダーの時間を過ぎました。追加のご注文はお受けできません。";
  } else {
    const sec = Math.ceil(remainingMs() / 1000);
    const m = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, "0");
    box.textContent = `ラストオーダーまで 残り ${m}分${s}秒`;
  }
  box.classList.toggle("is-over", passed);

  if (passed !== lastOrderPassedShown) {
    lastOrderPassedShown = passed;
    renderMenu();
    renderCart();
  }
}

// ラストオーダーを過ぎていたらお知らせして true を返す
function blockIfLastOrderPassed() {
  if (!isLastOrderPassed()) return false;
  showMessage("ラストオーダーの時間を過ぎたため、注文できません", true);
  return true;
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
  $("cart-list").addEventListener("click", onCartClick);
  $("cart-list").addEventListener("change", onCartChange);
  $("submit-order-btn").addEventListener("click", submitOrder);
  $("order-list").addEventListener("click", onOrderListClick);
  $("order-list").addEventListener("change", onOrderListChange);
  $("recommend-person").addEventListener("change", renderRecommend);
  $("to-confirm-btn").addEventListener("click", enterConfirmScreen);
  $("call-staff-btn").addEventListener("click", callStaff);
}

// 店員呼び出し（画面に表示し、呼び出した日時を記録する）
function callStaff() {
  state.staffCalls.push({ calledAt: new Date().toISOString() });
  saveCurrent();
  showMessage("店員を呼び出しました。少々お待ちください。", false);
}

function enterOrderScreen() {
  currentCategory = CATEGORIES[0].id;
  const allergyText = state.allergies.length > 0 ? state.allergies.join("・") : "なし";
  $("order-info").textContent =
    `${state.peopleCount}名様 ／ ドリンクバー ${drinkbarCount()}名 ／ アレルギー指定：${allergyText}`;

  $("recommend-person").innerHTML = state.customers
    .map((c, i) => `<option value="${c.customerId}">${i + 1}人目（${c.age}歳・${c.gender}）</option>`)
    .join("");

  renderTabs();
  renderMenu();
  renderCart();
  renderOrderList();
  renderRecommend();
  renderRanking();
  showScreen("order");
  startClock();
}

function renderTabs() {
  $("category-tabs").innerHTML = CATEGORIES.map((c) => {
    const active = c.id === currentCategory;
    return `<button type="button" role="tab" class="tab${active ? " is-active" : ""}"
      aria-selected="${active}" data-category="${c.id}">${c.name}</button>`;
  }).join("");
}

function priceLabel(menu) {
  if (isDrink(menu)) return `単品 ${yen(menu.price)}`;
  return "食べ放題（0円）";
}

function allergyLabel(menu) {
  return "アレルギー：" + (menu.allergens.length > 0 ? menu.allergens.join("・") : "なし");
}

// カートに入れるボタン（ドリンクはドリンクバー／単品のボタン）
function addButtons(menu) {
  const disabled = isLastOrderPassed() ? " disabled" : "";
  if (!isDrink(menu)) {
    return `<button type="button" class="btn btn-main add-btn" data-act="add"${disabled}>カートに入れる</button>`;
  }
  let html = "";
  if (canOrderDrinkbar()) {
    html += `<button type="button" class="btn btn-main add-btn" data-act="add" data-plan="${PLAN_DRINKBAR}"${disabled}>ドリンクバーで（0円）</button>`;
  }
  if (canOrderTanpin()) {
    html += `<button type="button" class="btn btn-sub add-btn" data-act="add" data-plan="${PLAN_TANPIN}"${disabled}>単品で（${yen(menu.price)}）</button>`;
  }
  return html;
}

function renderMenu() {
  if (!state) return;
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
        <div class="qty">
          <button type="button" class="qty-btn" data-act="minus" aria-label="1つ減らす">−</button>
          <input class="qty-input" type="text" inputmode="numeric" value="1" aria-label="数量">
          <button type="button" class="qty-btn" data-act="plus" aria-label="1つ増やす">＋</button>
        </div>
        <div class="add-buttons">${addButtons(m)}</div>
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

  const ok = addToCart(card.dataset.id, input.value, button.dataset.plan || null);
  if (ok) input.value = 1;
}

// カートに入れる。成功したら true を返す
function addToCart(menuId, qtyRaw, plan) {
  if (blockIfLastOrderPassed()) return false;
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

  if (isDrink(menu)) {
    if (plan === PLAN_DRINKBAR && !canOrderDrinkbar()) {
      showMessage("ドリンクバーを付けた方がいないため、ドリンクバーでは注文できません", true);
      return false;
    }
    if (plan === PLAN_TANPIN && !canOrderTanpin()) {
      showMessage("全員がドリンクバーのため、ドリンクバーで注文してください", true);
      return false;
    }
    if (plan !== PLAN_DRINKBAR && plan !== PLAN_TANPIN) return false;
  } else {
    plan = null;
  }

  // 同じ品（ドリンクは同じ注文方法）はまとめる
  const same = state.cart.find((c) => c.menuId === menuId && c.plan === plan);
  if (same) {
    if (same.quantity + qty.value > 99) {
      showMessage("1品の数量は99個までです", true);
      return false;
    }
    same.quantity += qty.value;
  } else {
    state.cart.push({ menuId: menuId, plan: plan, quantity: qty.value });
  }

  saveCurrent();
  renderCart();
  showMessage(`${menu.name} ×${qty.value} をカートに入れました`, false);
  return true;
}

function unitPriceOf(menu, plan) {
  return plan === PLAN_DRINKBAR ? 0 : menu.price;
}

function planTag(plan) {
  if (!plan) return "";
  return `<span class="line-tag${plan === PLAN_DRINKBAR ? " is-free" : ""}">${plan}</span>`;
}

// ===== カート =====
function renderCart() {
  if (!state) return;
  if (state.cart.length === 0) {
    $("cart-list").innerHTML = '<li class="note">カートは空です</li>';
  } else {
    $("cart-list").innerHTML = state.cart
      .map((c, i) => {
        const menu = findMenu(c.menuId);
        return `
        <li class="order-line" data-index="${i}">
          <div class="line-head">
            <span class="line-name">${menu.name}</span>
            ${planTag(c.plan)}
          </div>
          <div class="line-body">
            <div class="qty qty-small">
              <button type="button" class="qty-btn" data-act="minus" aria-label="1つ減らす">−</button>
              <input class="qty-input" type="text" inputmode="numeric" value="${c.quantity}" aria-label="数量">
              <button type="button" class="qty-btn" data-act="plus" aria-label="1つ増やす">＋</button>
            </div>
            <span class="line-price">${yen(unitPriceOf(menu, c.plan) * c.quantity)}</span>
          </div>
        </li>`;
      })
      .join("");
  }
  $("submit-order-btn").disabled = state.cart.length === 0 || isLastOrderPassed();

  const count = state.cart.reduce((sum, c) => sum + c.quantity, 0);
  $("cart-bar-count").textContent = `カート ${count}点`;
}

function cartItemOf(target) {
  const li = target.closest(".order-line");
  return li ? state.cart[Number(li.dataset.index)] : null;
}

function onCartClick(e) {
  const button = e.target.closest("[data-act]");
  if (!button) return;
  const item = cartItemOf(button);
  if (!item) return;
  setCartQuantity(item, item.quantity + (button.dataset.act === "plus" ? 1 : -1));
}

function onCartChange(e) {
  if (!e.target.classList.contains("qty-input")) return;
  const item = cartItemOf(e.target);
  if (item) setCartQuantity(item, e.target.value);
}

// カートの数量を変える（0 でカートから外す）
function setCartQuantity(item, raw) {
  const result = checkInteger(raw, "数量", 0, 99);
  if (!result.ok) {
    showMessage(result.message, true);
  } else if (result.value === 0) {
    state.cart = state.cart.filter((c) => c !== item);
  } else {
    item.quantity = result.value;
  }
  saveCurrent();
  renderCart();
}

// カートの中身を注文確定する
function submitOrder() {
  if (blockIfLastOrderPassed()) return;
  if (state.cart.length === 0) {
    showMessage("カートが空です", true);
    return;
  }

  const findLine = (c) => state.lines.find((l) => l.menuId === c.menuId && l.plan === c.plan);
  const over = state.cart.find((c) => {
    const line = findLine(c);
    return line && line.quantity + c.quantity > 99;
  });
  if (over) {
    showMessage(`${findMenu(over.menuId).name} は1品99個までです（注文済みと合わせて）`, true);
    return;
  }

  let count = 0;
  state.cart.forEach((c) => {
    const menu = findMenu(c.menuId);
    const line = findLine(c);
    count += c.quantity;
    if (line) {
      line.quantity += c.quantity;
    } else {
      state.lines.push({
        lineId: "L" + state.nextLineNo++,
        menuId: menu.id,
        menuName: menu.name,
        category: menu.category,
        quantity: c.quantity,
        unitPrice: unitPriceOf(menu, c.plan),
        plan: c.plan,
      });
    }
  });
  state.cart = [];

  saveCurrent();
  renderCart();
  renderOrderList();
  showMessage(`ご注文を承りました（${count}点）`, false);
}

// ===== 注文済み =====
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
            ${planTag(l.plan)}
          </div>
          <div class="line-body">
            <div class="qty qty-small">
              <button type="button" class="qty-btn" data-act="minus" aria-label="1つ減らす">−</button>
              <input class="qty-input" type="text" inputmode="numeric" value="${l.quantity}" aria-label="数量">
            </div>
            <span class="line-price">${yen(l.unitPrice * l.quantity)}</span>
          </div>
        </li>`
      )
      .join("");
  }
  $("order-total").textContent = "現在のお会計（目安）：" + yen(calcBill().total);
}

function orderLineOf(target) {
  const li = target.closest(".order-line");
  return li ? state.lines.find((l) => l.lineId === li.dataset.line) : null;
}

function onOrderListClick(e) {
  const button = e.target.closest("[data-act]");
  if (!button) return;
  const line = orderLineOf(button);
  if (line) setLineQuantity(line, line.quantity - 1);
}

function onOrderListChange(e) {
  if (!e.target.classList.contains("qty-input")) return;
  const line = orderLineOf(e.target);
  if (line) setLineQuantity(line, e.target.value);
}

// 注文済みの数量を減らす（0 で取り消し）。増やすのはメニューから
function setLineQuantity(line, raw) {
  const result = checkInteger(raw, "数量", 0, 99);
  if (!result.ok) {
    showMessage(result.message, true);
  } else if (result.value > line.quantity) {
    showMessage("注文済みの数量は減らすことだけできます。追加はメニューから注文してください", true);
  } else if (result.value === 0) {
    state.lines = state.lines.filter((l) => l !== line);
    showMessage(`${line.menuName} を取り消しました`, false);
  } else {
    line.quantity = result.value;
  }
  saveCurrent();
  renderOrderList();
}

// ===== おすすめ・ランキング =====
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

// ===== 会計 =====
function calcBill() {
  const tabehodai = PRICE.tabehodai * state.customers.length;
  const drinkbar = PRICE.drinkbar * drinkbarCount();
  const tanpinDrink = state.lines
    .filter((l) => l.plan === PLAN_TANPIN)
    .reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

  return {
    tabehodai: tabehodai,
    drinkbar: drinkbar,
    tanpinDrink: tanpinDrink,
    total: tabehodai + drinkbar + tanpinDrink,
  };
}

// ===== ③ 会計確認画面 =====
function enterConfirmScreen() {
  const bill = calcBill();
  const rows = [
    ["食べ放題", `${yen(PRICE.tabehodai)} × ${state.customers.length}人`, bill.tabehodai],
    ["ドリンクバー", `${yen(PRICE.drinkbar)} × ${drinkbarCount()}人`, bill.drinkbar],
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
  $("bill-cart-note").hidden = state.cart.length === 0;
  showScreen("confirm");
}

// ===== ④ 会計確定 =====
function checkout() {
  const bill = calcBill();
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
    items: state.lines.filter((l) => !l.plan).map(toItem),
    drinkItems: state.lines.filter((l) => l.plan).map((l) => Object.assign(toItem(l), { plan: l.plan })),
    staffCalls: state.staffCalls,
    bill: Object.assign({}, bill, { confirmedAt: new Date().toISOString() }),
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
  stopClock();
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

  // 会計前の注文が残っていれば、注文画面から再開する（古い形のデータは使わない）
  const saved = loadJSON(STORAGE_CURRENT, null);
  if (saved && saved.version === DATA_VERSION && saved.status === "注文中" && Array.isArray(saved.customers)) {
    state = saved;
    enterOrderScreen();
  } else {
    removeKey(STORAGE_CURRENT);
    showScreen("reception");
  }
}

init();
