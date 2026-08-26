const repairs = [
  ['衣類', '服のボタンがとれた', ['810', '830']], ['衣類', '服が黄ばんだ', ['810', '830']], ['衣類', '服の縫い目がほつれた', ['810', '830']], ['衣類', '服のゴムがのびた', ['830', '840']], ['衣類', 'ファスナーのかみ合わせが悪くなった', ['813', '877']], ['衣類', 'ズボンに穴があいた', ['813', '831']], ['衣類', 'レインウェアの撥水がなくなった', ['856']], ['靴', '靴底がすり減った', ['860']], ['靴', '革靴が色あせた', ['863']],
  ['住まい', '網戸が破れた', ['12']], ['住まい', 'アルミサッシ・網戸が開けにくい', ['10']], ['住まい', 'フローリングがへこんだ', ['22']], ['住まい', '雨漏りがする', ['23']], ['水回り', 'トイレの便器内に水がちょろちょろ流れ続ける', ['73']], ['水回り', '蛇口から水漏れしている', ['74']], ['水回り', 'キッチンの排水がつまった', ['75']], ['家事', '陶器が割れた', ['151']], ['住まい', '玄関の鍵が回しにくい', ['14']],
  ['家事', '包丁が切れにくくなった', ['133']], ['住まい', '木製家具に傷がついた', ['710']], ['住まい', '机や椅子の脚ががたつく', ['715']], ['住まい', '引き出しや扉の開けしめがしにくい', ['712', '714']], ['生活用品', '傘の骨が折れた', ['341']], ['乗り物', '自転車がパンクした', ['956']], ['乗り物', '自転車のブレーキが効かない', ['956']], ['乗り物', '自転車のチェーンがガタガタする', ['956']], ['電気', '乾電池を使う機器の電気が入らない', ['460', '334']], ['電気', '腕時計の電池が切れた', ['283']], ['電気', '電球が切れた', ['230']], ['電気', '親子電話の子機が充電できない', ['242']], ['電気', 'スマホの電池の持ちが悪くなった', ['241']], ['電気', 'スマホのガラスが割れた', ['241']], ['電気', 'パソコンが立ち上がらない', ['441', '442']], ['電気', 'パソコンがウィルスに感染した', ['441', '442']]
];

const storageKey = 'myrepair-owners';
const ecoLifeStorageKey = 'homeenergycodes.savedInput';
const ecoLifeUrl = 'https://hinodeyasuzuki.github.io/myecoliferecords/';
const equipmentApiUrl = 'https://hinodeyasuzuki.github.io/homeenergycodes-public/api/v1/equip.json';
const savedOwners = JSON.parse(localStorage.getItem(storageKey) || '{}');
let ecoLifeData = readEcoLifeData();
let equipmentList = [];
let equipmentById = new Map();
let activeFilter = 'all';

function linkFor(id) {
  return `https://s8.hinodeya-ecolife.com/repairinfo/equipment.php?equipcode=${id}`;
}

function categoryFor(fallback) {
  return fallback;
}

function categoryMembers(categoryId) {
  const num = Number(categoryId);
  const categoryIds = equipmentList
    .filter(item => String(item.id).endsWith('0'))
    .map(item => Number(item.id))
    .sort((a, b) => a - b);
  const upper = categoryIds.find(n => n > num) ?? Infinity;
  return equipmentList.filter(item => {
    const n = Number(item.id);
    return n > num && n < upper;
  });
}

function readEcoLifeData() {
  try {
    return JSON.parse(localStorage.getItem(ecoLifeStorageKey) || '{}');
  } catch (error) {
    console.error('Myエコライフ記録の読み込みに失敗しました', error);
    return {};
  }
}

function recordMatchesRepair(itemIds, product) {
  if (!product || !product.equip_id) return false;
  return itemIds.some(id => String(product.equip_id) === String(id) || categoryMembers(id).some(member => String(member.id) === String(product.equip_id)));
}

function repairRecordsFor(ids) {
  const products = ecoLifeData.products || {};
  const productIds = Object.entries(products)
    .filter(([, product]) => recordMatchesRepair(ids, product))
    .map(([productId]) => productId);
  return Object.entries(ecoLifeData.repairlog || {})
    .filter(([, log]) => productIds.includes(String(log.product_id)))
    .map(([id, log]) => ({ id, log, product: products[log.product_id] }))
    .sort((a, b) => String(b.log.created_at || '').localeCompare(String(a.log.created_at || '')));
}

function recordDate(log) {
  if (log.year || log.month || log.day) return [log.year, log.month, log.day].filter(Boolean).join('/');
  return log.created_at ? new Date(log.created_at).toLocaleDateString('ja-JP') : '日付未登録';
}

function recordsHtml(ids) {
  const records = repairRecordsFor(ids);
  const repairUrl = `${ecoLifeUrl}?repair_id=${encodeURIComponent(ids[0])}`;
  const label = records.length ? '修理済' : '新規記録';
  return `<div class="record-cell"><a class="record-button${records.length ? ' completed' : ''}" href="${repairUrl}" target="_blank" rel="noreferrer">${label}</a></div>`;
}

function linkHtml(id, title) {
  return `<a href="${linkFor(id)}" target="_blank" rel="noreferrer">${title} 修理方法 ↗</a>`;
}

function linksFor(ids) {
  return ids.map(id => {
    const info = equipmentById.get(id);
    if (!String(id).endsWith('0')) return linkHtml(id, info ? info.title : id);
    const members = categoryMembers(id);
    if (members.length === 0) return linkHtml(id, info ? info.title : id);
    if (members.length === 1) return linkHtml(members[0].id, members[0].title);
    const options = members.map(m => `<a href="${linkFor(m.id)}" target="_blank" rel="noreferrer">${m.title}</a>`).join('');
    return `<details class="link-popup"><summary>${info ? info.title : id} 修理方法 ▾</summary><div class="link-popup-menu">${options}</div></details>`;
  }).join('');
}

function updateFilters() {
  const counts = new Map();
  repairs.forEach(([fallback]) => {
    const category = categoryFor(fallback);
    counts.set(category, (counts.get(category) || 0) + 1);
  });
  const tabs = [`<button class="filter-tab active" data-filter="all" role="tab">すべて <span>${repairs.length}</span></button>`];
  counts.forEach((count, category) => {
    tabs.push(`<button class="filter-tab" data-filter="${category}" role="tab">${category} <span>${count}</span></button>`);
  });
  document.querySelector('.filter-tabs').innerHTML = tabs.join('');
  document.querySelectorAll('.filter-tab').forEach(button => button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.toggle('active', tab === button));
    render();
  }));
}

let openPopup = null;

function closeOpenPopup() {
  if (!openPopup) return;
  const { details, menu, placeholder } = openPopup;
  openPopup = null;
  placeholder.replaceWith(menu);
  menu.style.position = '';
  menu.style.top = '';
  menu.style.left = '';
  if (details.open) details.open = false;
}

function render() {
  closeOpenPopup();
  const visible = repairs.filter(([fallback]) => {
    const category = categoryFor(fallback);
    const matchesFilter = activeFilter === 'all' || category === activeFilter;
    return matchesFilter;
  });
  const grid = document.querySelector('#repair-grid');
  grid.innerHTML = visible.map(([fallback, title, ids], index) => {
    const itemIndex = repairs.findIndex(item => item[1] === title);
    const category = categoryFor(fallback);
    const current = savedOwners[itemIndex] || '';
    const idLinks = linksFor(ids);
    return `<article class="repair-card${current === 'self' ? ' self-doable' : ''}" style="animation-delay:${Math.min(index * 25, 250)}ms">
      <div class="repair-detail">
      <h2>${title}</h2><div class="links">${idLinks}</div></div>
      ${recordsHtml(ids)}
      <div class="repair-possibility"><div class="owner-options" aria-label="${title}の修理可能性">
        ${[['self', '自分で'], ['known', '身近な人'], ['pro', '業者']].map(([value, label]) => `<label class="owner-option"><input type="radio" name="repair-${itemIndex}" value="${value}" data-index="${itemIndex}" ${current === value ? 'checked' : ''}><span>${label}</span></label>`).join('')}
      </div></div>
    </article>`;
  }).join('');
  document.querySelector('#empty-state').hidden = visible.length > 0;
  updateProgress();
}

function updateProgress() {
  const selections = Object.values(savedOwners).filter(value => ['self', 'known', 'pro'].includes(value));
  const count = selections.length;
  const selfCount = selections.filter(value => value === 'self').length;
  const percent = Math.round((count / repairs.length) * 100);
  const selfPercent = Math.round((selfCount / repairs.length) * 100);
  document.querySelector('#progress-label').textContent = `${count} / ${repairs.length}`;
  document.querySelector('#progress-percent').textContent = `${percent}%`;
  document.querySelector('#self-percent').textContent = `${selfPercent}%`;
  document.querySelector('#progress-bar').style.width = `${percent}%`;
  document.querySelector('#self-progress-bar').style.width = `${selfPercent}%`;
}

document.querySelector('#repair-grid').addEventListener('change', event => {
  if (!event.target.matches('input[type="radio"]')) return;
  savedOwners[event.target.dataset.index] = event.target.value;
  localStorage.setItem(storageKey, JSON.stringify(savedOwners));
  document.querySelector('#sync-status').textContent = '保存しました';
  updateProgress();
});
window.addEventListener('storage', event => {
  if (event.key !== ecoLifeStorageKey) return;
  ecoLifeData = readEcoLifeData();
  render();
});
document.querySelector('#repair-grid').addEventListener('toggle', event => {
  const details = event.target;
  if (!(details instanceof HTMLDetailsElement) || !details.classList.contains('link-popup')) return;
  if (details.open) {
    if (openPopup && openPopup.details !== details) closeOpenPopup();
    const menu = details.querySelector('.link-popup-menu');
    const placeholder = document.createComment('link-popup-placeholder');
    menu.replaceWith(placeholder);
    const rect = details.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.left = `${rect.left}px`;
    document.body.appendChild(menu);
    openPopup = { details, menu, placeholder };
  } else if (openPopup && openPopup.details === details) {
    closeOpenPopup();
  }
}, true);
document.addEventListener('click', event => {
  if (openPopup && !openPopup.menu.contains(event.target) && !openPopup.details.contains(event.target)) {
    closeOpenPopup();
  }
});
document.querySelector('#theme-toggle').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme === 'dark';
  document.documentElement.dataset.theme = dark ? '' : 'dark';
  localStorage.setItem('myrepair-theme', dark ? 'light' : 'dark');
});
if (localStorage.getItem('myrepair-theme') === 'dark') document.documentElement.dataset.theme = 'dark';

updateFilters();
render();

fetch(equipmentApiUrl)
  .then(response => {
    if (!response.ok) throw new Error(`機器情報の取得に失敗しました (${response.status})`);
    return response.json();
  })
  .then(equipment => {
    equipmentList = equipment;
    equipmentById = new Map(equipment.map(item => [String(item.id), item]));
    render();
  })
  .catch(error => {
    console.error(error);
  });
