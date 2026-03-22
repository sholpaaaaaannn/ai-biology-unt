const VARIANTS = typeof tests !== 'undefined' ? Object.keys(tests) : [];

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

  if (available.length === 0) {
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
  return String(str).replace(/[&<>"']/g, function (s) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[s];
  });
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
    html += `
      <img
        class="q-image"
        src="${q.image}"
        alt="${q.number}-сұрақ суреті"
      >
    `;
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

    if (q.choices && q.choices.length) {
      html += `
        <div class="small">
          Нұсқалар:
          ${q.choices.map((choice, i) => `${i + 1}) ${escapeHtml(choice)}`).join(' | ')}
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

function arraysEqual(a, b) {
  const first = [...a].sort((x, y) => x - y);
  const second = [...b].sort((x, y) => x - y);
  return JSON.stringify(first) === JSON.stringify(second);
}

function markQuestionResult(qNumber, isCorrect, message) {
  const card = document.querySelector(`.question-card[data-q="${qNumber}"]`);
  if (!card) return;

  card.classList.remove('correct-question', 'wrong-question');
  card.classList.add(isCorrect ? 'correct-question' : 'wrong-question');

  let resultBox = card.querySelector('.question-result');

  if (!resultBox) {
    resultBox = document.createElement('div');
    resultBox.className = 'question-result';
    card.appendChild(resultBox);
  }

  resultBox.innerHTML = message;
}

function scoreQuiz(variant) {
  const questions = tests[variant];
  let score = 0;
  const max = questions.length;

  questions.forEach(q => {
    if (q.type === 'single') {
      const selected = document.querySelector(`input[name="q${q.number}"]:checked`);
      const selectedValue = selected ? Number(selected.value) : null;
      const isCorrect = selectedValue === q.answer;

      if (isCorrect) {
        score += 1;

        markQuestionResult(
          q.number,
          true,
          `<strong>Дұрыс.</strong> Дұрыс жауап: ${String.fromCharCode(65 + q.answer)}. ${q.options[q.answer]}`
        );
      } else {
        const chosenText =
          selectedValue !== null
            ? `${String.fromCharCode(65 + selectedValue)}. ${q.options[selectedValue]}`
            : 'Жауап таңдалмады';

        markQuestionResult(
          q.number,
          false,
          `<strong>Қате.</strong><br>
           Сіздің жауабыңыз: ${chosenText}<br>
           Дұрыс жауап: ${String.fromCharCode(65 + q.answer)}. ${q.options[q.answer]}`
        );
      }
    }

    else if (q.type === 'matching') {
      const selectedPairs = q.pairs.map(pair => {
        const el = document.querySelector(`select[name="q${q.number}_${pair.label}"]`);

        return {
          label: pair.label,
          selected: el ? Number(el.value) : null,
          correct: Number(pair.answer)
        };
      });

      const isCorrect = selectedPairs.every(item => item.selected === item.correct);

      if (isCorrect) {
        score += 1;

        markQuestionResult(
          q.number,
          true,
          `<strong>Дұрыс.</strong> Сәйкестендіру толық дұрыс орындалды.`
        );
      } else {
        const details = selectedPairs
          .map(item => {
            const userText = item.selected ? item.selected : 'таңдалмады';
            return `<div><strong>${item.label.toUpperCase()}</strong>: сіз — ${userText}, дұрыс — ${item.correct}</div>`;
          })
          .join('');

        markQuestionResult(
          q.number,
          false,
          `<strong>Қате.</strong><br>${details}`
        );
      }
    }

    else if (q.type === 'multi') {
      const selected = Array.from(
        document.querySelectorAll(`input[name="q${q.number}"]:checked`)
      ).map(el => Number(el.value));

      const correct = [...q.answers];
      const isCorrect = arraysEqual(selected, correct);

      const chosenText = selected.length
        ? selected.map(i => `${String.fromCharCode(65 + i)}. ${q.options[i]}`).join(', ')
        : 'Жауап таңдалмады';

      const correctText = correct
        .map(i => `${String.fromCharCode(65 + i)}. ${q.options[i]}`)
        .join(', ');

      if (isCorrect) {
        score += 1;

        markQuestionResult(
          q.number,
          true,
          `<strong>Дұрыс.</strong> Дұрыс жауаптар: ${correctText}`
        );
      } else {
        markQuestionResult(
          q.number,
          false,
          `<strong>Қате.</strong><br>
           Сіздің жауабыңыз: ${chosenText}<br>
           Дұрыс жауаптар: ${correctText}`
        );
      }
    }
  });

  return { score, max };
}

function saveResult(variant, score, max) {
  const results = JSON.parse(localStorage.getItem('results') || '[]');
  const studentName = localStorage.getItem('studentName') || 'Аты көрсетілмеген';

  results.push({
    studentName: studentName,
    variant: variant,
    variantLabel: variantLabels[variant] || variant,
    score: score,
    max: max,
    date: new Date().toLocaleString()
  });

  localStorage.setItem('results', JSON.stringify(results));
}

function initTestPage() {
  const form = document.getElementById('quizForm');
  if (!form) return;

  const variant = pickRandomVariant();
  const studentName = localStorage.getItem('studentName') || 'Аты көрсетілмеген';

  const variantBadge = document.getElementById('variantBadge');
  if (variantBadge) {
    variantBadge.textContent = variantLabels[variant] || variant;
  }

  const studentInfo = document.getElementById('studentInfo');
  if (studentInfo) {
    studentInfo.textContent = `Оқушы: ${studentName}`;
  }

  form.innerHTML = tests[variant].map(renderQuestion).join('');

  const submitBtn = document.getElementById('submitBtn');
  const nextBtn = document.getElementById('nextBtn');

  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const result = scoreQuiz(variant);

      saveResult(variant, result.score, result.max);

      const box = document.getElementById('resultBox');
      const scoreText = document.getElementById('scoreText');

      if (box) {
        box.hidden = false;
        box.classList.remove('good', 'bad');
        box.classList.add(result.score >= Math.round(result.max * 0.7) ? 'good' : 'bad');
      }

      if (scoreText) {
        scoreText.textContent =
          `${studentName} — ${variantLabels[variant]} бойынша нәтиже: ${result.score} / ${result.max}`;
      }

      if (nextBtn) {
        nextBtn.hidden = false;
      }

      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: 'smooth'
      });
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      location.reload();
    });
  }
}

function initTeacherPage() {
  const list = document.getElementById('resultsList');
  if (!list) return;

  const results = JSON.parse(localStorage.getItem('results') || '[]');
  const summary = document.getElementById('teacherSummary');

  if (!results.length) {
    if (summary) {
      summary.innerHTML = `
        <h2>Әзірге нәтиже жоқ</h2>
        <p class="small">Алдымен тестті орындап шық.</p>
      `;
    }
    list.innerHTML = '';
  } else {
    const avg = (
      results.reduce((sum, item) => sum + item.score, 0) / results.length
    ).toFixed(2);

    const uniqueStudents = [...new Set(results.map(item => item.studentName))].length;

    if (summary) {
      summary.innerHTML = `
        <h2>Жалпы статистика</h2>
        <p><strong>Тапсырылған тест саны:</strong> ${results.length}</p>
        <p><strong>Оқушылар саны:</strong> ${uniqueStudents}</p>
        <p><strong>Орташа ұпай:</strong> ${avg}</p>
      `;
    }

    list.className = 'result-list';
    list.innerHTML = results
      .slice()
      .reverse()
      .map(item => `
        <div class="result-item">
          <strong>${item.studentName}</strong>
          <div>Нұсқа: ${item.variantLabel}</div>
          <div>Ұпай: ${item.score} / ${item.max}</div>
          <div class="small">${item.date}</div>
        </div>
      `)
      .join('');
  }

  const clearBtn = document.getElementById('clearResultsBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      localStorage.removeItem('results');
      localStorage.removeItem('usedVariants');
      localStorage.removeItem('studentName');
      location.reload();
    });
  }
}

function initBotPage() {
  const btn = document.getElementById('askBotBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const input = document.getElementById('botInput');
    const output = document.getElementById('botOutput');
    const text = (input ? input.value : '').toLowerCase();

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

    if (output) {
      output.textContent = answer;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTestPage();
  initTeacherPage();
  initBotPage();
});
