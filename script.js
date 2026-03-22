const VARIANTS = Object.keys(tests);
const variantLabels = {
  variant6: '6-нұсқа',
  variant8: '8-нұсқа',
  variant12: '12-нұсқа',
  variant14: '14-нұсқа'
};

function getUsedVariants() {
  return JSON.parse(localStorage.getItem('usedVariants') || '[]');
}

function setUsedVariants(arr) {
  localStorage.setItem('usedVariants', JSON.stringify(arr));
}

function pickRandomVariant() {
  let used = getUsedVariants();
  let available = VARIANTS.filter(v => !used.includes(v));

  if (!available.length) {
    used = [];
    available = [...VARIANTS];
    setUsedVariants([]);
  }

  const chosen = available[Math.floor(Math.random() * available.length)];
  used.push(chosen);
  setUsedVariants(used);
  localStorage.setItem('currentVariant', chosen);

  return chosen;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[s]));
}

function renderQuestion(q) {
  const typeLabel =
    q.type === 'single'
      ? 'Бір жауап'
      : q.type === 'matching'
      ? 'Сәйкестендіру'
      : 'Бірнеше жауап';

  let html = `
    <section class="question-card" data-q="${q.number}">
      <div class="q-meta">
        <div class="q-number">${q.number}-сұрақ</div>
        <div class="q-type">${typeLabel}</div>
      </div>
      <div class="q-text">${escapeHtml(q.question)}</div>
  `;

  if (q.image) {
    html += `<img class="q-image" src="${q.image}" alt="${q.number}-сұрақ суреті">`;
  }

  if (q.type === 'single') {
    html += `<div class="options">`;
    q.options.forEach((opt, idx) => {
      html += `
        <label class="option">
          <input type="radio" name="q${q.number}" value="${idx}">
          <span>${String.fromCharCode(65 + idx)}. ${escapeHtml(opt)}</span>
        </label>
      `;
    });
    html += `</div>`;
  }

  else if (q.type === 'matching') {
    html += `<div class="match-grid">`;
    html += `<div class="small">Әр қатарға дұрыс нөмірді таңда.</div>`;

    if (q.choices?.length) {
      html += `
        <div class="small">
          Нұсқалар:
          ${q.choices.map((c, i) => `${i + 1}) ${escapeHtml(c)}`).join(' | ')}
        </div>
      `;
    }

    q.pairs.forEach(pair => {
      html += `
        <div class="match-row">
          <div class="option">
            <strong>${pair.label.toUpperCase()})</strong>&nbsp; ${escapeHtml(pair.text)}
          </div>
          <select name="q${q.number}_${pair.label}">
            <option value="">Таңда</option>
            ${q.choices.map((_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
          </select>
        </div>
      `;
    });

    html += `</div>`;
  }

  else if (q.type === 'multi') {
    html += `<div class="options">`;
    q.options.forEach((opt, idx) => {
      html += `
        <label class="option">
          <input type="checkbox" name="q${q.number}" value="${idx}">
          <span>${String.fromCharCode(65 + idx)}. ${escapeHtml(opt)}</span>
        </label>
      `;
    });
    html += `</div>`;
  }

  html += `</section>`;
  return html;
}

function scoreQuiz(variant) {
  const questions = tests[variant];
  let score = 0;
  const max = questions.length;

  questions.forEach(q => {
    if (q.type === 'single') {
      const selected = document.querySelector(`input[name="q${q.number}"]:checked`);
      if (selected && Number(selected.value) === q.answer) {
        score += 1;
      }
    }

    else if (q.type === 'matching') {
      const correct = q.pairs.every(pair => {
        const el = document.querySelector(`select[name="q${q.number}_${pair.label}"]`);
        return el && Number(el.value) === Number(pair.answer);
      });
      if (correct) {
        score += 1;
      }
    }

    else if (q.type === 'multi') {
      const selected = Array.from(
        document.querySelectorAll(`input[name="q${q.number}"]:checked`)
      )
        .map(el => Number(el.value))
        .sort((a, b) => a - b);

      const correct = [...q.answers].sort((a, b) => a - b);

      if (JSON.stringify(selected) === JSON.stringify(correct)) {
        score += 1;
      }
    }
  });

  return { score, max };
}

function saveResult(variant, score, max) {
  const results = JSON.parse(localStorage.getItem('results') || '[]');

  results.push({
    variant,
    variantLabel: variantLabels[variant] || variant,
    score,
    max,
    date: new Date().toLocaleString()
  });

  localStorage.setItem('results', JSON.stringify(results));
}

function initTestPage() {
  const form = document.getElementById('quizForm');
  if (!form) return;

  const variant = pickRandomVariant();
  document.getElementById('variantBadge').textContent = variantLabels[variant] || variant;
  form.innerHTML = tests[variant].map(renderQuestion).join('');

  document.getElementById('submitBtn').addEventListener('click', () => {
    const { score, max } = scoreQuiz(variant);
    saveResult(variant, score, max);

    const box = document.getElementById('resultBox');
    box.hidden = false;
    box.classList.toggle('good', score >= Math.round(max * 0.7));
    box.classList.toggle('bad', score < Math.round(max * 0.7));

    document.getElementById('scoreText').textContent =
      `${variantLabels[variant]} бойынша нәтиже: ${score} / ${max}`;

    document.getElementById('nextBtn').hidden = false;

    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: 'smooth'
    });
  });

  document.getElementById('nextBtn').addEventListener('click', () => location.reload());
}

function initTeacherPage() {
  const list = document.getElementById('resultsList');
  if (!list) return;

  const results = JSON.parse(localStorage.getItem('results') || '[]');
  const summary = document.getElementById('teacherSummary');

  if (!results.length) {
    summary.innerHTML = '<h2>Әзірге нәтиже жоқ</h2><p class="small">Алдымен тестті орындап шық.</p>';
    list.innerHTML = '';
  } else {
    const avg = (results.reduce((s, r) => s + r.score, 0) / results.length).toFixed(2);

    summary.innerHTML = `
      <h2>Жалпы статистика</h2>
      <p><strong>Тапсырылған тест саны:</strong> ${results.length}</p>
      <p><strong>Орташа ұпай:</strong> ${avg}</p>
    `;

    list.className = 'result-list';
    list.innerHTML = results.slice().reverse().map(r => `
      <div class="result-item">
        <strong>${r.variantLabel}</strong>
        <div>${r.score} / ${r.max}</div>
        <div class="small">${r.date}</div>
      </div>
    `).join('');
  }

  const clearBtn = document.getElementById('clearResultsBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      localStorage.removeItem('results');
      localStorage.removeItem('usedVariants');
      location.reload();
    });
  }
}

function initBotPage() {
  const btn = document.getElementById('askBotBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const text = (document.getElementById('botInput').value || '').toLowerCase();

    let answer =
      'Бұл тақырып бойынша қысқа түсіндірме: негізгі ұғымды анықтап, дұрыс терминді және механизмді есте сақта.';

    if (text.includes('резус')) {
      answer =
        'Резус-конфликт анасы резус-теріс, ал ұрық резус-оң болғанда пайда болуы мүмкін. Бұл кезде ана ағзасы ұрық эритроциттеріне қарсы антидене түзуі ықтимал.';
    } else if (text.includes('митоз')) {
      answer =
        'Митоз 4 негізгі кезеңнен тұрады: профаза, метафаза, анафаза, телофаза. Нәтижесінде екі бірдей диплоидты жасуша түзіледі.';
    } else if (text.includes('транспирация')) {
      answer =
        'Транспирация — өсімдіктің жапырақ арқылы суды буландыру үдерісі. Ол өсімдікті қызып кетуден сақтауға және су қозғалысына көмектеседі.';
    } else if (text.includes('днқ')) {
      answer =
        'ДНҚ-ның мономері — нуклеотид. Ол азотты негізден, қанттан және фосфат қалдығынан тұрады.';
    } else if (text.includes('рнқ')) {
      answer =
        'РНҚ құрамындағы көмірсу — рибоза. РНҚ-ның негізгі түрлері: аРНҚ, тРНҚ, рРНҚ.';
    }

    document.getElementById('botOutput').textContent = answer;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTestPage();
  initTeacherPage();
  initBotPage();
});
