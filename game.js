'use strict';
const $ = id => document.getElementById(id);
const names = ['คำนาม / ตัวละคร', 'สิ่งของ / ธรรมชาติ / สถานที่', 'คำวิเศษ / ลักษณะ'];
const colors = ['#ff6c83','#ffb44e','#ffd957','#29c67b','#23bfc4','#258df5','#9963ef','#f14cae'];
const storageKey = 'secretWordsGameV2';
const copy = lists => lists.map(list => list.slice());
const clean = list => [...new Set(list.filter(word => typeof word === 'string').map(word => word.trim()).filter(Boolean))];
const parse = text => clean(text.split(/[,，\n]+/));
const validPools = value => Array.isArray(value) && value.length === 3 && value.every(list => Array.isArray(list) && list.length > 0 && list.length <= 150 && list.every(word => typeof word === 'string' && word.trim() && word.length <= 60));
function loadState() {
  const initial = {pools: [defaults.a, defaults.b, defaults.c].map(list => list.slice()), mode: 'keep'};
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && validPools(saved.pools)) {
      initial.pools = saved.pools.map(clean);
      initial.mode = saved.mode === 'remove' ? 'remove' : 'keep';
      if (Array.isArray(saved.available) && saved.available.length === 3 && saved.available.every((list,i) => Array.isArray(list) && list.every(word => initial.pools[i].includes(word)))) initial.available = saved.available.map(clean);
      if (Array.isArray(saved.results) && saved.results.length === 3 && saved.results.every((word,i) => word === '' || initial.pools[i].includes(word))) initial.results = saved.results;
    } else {
      const old = JSON.parse(localStorage.getItem('secretWordsPools') || 'null');
      if (old && validPools([old.a,old.b,old.c])) initial.pools = [old.a,old.b,old.c].map(clean);
    }
  } catch (_) { /* Invalid or unavailable storage must not stop classroom play. */ }
  initial.available = initial.mode === 'keep' ? copy(initial.pools) : (initial.available || copy(initial.pools));
  initial.results = initial.results || ['','',''];
  return initial;
}
let state = loadState(), busy = false, draft = [], toastTimer;
function toast(message) { clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.add('show'); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3200); }
function persist() { try { localStorage.setItem(storageKey, JSON.stringify(state)); return true; } catch (_) { toast('เล่นต่อได้ แต่เบราว์เซอร์นี้ไม่สามารถบันทึกคำไว้หลังปิดหน้าได้'); return false; } }
function randomIndex(length) {
  const buffer = new Uint32Array(1), limit = Math.floor(4294967296 / length) * length;
  do { crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
  return buffer[0] % length;
}
class Wheel {
  constructor(index) { this.canvas = $('wheel-' + index); this.ctx = this.canvas.getContext('2d'); this.angle = 0; this.items = []; }
  setItems(items) { this.items = items.slice(); this.angle = 0; this.draw(); }
  draw() {
    const ctx = this.ctx, size = this.canvas.width, center = size / 2, radius = center - 3, count = this.items.length;
    ctx.clearRect(0,0,size,size);
    if (!count) { ctx.fillStyle = '#f0edfa'; ctx.beginPath(); ctx.arc(center,center,radius,0,Math.PI*2); ctx.fill(); ctx.fillStyle = '#71648c'; ctx.font = '700 34px Mali, Tahoma, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('คำหมดแล้ว', center,center - 110); ctx.font = '24px Mali, Tahoma, sans-serif'; ctx.fillText('กดเริ่มรอบใหม่เพื่อคืนคำ',center,center+130); return; }
    const step = Math.PI * 2 / count;
    for (let i=0;i<count;i++) {
      const start = this.angle + i*step;
      ctx.beginPath(); ctx.moveTo(center,center); ctx.arc(center,center,radius,start,start+step); ctx.closePath(); ctx.fillStyle = colors[i%colors.length]; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.translate(center,center); ctx.rotate(start + step/2); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = i%colors.length === 1 || i%colors.length === 2 ? '#334064' : '#fff';
      const fontSize = count > 50 ? 14 : count > 30 ? 21 : count > 20 ? 26 : 31;
      ctx.font = '700 ' + fontSize + 'px Mali, Tahoma, sans-serif';
      let text = this.items[i];
      while (text.length > 1 && ctx.measureText(text).width > radius*.68) text = text.slice(0,-1);
      if (text !== this.items[i]) text += '…';
      ctx.fillText(text,radius-22,0,radius*.73); ctx.restore();
    }
  }
  spinTo(index) {
    const tau = Math.PI*2, start = this.angle, target = -Math.PI/2 - (index+.5)*tau/this.items.length;
    const delta = ((target-start)%tau + tau)%tau;
    const end = start + 6*tau + delta;
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 2700 + randomIndex(600);
    return new Promise(resolve => {
      const begin = performance.now();
      const frame = now => { const t = duration ? Math.min(1,(now-begin)/duration) : 1; this.angle = start+(end-start)*(1-Math.pow(1-t,4)); this.draw(); if (t<1) requestAnimationFrame(frame); else resolve(); };
      requestAnimationFrame(frame);
    });
  }
}
const wheels = [0,1,2].map(index => new Wheel(index));
function updateUI(redraw = false) {
  $('mode-status').textContent = state.mode === 'keep' ? '🔁 โหมดเก็บคำไว้ · สุ่มซ้ำได้' : '✨ โหมดไม่ซ้ำในรอบ · สุ่มแล้วนำคำออก';
  [0,1,2].forEach(i => {
    $('count-'+i).textContent = state.mode === 'remove' ? 'เหลือ '+state.available[i].length+' / '+state.pools[i].length+' คำ' : state.pools[i].length+' คำในวงล้อ';
    $('result-'+i).textContent = state.results[i] || '?';
    const button = document.querySelector('[data-wheel="'+i+'"]');
    button.disabled = busy || !state.available[i].length;
    button.textContent = !state.available[i].length ? '✓ คำหมดแล้ว' : '↻ หมุนวงล้อ';
    if (redraw) wheels[i].setItems(state.available[i]);
  });
  ['settings','change-mode','reset'].forEach(id => $(id).disabled = busy);
  $('spin-all').disabled = busy || state.available.some(list => !list.length);
  $('spin-all').textContent = state.available.some(list => !list.length) ? 'เริ่มรอบใหม่เพื่อคืนคำ' : '🎡 หมุนครบทั้ง 3 วง';
  $('idea').disabled = busy;
}
async function spin(indices) {
  if (busy) return;
  if (indices.some(i => !state.available[i].length)) { toast('คำในวงล้อหมดแล้ว กดเริ่มรอบใหม่เพื่อคืนคำ'); return; }
  busy = true;
  indices.forEach(i => { state.results[i] = ''; wheels[i].setItems(state.available[i]); });
  updateUI();
  await Promise.all(indices.map(async i => {
    const index = randomIndex(state.available[i].length), word = state.available[i][index];
    await wheels[i].spinTo(index);
    state.results[i] = word;
    if (state.mode === 'remove') state.available[i].splice(index,1);
    $('result-'+i).textContent = word;
  }));
  busy = false; persist(); updateUI();
  // Keep the selected segment under the pointer until the next spin.
  if (state.results.every(Boolean)) showResult();
  else if (state.mode === 'remove') toast('นำคำที่สุ่มได้ออกแล้ว • คำที่เหลือจะอัปเดตบนวงล้อในการหมุนครั้งถัดไป');
}
function resetRound() {
  if (busy) return;
  state.available = copy(state.pools); state.results = ['','',''];
  $('result-dialog').close(); updateUI(true); persist(); toast('เริ่มรอบใหม่แล้ว คืนคำทั้งหมดเข้าวงล้อ');
}
function showResult(withIdea = false) {
  if (!state.results.every(Boolean)) { toast('หมุนวงล้อให้ครบทั้ง 3 วงก่อนนะ'); return; }
  $('final-words').replaceChildren(...state.results.map(word => { const chip = document.createElement('div'); chip.className = 'chip'; chip.textContent = word; return chip; }));
  $('idea-content').hidden = !withIdea;
  if (withIdea) createIdea();
  if (!$('result-dialog').open) $('result-dialog').showModal();
}
function createIdea() {
  const [a,b,c] = state.results;
  const ideas = ['ลองวาด '+a+' ที่กำลังสำรวจ '+b+' ซึ่งมีลักษณะ '+c+' แล้วคิดว่าจะเกิดเรื่องสนุกอะไรขึ้น', 'ถ้า '+a+' ได้พบกับ '+b+' ในโลกที่ทุกอย่าง '+c+' ภาพนั้นจะหน้าตาเป็นอย่างไร?', 'ออกแบบ '+b+' แบบ '+c+' ให้เป็นของขวัญสำหรับ '+a+' แล้วเล่าว่าทำไมจึงเลือกของขวัญนี้'];
  $('idea-content').textContent = '💡 '+ideas[randomIndex(ideas.length)]; $('idea-content').hidden = false;
}
function openSettings() {
  if (busy) return;
  draft = copy(state.pools); renderEditors();
  document.querySelector('input[name="mode"][value="'+state.mode+'"]').checked = true;
  $('settings-error').textContent = ''; $('settings-dialog').showModal();
}
function addDraft(i,text) {
  const added = parse(text);
  if (!added.length) return false;
  if (added.some(word => word.length > 60) || clean([...draft[i],...added]).length > 150) { $('settings-error').textContent = 'แต่ละคำยาวไม่เกิน 60 ตัวอักษร และแต่ละวงมีได้ไม่เกิน 150 คำ'; return false; }
  draft[i] = clean([...draft[i],...added]); $('settings-error').textContent = ''; renderEditors(); return true;
}
function renderEditors() {
  $('editors').replaceChildren(...draft.map((list,i) => {
    const section = document.createElement('section'); section.className = 'editor';
    const title = document.createElement('h3'); title.textContent = (i+1)+'. '+names[i]+' ('+list.length+' คำ)'; section.append(title);
    const wordList = document.createElement('div'); wordList.className = 'word-list';
    list.forEach((word,j) => {
      const row = document.createElement('div'); row.className = 'word-entry';
      const input = document.createElement('input'); input.value = word; input.maxLength = 60; input.setAttribute('aria-label','แก้คำที่ '+(j+1)+' วงล้อ '+(i+1)); input.addEventListener('input',() => draft[i][j] = input.value);
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label','ลบ '+word); remove.onclick = () => { draft[i].splice(j,1); renderEditors(); }; row.append(input,remove); wordList.append(row);
    });
    section.append(wordList);
    const addRow = document.createElement('div'); addRow.className = 'add-row';
    const input = document.createElement('input'); input.placeholder = 'พิมพ์คำใหม่…'; input.setAttribute('aria-label','เพิ่มคำวงล้อ '+(i+1)); input.className = 'new-word'; input.dataset.pool = i;
    const add = document.createElement('button'); add.type = 'button'; add.className = 'small-button'; add.textContent = '+ เพิ่มคำ'; add.onclick = () => addDraft(i,input.value);
    input.onkeydown = event => { if(event.key === 'Enter') { event.preventDefault(); addDraft(i,input.value); document.querySelector('.new-word[data-pool="'+i+'"]').focus(); } }; addRow.append(input,add); section.append(addRow);
    const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = 'วางหลายคำพร้อมกัน';
    const bulk = document.createElement('textarea'); bulk.placeholder = 'คั่นแต่ละคำด้วยจุลภาค หรือขึ้นบรรทัดใหม่'; bulk.setAttribute('aria-label','หลายคำสำหรับวงล้อ '+(i+1)); bulk.className = 'bulk-words'; bulk.dataset.pool = i;
    const append = document.createElement('button'); append.type='button'; append.className='small-button'; append.textContent='เพิ่มรายการนี้'; append.onclick=()=>addDraft(i,bulk.value);
    details.append(summary,bulk,append); section.append(details); return section;
  }));
}
$('settings-form').addEventListener('submit',event => {
  event.preventDefault();
  // Include typed additions even when Save is pressed before the Add button.
  const next = draft.map((list,i) => clean([...list,...parse(document.querySelector('.new-word[data-pool="'+i+'"]').value),...parse(document.querySelector('.bulk-words[data-pool="'+i+'"]').value)]));
  if (!validPools(next)) { $('settings-error').textContent = 'แต่ละวงต้องมี 1–150 คำ และแต่ละคำยาวไม่เกิน 60 ตัวอักษร'; return; }
  state.pools = next; state.mode = document.querySelector('input[name="mode"]:checked').value;
  state.available = copy(next); state.results = ['','','']; updateUI(true);
  const saved = persist(); $('settings-dialog').close(); if(saved) toast('บันทึกคำศัพท์และโหมดแล้ว เริ่มรอบใหม่ได้เลย');
});
$('defaults').onclick = () => { draft = [defaults.a,defaults.b,defaults.c].map(list => list.slice()); renderEditors(); $('settings-error').textContent='ใส่คำเริ่มต้นในแบบฟอร์มแล้ว กดบันทึกเพื่อใช้งาน หรือปิดเพื่อยกเลิก'; };
$('start').onclick = () => { $('welcome').hidden=true; $('game').hidden=false; updateUI(true); $('settings').focus(); };
$('settings').onclick = openSettings; $('change-mode').onclick = openSettings;
$('spin-all').onclick = () => spin([0,1,2]);
for (const button of document.querySelectorAll('[data-wheel]')) button.onclick = () => spin([Number(button.dataset.wheel)]);
$('reset').onclick = resetRound; $('idea').onclick = () => showResult(true); $('result-idea').onclick = createIdea;
for (const button of document.querySelectorAll('[data-close]')) button.onclick = () => $(button.dataset.close).close();
$('fullscreen').onclick = async () => { try { if(document.fullscreenElement) await document.exitFullscreen(); else if(document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else toast('เบราว์เซอร์นี้ไม่รองรับโหมดเต็มหน้าจอ'); } catch (_) { toast('ไม่สามารถเปิดโหมดเต็มหน้าจอในเบราว์เซอร์นี้ได้'); } };
updateUI(true);
if (document.fonts) document.fonts.ready.then(() => { if(!busy) wheels.forEach(wheel => wheel.draw()); });
