(function () {
  const STORAGE_KEY = "frankenstein-30-noites-v2";
  const STORAGE_KEY_V1 = "frankenstein-30-noites-v1";
  const STORAGE_BACKUP = "frankenstein-30-noites-v2-bak";
  const WEEKDAYS = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];
  const MONTHS = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];
  const EMPTY_LOG = {
    a1: "",
    a2: "",
    letter: "",
    quote: "",
    done: false,
    checked: false,
  };

  const SESSIONS = window.SESSIONS;

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function toIso(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function fromIso(iso) {
    const p = iso.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function addDays(iso, n) {
    const d = fromIso(iso);
    d.setDate(d.getDate() + n);
    return d;
  }

  function formatDate(d) {
    return WEEKDAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()];
  }

  function todayIso() {
    return toIso(new Date());
  }

  function tomorrowIso() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toIso(d);
  }

  function nextMondayIso() {
    const d = new Date();
    const day = d.getDay();
    const add = day === 1 ? 7 : (8 - day) % 7 || 7;
    d.setDate(d.getDate() + add);
    return toIso(d);
  }

  function readStorage(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function writeStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function loadState() {
    return (
      readStorage(STORAGE_KEY) ||
      readStorage(STORAGE_BACKUP) ||
      readStorage(STORAGE_KEY_V1)
    );
  }

  const saved = loadState() || {};
  const state = {
    startDate: saved.startDate || todayIso(),
    logs: saved.logs || {},
    openId: saved.openId || "d01",
    savedAt: saved.savedAt || null,
  };
  if (saved && saved.logs) persist();

  let renderTimer = null;

  function persist() {
    state.savedAt = new Date().toISOString();
    try {
      writeStorage(STORAGE_KEY, state);
      writeStorage(STORAGE_BACKUP, state);
    } catch (err) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (ignored) {}
    }
  }

  function persistAndRefresh(immediate) {
    persist();
    if (immediate) {
      clearTimeout(renderTimer);
      render();
      return;
    }
    clearTimeout(renderTimer);
    renderTimer = setTimeout(function () {
      render();
    }, 400);
  }

  function snapshotFocus() {
    const node = document.activeElement;
    if (!node || !node.getAttribute) return null;
    const field = node.getAttribute("data-field");
    if (!field) return null;
    return {
      field: field,
      start: node.selectionStart,
      end: node.selectionEnd,
      scroll: node.scrollTop,
    };
  }

  function restoreFocus(snap) {
    if (!snap) return;
    const node = document.querySelector("[data-field='" + snap.field + "']");
    if (!node) return;
    node.focus();
    if (typeof node.setSelectionRange === "function" && snap.start != null) {
      node.setSelectionRange(snap.start, snap.end);
    }
    if (snap.scroll != null) node.scrollTop = snap.scroll;
  }

  function formatSavedAt(iso) {
    if (!iso) return "ainda não salvou";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "salvo neste aparelho";
    return (
      "salvo às " +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes())
    );
  }

  function exportCaderno() {
    persist();
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "frankenstein-caderno.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 500);
  }

  function importCaderno(file) {
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const data = JSON.parse(String(reader.result || ""));
        if (!data || typeof data !== "object") throw new Error("arquivo inválido");
        state.startDate = data.startDate || state.startDate;
        state.logs = data.logs || {};
        state.openId = data.openId || "d01";
        persistAndRefresh(true);
      } catch (err) {
        alert("Não consegui ler esse caderno. Use o arquivo JSON baixado daqui.");
      }
    };
    reader.readAsText(file);
  }

  window.addEventListener("pagehide", persist);
  window.addEventListener("beforeunload", persist);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") persist();
  });

  function getLog(id) {
    const cur = state.logs[id];
    return cur ? Object.assign({}, EMPTY_LOG, cur) : Object.assign({}, EMPTY_LOG);
  }

  function patchLog(id, patch) {
    state.logs[id] = Object.assign({}, getLog(id), patch);
    persist();
    render();
  }

  function attentionScore(session, log) {
    let n = 0;
    if (log.a1 === session.attention[0].correct) n += 1;
    if (log.a2 === session.attention[1].correct) n += 1;
    return n;
  }

  function todayIndex() {
    const today = todayIso();
    return SESSIONS.findIndex(function (_, i) {
      return toIso(addDays(state.startDate, i)) === today;
    });
  }

  function isUnlocked(index, tIndex) {
    if (index === 0) return true;
    if (tIndex >= 0) return index <= tIndex;
    const start = fromIso(state.startDate);
    const now = fromIso(todayIso());
    if (now < start) return false;
    return true;
  }

  function el(tag, props) {
    const node = document.createElement(tag);
    const kids = Array.prototype.slice.call(arguments, 2);
    if (props) {
      Object.keys(props).forEach(function (key) {
        const val = props[key];
        if (val == null || val === false) return;
        if (key === "class") node.className = val;
        else if (key === "text") node.textContent = val;
        else if (key === "html") node.innerHTML = val;
        else if (key.slice(0, 2) === "on") node.addEventListener(key.slice(2).toLowerCase(), val);
        else if (key === "checked") node.checked = val;
        else if (key === "disabled") node.disabled = val;
        else if (key === "value") node.value = val;
        else node.setAttribute(key, val === true ? "" : val);
      });
    }
    kids.flat().forEach(function (child) {
      if (child == null || child === false) return;
      if (typeof child === "string") node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    });
    return node;
  }

  function groupByPhase() {
    const groups = [];
    SESSIONS.forEach(function (session) {
      const last = groups[groups.length - 1];
      if (!last || last.phase !== session.phase) {
        groups.push({ phase: session.phase, items: [session] });
      } else {
        last.items.push(session);
      }
    });
    return groups;
  }

  function renderPills(options, value, onPick) {
    return el(
      "div",
      { class: "pills" },
      options.map(function (opt) {
        return el("button", {
          class: "pill" + (value === opt ? " active" : ""),
          type: "button",
          text: opt,
          onClick: function () {
            onPick(value === opt ? "" : opt);
          },
        });
      })
    );
  }

  function questionBlock(question, value, revealed, onChange) {
    const hit = value === question.correct;
    return el(
      "div",
      { class: "q" },
      el("p", { text: question.prompt }),
      renderPills(question.options, value, onChange),
      revealed && value
        ? el("div", {
            class: "feedback " + (hit ? "ok" : "warn"),
            text: hit
              ? "Você estava na página. A reflexão abaixo ainda vale — atenção não é o mesmo que ter o que dizer."
              : question.hint,
          })
        : null
    );
  }

  function renderMission(session, index, tIndex) {
    const log = getLog(session.id);
    const unlocked = isUnlocked(index, tIndex);
    const isToday = index === tIndex;
    const canCheck = Boolean(log.a1 && log.a2);
    const score = attentionScore(session, log);
    const hasLetter = log.letter.trim().length > 0;
    const showReply = hasLetter || log.done;
    const dateLabel = formatDate(addDays(state.startDate, index));

    const body = [
      el("div", { class: "card-head" },
        el("span", { text: isToday ? "Missão de hoje" : "Dia " + (index + 1) }),
        el("span", {
          text: session.kind === "rest" ? "folga" : log.done ? "feita" : session.minutes + " min",
        })
      ),
      el("h2", { text: session.reading }),
      el("p", {
        class: "hint",
        text: isToday ? dateLabel + " · hoje" : dateLabel,
      }),
    ];

    if (!unlocked) {
      body.push(el("p", {
        class: "hint",
        text: "As perguntas desta seção ainda não abriram. Assim o capítulo da frente não estraga o de agora.",
      }));
      return el("section", { class: "card", id: "missao" }, body);
    }

    body.push(
      el("p", {
        class: "hint",
        text: session.kind === "read"
          ? "Introdução fora. Teto: " + session.minutes + " min. Se a paciência acabar, feche o livro e responda só o que ficou."
          : "Folga de leitura. As duas primeiras perguntas são de memória.",
      }),
      el("label", { class: "tiny", text: "Enquanto lê" }),
      el("p", { text: session.whileReading }),
      el("label", { class: "tiny", text: "Olho na página — você leu mesmo?" }),
      questionBlock(session.attention[0], log.a1, log.checked, function (v) {
        patchLog(session.id, { a1: v, checked: false });
      }),
      questionBlock(session.attention[1], log.a2, log.checked, function (v) {
        patchLog(session.id, { a2: v, checked: false });
      }),
      el("div", { class: "row" },
        el("button", {
          class: "btn",
          type: "button",
          disabled: !canCheck,
          text: log.checked ? "Atenção conferida" : "Conferir atenção",
          onClick: function () {
            if (!canCheck) return;
            patchLog(session.id, { checked: true });
          },
        }),
        el("span", {
          class: "meta",
          text: log.checked
            ? score + "/2 nesta seção"
            : "Responda as duas, depois confira. Sem chute às cegas.",
        })
      ),
      el("label", { class: "tiny", text: "Para pensar — duas linhas para " + session.letterTo }),
      el("p", { text: session.ask })
    );

    const letterBox = el("textarea", {
      value: log.letter,
      placeholder: "Pode ser feio. Pode ser uma linha. Aqui não tem certo.",
      "data-field": "letter",
    });
    letterBox.addEventListener("input", function () {
      state.logs[session.id] = Object.assign({}, getLog(session.id), {
        letter: letterBox.value,
      });
      persistAndRefresh(false);
    });
    body.push(letterBox);

    const quoteBox = el("input", {
      type: "text",
      value: log.quote,
      placeholder: "Frase da página que grudou, se houver",
      "data-field": "quote",
    });
    quoteBox.addEventListener("input", function () {
      state.logs[session.id] = Object.assign({}, getLog(session.id), {
        quote: quoteBox.value,
      });
      persistAndRefresh(false);
    });
    body.push(quoteBox);

    if (showReply) {
      body.push(el("p", { class: "reply", text: "O livro, a " + session.letterTo + ": " + session.bookReply }));
    }

    if (session.kind === "read") {
      body.push(el("div", { class: "row" },
        el("button", {
          class: "btn" + (log.done ? " ghost" : ""),
          type: "button",
          text: log.done ? "Desmarcar leitura" : "Marcar como lida",
          onClick: function () {
            patchLog(session.id, { done: !log.done });
          },
        }),
        el("span", {
          class: "meta",
          text: log.done ? "Noite cumprida." : "Vale mesmo se parou no meio.",
        })
      ));
    }

    return el("section", { class: "card", id: "missao" }, body);
  }

  function renderCorrespondence() {
    const entries = [];
    SESSIONS.forEach(function (session, index) {
      const log = getLog(session.id);
      if (!log.letter.trim() && !log.checked && !log.quote.trim()) return;
      entries.push({
        session: session,
        log: log,
        dateLabel: formatDate(addDays(state.startDate, index)),
        day: index + 1,
        score: log.checked ? attentionScore(session, log) : null,
      });
    });
    if (!entries.length) return null;

    return el(
      "section",
      null,
      el("h2", { text: "Sua correspondência com o livro" }),
      el("p", {
        class: "hint",
        text: "O que você escreveu e marcou fica guardado. Fecha o site e abre de novo: o caderno continua aqui.",
      }),
      entries.map(function (item) {
        return el(
          "div",
          { class: "card" },
          el("div", { class: "meta" },
            "Dia " + item.day + " · " + item.dateLabel + " · " + item.session.reading +
            (item.score !== null ? " · atenção " + item.score + "/2" : "")
          ),
          item.log.letter.trim() ? el("p", { class: "letter", text: item.log.letter.trim() }) : null,
          item.log.quote.trim() ? el("p", { class: "reply", text: "“" + item.log.quote.trim() + "”" }) : null,
          item.log.letter.trim() || item.log.done
            ? el("p", { class: "meta", text: item.session.bookReply })
            : null
        );
      })
    );
  }

  function render() {
    const focus = snapshotFocus();
    const tIndex = todayIndex();
    const reading = SESSIONS.filter(function (s) { return s.kind === "read"; });
    const doneCount = reading.filter(function (s) { return getLog(s.id).done; }).length;
    const pct = Math.round((doneCount / reading.length) * 100);
    const endDate = addDays(state.startDate, SESSIONS.length - 1);
    const checkedNights = SESSIONS.filter(function (s) { return getLog(s.id).checked; }).length;
    const hits = SESSIONS.reduce(function (sum, s) {
      const log = getLog(s.id);
      return sum + (log.checked ? attentionScore(s, log) : 0);
    }, 0);
    const lettersCount = SESSIONS.filter(function (s) { return getLog(s.id).letter.trim(); }).length;
    const allDone = doneCount === reading.length;

    let streak = 0;
    if (tIndex >= 0) {
      for (let i = tIndex; i >= 0; i -= 1) {
        const s = SESSIONS[i];
        if (s.kind === "rest" || getLog(s.id).done) streak += 1;
        else break;
      }
    }

    const openSession = SESSIONS.find(function (s) { return s.id === state.openId; })
      || (tIndex >= 0 ? SESSIONS[tIndex] : SESSIONS[0]);
    const openIndex = SESSIONS.indexOf(openSession);

    const today = todayIso();
    const startChoices = [
      { id: today, label: "Hoje" },
      { id: tomorrowIso(), label: "Amanhã" },
      { id: nextMondayIso(), label: "Próxima segunda" },
    ];

    const root = el("div", { class: "wrap" },
      el("p", { class: "kicker", text: "Mary Shelley · 30 noites" }),
      el("h1", { text: "Frankenstein em 30 noites" }),
      el("p", {
        class: "lede",
        text: "Sem introdução: o livro começa na Carta I. Cada seção tem duas perguntas para saber se você estava na página, e uma para pensar o que leu. As seções da frente ficam fechadas.",
      }),
      el("div", { class: "save-bar" },
        el("b", { text: formatSavedAt(state.savedAt) }),
        el("span", { text: " · cartas, atenção e noites ficam neste navegador" }),
        el("button", {
          class: "btn ghost",
          type: "button",
          text: "Baixar caderno",
          onClick: exportCaderno,
        }),
        (function () {
          const file = el("input", {
            type: "file",
            accept: "application/json,.json",
            style: "display:none",
          });
          file.addEventListener("change", function () {
            if (file.files && file.files[0]) importCaderno(file.files[0]);
            file.value = "";
          });
          const btn = el("button", {
            class: "btn ghost",
            type: "button",
            text: "Trazer caderno",
            onClick: function () {
              file.click();
            },
          });
          return el("span", null, file, btn);
        })()
      ),
      el("div", { class: "stats" },
        el("div", { class: "stat" }, el("b", { text: "Carta I" }), el("span", { text: "ponto de partida" })),
        el("div", { class: "stat ice" },
          el("b", { text: checkedNights > 0 ? hits + "/" + (checkedNights * 2) : "0/0" }),
          el("span", { text: "atenção conferida" })
        ),
        el("div", { class: "stat" + (allDone ? " ok" : "") },
          el("b", { text: doneCount + "/" + reading.length }),
          el("span", { text: "noites lidas" })
        ),
        streak > 0
          ? el("div", { class: "stat ok" }, el("b", { text: streak + "d" }), el("span", { text: "noites seguidas" }))
          : el("div", { class: "stat" }, el("b", { text: formatDate(endDate) }), el("span", { text: "término previsto" }))
      ),
      el("div", { class: "note" },
        el("strong", { text: "Como funciona cada seção" }),
        document.createTextNode("Lê. Responde duas de olho na página — uma delas costuma pegar quem só lembra do filme. Confere. Depois duas linhas de reflexão, sem certo ou errado. Folga testa memória, não página nova.")
      ),
      el("label", { class: "tiny", text: "Começar em" }),
      el("div", { class: "pills" },
        startChoices.map(function (choice) {
          return el("button", {
            class: "pill" + (state.startDate === choice.id ? " active" : ""),
            type: "button",
            text: choice.label,
            onClick: function () {
              state.startDate = choice.id;
              persist();
              render();
            },
          });
        })
      ),
      el("div", { class: "bar" }, el("i", { style: "width:" + pct + "%" })),
      el("div", { class: "bar-meta" },
        el("span", {
          text: allDone ? "Livro concluído" : doneCount === 0 ? "Nenhuma noite ainda" : pct + "% lido",
        }),
        el("span", { text: doneCount + " de " + reading.length + " noites" })
      ),
      allDone
        ? el("div", { class: "note" },
            el("strong", { text: "As 30 noites acabaram" }),
            document.createTextNode("Vale voltar à Carta I: o Polo muda de sentido quando você já respondeu o fim.")
          )
        : null,
      renderMission(openSession, openIndex, tIndex),
      renderCorrespondence(),
      el("h2", { text: "As 30 noites" }),
      el("p", {
        class: "hint",
        text: "Toque o dia para abrir as perguntas daquela seção. O futuro permanece fechado.",
      })
    );

    groupByPhase().forEach(function (group) {
      const startIndex = SESSIONS.indexOf(group.items[0]);
      root.appendChild(el("h3", { text: group.phase }));
      group.items.forEach(function (session, offset) {
        const index = startIndex + offset;
        const log = getLog(session.id);
        const date = addDays(state.startDate, index);
        const unlocked = isUnlocked(index, tIndex);
        const isOpen = session.id === openSession.id;
        const isTodayRow = index === tIndex;
        const score = log.checked ? attentionScore(session, log) : null;

        const check = session.kind === "read"
          ? el("input", {
              type: "checkbox",
              checked: log.done,
              onChange: function (ev) {
                patchLog(session.id, { done: ev.target.checked });
              },
            })
          : el("span", { class: "meta", text: "—" });

        root.appendChild(el("div", { class: "night" },
          check,
          el("div", { class: "night-body" },
            el("div", { class: "meta" },
              "Dia " + (index + 1) +
              (session.kind === "rest" ? " · folga" : log.done ? " · lida" : "") +
              " · " + formatDate(date) + " ",
              isTodayRow ? el("span", { class: "today-mark", text: "hoje" }) : null,
              score !== null ? " · atenção " + score + "/2" : "",
              log.letter.trim() ? " · reflexão escrita" : ""
            ),
            el("div", { text: session.reading }),
            el("div", { class: "row" },
              el("button", {
                class: "btn ghost",
                type: "button",
                text: isOpen ? "Perguntas abertas" : unlocked ? "Abrir perguntas" : "Ainda fechada",
                onClick: function () {
                  state.openId = session.id;
                  persist();
                  render();
                  const card = document.getElementById("missao");
                  if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
                },
              })
            )
          )
        ));
      });
    });

    if (doneCount > 0 || lettersCount > 0 || checkedNights > 0) {
      root.appendChild(el("div", { class: "row" },
        el("button", {
          class: "btn quiet",
          type: "button",
          text: "Apagar respostas e progresso",
          onClick: function () {
            if (!confirm("Apagar cartas, atenção e noites marcadas neste aparelho?")) return;
            state.logs = {};
            persist();
            render();
          },
        })
      ));
    }

    root.appendChild(el("p", {
      class: "foot",
      text: "27 noites de leitura, 3 folgas de memória. Começa na Carta I. O caderno (respostas, reflexões, noites lidas) salva sozinho neste navegador, como no plano do Cursor. Perguntas sem spoiler até o dia abrir.",
    }));

    const app = document.getElementById("app");
    app.innerHTML = "";
    app.appendChild(root);
    restoreFocus(focus);
  }

  render();
})();
