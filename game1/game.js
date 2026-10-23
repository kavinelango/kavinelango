(() => {
  "use strict";

  // ---------- Config ----------
  const YEAR_MIN = 1900;
  const YEAR_MAX = 2100;
  const MIN_CARDS = 4;
  const MAX_CARDS = 8;
  const ROW_HEIGHT = 48; // must match .wheel --row

  // Operator ids and how they display.
  const OPS = [
    { id: "+", label: "+" },
    { id: "-", label: "−" },
    { id: "*", label: "×" },
    { id: "/", label: "÷" },
  ];
  const OP_LABEL = Object.fromEntries(OPS.map((o) => [o.id, o.label]));

  const FACES = { 1: "A", 11: "J", 12: "Q", 13: "K" };
  const SUITS = ["♠", "♥", "♦", "♣"];

  // ---------- State ----------
  const state = {
    mode: "year",
    year: new Date().getFullYear(),
    randomTarget: randomTarget(),
    count: 6,
    target: 0,
    cards: [], // [{ id, value, suit }]
    ops: [], // operator between cards[i] and cards[i + 1]
    solution: null,
    won: false,
  };

  const $ = (id) => document.getElementById(id);

  // ---------- Math ----------
  function randomTarget() {
    return 1000 + Math.floor(Math.random() * 9000);
  }

  // Evaluate cards with the operators between them.
  // Precedence: × ÷ first, then + −.
  function evaluate(nums, ops) {
    const vals = nums.slice();
    const rest = ops.slice();

    for (let i = 0; i < rest.length; ) {
      if (rest[i] === "*" || rest[i] === "/") {
        const v = rest[i] === "*" ? vals[i] * vals[i + 1] : vals[i] / vals[i + 1];
        vals.splice(i, 2, v);
        rest.splice(i, 1);
      } else {
        i++;
      }
    }

    let total = vals[0];
    for (let i = 0; i < rest.length; i++) {
      total = rest[i] === "+" ? total + vals[i + 1] : total - vals[i + 1];
    }
    return Number.isFinite(total) ? total : NaN;
  }

  function isHit(value, target) {
    return Math.abs(value - target) < 1e-9;
  }

  function exprString(nums, ops) {
    let s = String(nums[0]);
    for (let i = 0; i < ops.length; i++) {
      s += ` ${OP_LABEL[ops[i]]} ${nums[i + 1]}`;
    }
    return s;
  }

  function formatNumber(v) {
    if (Number.isNaN(v)) return "—";
    if (Number.isInteger(v)) return String(v);
    return String(Math.round(v * 1000) / 1000);
  }

  // Search for an ordering + operators that hits the target.
  // Small hands are searched exhaustively; larger ones are sampled randomly
  // because 8 cards would be 40320 orderings × 4^7 operator choices.
  function solve(nums, target, budgetMs) {
    const deadline = performance.now() + budgetMs;
    const n = nums.length;
    const opIds = OPS.map((o) => o.id);

    if (n <= 5) {
      const ops = new Array(n - 1);
      let found = null;
      let ticks = 0;
      const tryOps = (perm, k) => {
        if (found) return;
        if (k === n - 1) {
          if (isHit(evaluate(perm, ops), target)) found = { nums: perm.slice(), ops: ops.slice() };
          return;
        }
        for (const op of opIds) {
          ops[k] = op;
          tryOps(perm, k + 1);
          if (found) return;
        }
      };
      const seen = new Set();
      const permute = (arr, k) => {
        if (found || performance.now() > deadline) return;
        if (k === n) {
          const key = arr.join(",");
          if (seen.has(key)) return; // duplicate card values give duplicate orderings
          seen.add(key);
          if (++ticks % 8 === 0 && performance.now() > deadline) return;
          tryOps(arr, 0);
          return;
        }
        for (let i = k; i < n; i++) {
          [arr[k], arr[i]] = [arr[i], arr[k]];
          permute(arr, k + 1);
          [arr[k], arr[i]] = [arr[i], arr[k]];
          if (found) return;
        }
      };
      permute(nums.slice(), 0);
      return found;
    }

    const perm = nums.slice();
    const ops = new Array(n - 1);
    let iter = 0;
    while (true) {
      if (++iter % 2048 === 0 && performance.now() > deadline) return null;
      shuffle(perm);
      for (let i = 0; i < n - 1; i++) ops[i] = opIds[(Math.random() * opIds.length) | 0];
      if (isHit(evaluate(perm, ops), target)) return { nums: perm.slice(), ops: ops.slice() };
    }
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- Setup screen ----------
  function buildWheel() {
    const wheel = $("wheel");
    const frag = document.createDocumentFragment();
    frag.appendChild(Object.assign(document.createElement("div"), { className: "pad" }));
    for (let y = YEAR_MIN; y <= YEAR_MAX; y++) {
      const el = document.createElement("div");
      el.className = "yr";
      el.textContent = y;
      el.dataset.year = y;
      el.addEventListener("click", () => scrollWheelTo(y, true));
      frag.appendChild(el);
    }
    frag.appendChild(Object.assign(document.createElement("div"), { className: "pad" }));
    wheel.appendChild(frag);

    let raf = 0;
    wheel.addEventListener("scroll", () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(syncWheel);
    });
    wheel.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        scrollWheelTo(state.year + (e.key === "ArrowUp" ? -1 : 1), true);
      }
    });
    scrollWheelTo(state.year, false);
    syncWheel();
  }

  function scrollWheelTo(year, smooth) {
    year = Math.min(YEAR_MAX, Math.max(YEAR_MIN, year));
    $("wheel").scrollTo({ top: (year - YEAR_MIN) * ROW_HEIGHT, behavior: smooth ? "smooth" : "auto" });
  }

  function syncWheel() {
    const wheel = $("wheel");
    const idx = Math.round(wheel.scrollTop / ROW_HEIGHT);
    const year = Math.min(YEAR_MAX, Math.max(YEAR_MIN, YEAR_MIN + idx));
    state.year = year;
    wheel.querySelectorAll(".yr.selected").forEach((el) => el.classList.remove("selected"));
    const sel = wheel.querySelector(`[data-year="${year}"]`);
    if (sel) sel.classList.add("selected");
  }

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll(".mode").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    $("year-picker").classList.toggle("hidden", mode !== "year");
    $("random-picker").classList.toggle("hidden", mode !== "random");
    if (mode === "year") scrollWheelTo(state.year, false);
  }

  function setCount(n) {
    state.count = Math.min(MAX_CARDS, Math.max(MIN_CARDS, n));
    $("count").textContent = state.count;
  }

  // ---------- Dealing ----------
  let nextId = 1;

  function randomHand(n) {
    return Array.from({ length: n }, () => ({
      id: nextId++,
      value: 1 + Math.floor(Math.random() * 13),
      suit: SUITS[(Math.random() * 4) | 0],
    }));
  }

  // Build a winnable hand backwards from the target: a sum of product terms
  // (like 13 × 12 × 13 − 2), each term aimed at whatever is still left over.
  function construct(n, target, budgetMs) {
    const deadline = performance.now() + budgetMs;
    const rand = () => 1 + ((Math.random() * 13) | 0);
    while (performance.now() < deadline) {
      for (let attempt = 0; attempt < 500; attempt++) {
        const nums = [];
        const ops = [];
        let rem = target;
        let left = n;
        while (left > 0) {
          const m = 1 + ((Math.random() * Math.min(left, 4)) | 0);
          const after = left - m;
          const sign = nums.length === 0 || rem > 0 ? 1 : rem < 0 ? -1 : Math.random() < 0.5 ? 1 : -1;
          // Leave a little for the cards after this term to make up.
          const want = Math.max(1, Math.abs(rem) - (after ? (Math.random() * after * 8) | 0 : 0));
          const term = [];
          let prod = 1;
          for (let k = 0; k < m - 1; k++) {
            const v = rand();
            term.push(v);
            prod *= v;
          }
          const last = Math.min(13, Math.max(1, Math.round(want / prod)));
          term.push(last);
          prod *= last;

          if (nums.length) ops.push(sign > 0 ? "+" : "-");
          term.forEach((v, k) => {
            if (k) ops.push("*");
            nums.push(v);
          });
          rem -= sign * prod;
          left = after;
        }
        if (rem === 0 && isHit(evaluate(nums, ops), target)) return { nums, ops };
      }
    }
    return null;
  }

  function deal() {
    let solution = construct(state.count, state.target, 400);
    let hand;
    if (solution) {
      hand = shuffle(solution.nums.map((value) => ({
        id: nextId++,
        value,
        suit: SUITS[(Math.random() * 4) | 0],
      })));
    } else {
      // Fall back to dealing random hands and searching them.
      const start = performance.now();
      do {
        hand = randomHand(state.count);
        solution = solve(hand.map((c) => c.value), state.target, 200);
      } while (!solution && performance.now() - start < 1200);
    }

    state.cards = hand;
    state.ops = new Array(state.count - 1).fill("+");
    state.solution = solution;
    state.won = false;
    $("solution").textContent = "";
    $("board").classList.remove("settled");
    render();
    // After the deal animation, stop re-animating on every reorder.
    setTimeout(() => $("board").classList.add("settled"), 400);
  }

  function startGame() {
    state.target = state.mode === "year" ? state.year : state.randomTarget;
    $("target").textContent = state.target;
    $("setup").classList.add("hidden");
    $("game").classList.remove("hidden");
    $("board").innerHTML = '<p class="hint-text">Dealing…</p>';
    // Let the "Dealing…" text paint before the solver runs.
    setTimeout(deal, 30);
  }

  // ---------- Rendering ----------
  function cardFace(value) {
    return FACES[value] || String(value);
  }

  function createCardEl(card) {
    const el = document.createElement("div");
    el.className = "card" + (card.suit === "♥" || card.suit === "♦" ? " red" : "");
    el.dataset.id = card.id;
    const face = cardFace(card.value);
    el.innerHTML =
      `<span class="corner tl">${face}<br>${card.suit}</span>` +
      `<span class="value">${card.value}</span>` +
      `<span class="corner br">${face}<br>${card.suit}</span>`;
    el.addEventListener("pointerdown", onCardPointerDown);
    return el;
  }

  function createSlotEl(i) {
    const el = document.createElement("button");
    const op = state.ops[i];
    el.className = "slot";
    el.textContent = OP_LABEL[op];
    el.setAttribute("aria-label", `Operation ${i + 1}: ${op}`);
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      openOpMenu(i, el);
    });
    return el;
  }

  function render() {
    const board = $("board");
    // FLIP: remember where each card was so reorders animate smoothly.
    const before = new Map();
    board.querySelectorAll(".card").forEach((el) => before.set(el.dataset.id, el.getBoundingClientRect()));

    board.innerHTML = "";
    state.cards.forEach((card, i) => {
      const el = createCardEl(card);
      if (drag && drag.id === card.id) el.classList.add("placeholder");
      if (board.classList.contains("settled")) el.style.animation = "none";
      board.appendChild(el);
      if (i < state.cards.length - 1) board.appendChild(createSlotEl(i));
    });

    board.querySelectorAll(".card").forEach((el) => {
      const prev = before.get(el.dataset.id);
      if (!prev) return;
      const now = el.getBoundingClientRect();
      const dx = prev.left - now.left;
      const dy = prev.top - now.top;
      if (dx || dy) {
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
          duration: 180,
          easing: "ease-out",
        });
      }
    });

    updateResult();
  }

  function updateResult() {
    const nums = state.cards.map((c) => c.value);
    const value = evaluate(nums, state.ops);
    $("result").textContent = formatNumber(value);
    $("expr").textContent = exprString(nums, state.ops) + " = " + formatNumber(value);

    const diffEl = $("diff");
    if (Number.isNaN(value)) {
      diffEl.textContent = "";
    } else {
      const d = Math.abs(value - state.target);
      diffEl.textContent = isHit(value, state.target) ? "Exact!" : `${formatNumber(d)} away`;
      diffEl.classList.toggle("close", d <= state.target * 0.05);
    }

    if (!state.won && !drag && isHit(value, state.target)) {
      state.won = true;
      $("win-expr").textContent = `${exprString(nums, state.ops)} = ${state.target}`;
      setTimeout(() => $("win").classList.remove("hidden"), 250);
    }
  }

  // ---------- Operator menu ----------
  let menuSlot = -1;

  function openOpMenu(i, anchor) {
    const menu = $("op-menu");
    menuSlot = i;
    menu.innerHTML = "";
    OPS.forEach((op) => {
      const b = document.createElement("button");
      b.textContent = op.label;
      if (op.id === state.ops[i]) b.className = "current";
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        state.ops[menuSlot] = op.id;
        closeOpMenu();
        render();
      });
      menu.appendChild(b);
    });
    menu.classList.remove("hidden");

    const r = anchor.getBoundingClientRect();
    const m = menu.getBoundingClientRect();
    let left = r.left + r.width / 2 - m.width / 2;
    left = Math.max(8, Math.min(window.innerWidth - m.width - 8, left));
    let top = r.bottom + 8;
    if (top + m.height > window.innerHeight - 8) top = r.top - m.height - 8;
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  function closeOpMenu() {
    $("op-menu").classList.add("hidden");
    menuSlot = -1;
  }

  // ---------- Drag & drop (pointer events: mouse + touch) ----------
  let drag = null; // { id, ghost, offsetX, offsetY, startX, startY, active }

  function onCardPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    closeOpMenu();
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    drag = {
      id: Number(el.dataset.id),
      el,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      ghost: null,
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }

  function onPointerMove(e) {
    if (!drag) return;
    if (!drag.active) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5) return;
      drag.active = true;
      const ghost = drag.el.cloneNode(true);
      ghost.classList.add("dragging");
      document.body.appendChild(ghost);
      drag.ghost = ghost;
      drag.el.classList.add("placeholder");
    }
    drag.ghost.style.left = `${e.clientX - drag.offsetX}px`;
    drag.ghost.style.top = `${e.clientY - drag.offsetY}px`;

    // Find the card under the pointer and move the dragged card into its spot.
    const from = state.cards.findIndex((c) => c.id === drag.id);
    let to = -1;
    $("board").querySelectorAll(".card").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        to = state.cards.findIndex((c) => c.id === Number(el.dataset.id));
      }
    });
    if (to !== -1 && to !== from) {
      const [card] = state.cards.splice(from, 1);
      state.cards.splice(to, 0, card);
      render();
    }
  }

  function onPointerUp() {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    if (!drag) return;
    const wasActive = drag.active;
    const ghost = drag.ghost;
    const id = drag.id;
    drag = null;
    if (!wasActive) return;

    // Fly the ghost back into the card's new slot, then drop it in.
    const target = $("board").querySelector(`.card[data-id="${id}"]`);
    if (target && ghost) {
      const r = target.getBoundingClientRect();
      const anim = ghost.animate(
        [{}, { left: `${r.left}px`, top: `${r.top}px`, transform: "none" }],
        { duration: 140, easing: "ease-out", fill: "forwards" }
      );
      anim.onfinish = () => {
        ghost.remove();
        target.classList.remove("placeholder");
        updateResult();
      };
    } else {
      if (ghost) ghost.remove();
      render();
    }
  }

  // ---------- Wiring ----------
  function init() {
    buildWheel();
    $("random-number").textContent = state.randomTarget;

    document.querySelectorAll(".mode").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
    $("reroll").addEventListener("click", () => {
      state.randomTarget = randomTarget();
      $("random-number").textContent = state.randomTarget;
    });
    $("count-down").addEventListener("click", () => setCount(state.count - 1));
    $("count-up").addEventListener("click", () => setCount(state.count + 1));
    $("start").addEventListener("click", startGame);

    $("reshuffle").addEventListener("click", () => {
      $("board").innerHTML = '<p class="hint-text">Dealing…</p>';
      setTimeout(deal, 30);
    });
    $("hint").addEventListener("click", () => {
      const s = state.solution;
      $("solution").textContent = s
        ? `${exprString(s.nums, s.ops)} = ${state.target}`
        : `No solution found with ${state.count} cards. Try more cards.`;
    });
    $("back").addEventListener("click", () => {
      $("game").classList.add("hidden");
      $("setup").classList.remove("hidden");
      if (state.mode === "year") scrollWheelTo(state.year, false);
    });
    $("again").addEventListener("click", () => {
      $("win").classList.add("hidden");
      $("game").classList.add("hidden");
      $("setup").classList.remove("hidden");
      if (state.mode === "random") {
        state.randomTarget = randomTarget();
        $("random-number").textContent = state.randomTarget;
      } else {
        scrollWheelTo(state.year, false);
      }
    });

    document.addEventListener("click", (e) => {
      if (!$("op-menu").contains(e.target)) closeOpMenu();
    });
    window.addEventListener("resize", closeOpMenu);
  }

  init();
})();
