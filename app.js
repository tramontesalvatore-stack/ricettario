(function(){
  var R = window.RECIPES || [];
  var state = { q:'', cat:'', src:'', mode:'', tmax:1440 };
  var $ = function(id){ return document.getElementById(id); };

  function fmtTime(m){
    if(m == null) return '';
    if(m < 60) return m + ' min';
    var h = Math.floor(m/60), r = m % 60;
    return r ? (h + ' h ' + r) : (h + ' h');
  }
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function modesOf(r){
    if(!r.mode) return [];
    return r.mode.split('+').map(function(x){ return x.trim().toUpperCase(); }).filter(Boolean);
  }
  function uniq(key){
    var seen = {}, out = [];
    R.forEach(function(r){
      var v = r[key];
      if(v && !seen[v]){ seen[v] = 1; out.push(v); }
    });
    return out.sort();
  }

  // category pills
  var cats = uniq('category');
  var catsEl = $('cats');
  function renderCats(){
    catsEl.innerHTML = '';
    var all = document.createElement('button');
    all.type = 'button'; all.className = 'cat' + (state.cat === '' ? ' on' : '');
    all.textContent = 'Tutte';
    all.onclick = function(){ state.cat = ''; renderCats(); apply(); };
    catsEl.appendChild(all);
    cats.forEach(function(c){
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'cat' + (state.cat === c ? ' on' : '');
      b.textContent = c;
      b.onclick = function(){ state.cat = (state.cat === c ? '' : c); renderCats(); apply(); };
      catsEl.appendChild(b);
    });
  }

  // selects
  function fillSelect(el, values, allLabel){
    el.innerHTML = '';
    var o = document.createElement('option'); o.value = ''; o.textContent = allLabel; el.appendChild(o);
    values.forEach(function(v){
      var op = document.createElement('option'); op.value = v; op.textContent = v; el.appendChild(op);
    });
  }
  fillSelect($('srcSel'), uniq('source'), 'Tutte le fonti');
  var allModes = {};
  R.forEach(function(r){ modesOf(r).forEach(function(m){ allModes[m] = 1; }); });
  fillSelect($('modeSel'), Object.keys(allModes).sort(), 'Tutti i metodi');

  // events
  $('q').addEventListener('input', function(e){ state.q = e.target.value.trim().toLowerCase(); apply(); });
  $('srcSel').addEventListener('change', function(e){ state.src = e.target.value; apply(); });
  $('modeSel').addEventListener('change', function(e){ state.mode = e.target.value; apply(); });
  var slider = $('tSlider'), tVal = $('tVal');
  function setTime(v){
    state.tmax = v; slider.value = v;
    tVal.textContent = (v >= 1440) ? 'qualsiasi' : ('fino a ' + fmtTime(v));
    var btns = $('quick').querySelectorAll('button');
    btns.forEach(function(b){ b.classList.toggle('on', Number(b.getAttribute('data-t')) === v); });
  }
  slider.addEventListener('input', function(e){ setTime(Number(e.target.value)); apply(); });
  $('quick').querySelectorAll('button').forEach(function(b){
    b.addEventListener('click', function(){ setTime(Number(b.getAttribute('data-t'))); apply(); });
  });
  $('resetBtn').addEventListener('click', function(){
    state = { q:'', cat:'', src:'', mode:'', tmax:1440 };
    $('q').value = ''; $('srcSel').value = ''; $('modeSel').value = '';
    setTime(1440); renderCats(); apply();
  });

  function matches(r){
    if(state.cat && r.category !== state.cat) return false;
    if(state.src && r.source !== state.src) return false;
    if(state.mode && modesOf(r).indexOf(state.mode) === -1) return false;
    if(state.tmax < 1440 && r.timeMinutes != null && r.timeMinutes > state.tmax) return false;
    if(state.q){
      var hay = (r.title + ' ' + (r.ingredients || []).map(function(g){
        return (g.items || []).join(' ');
      }).join(' ')).toLowerCase();
      if(hay.indexOf(state.q) === -1) return false;
    }
    return true;
  }

  function cardHtml(r){
    var h = '<article class="card" data-slug="' + esc(r.slug) + '">';
    h += '<h3>' + esc(r.title) + '</h3>';
    h += '<div class="meta"><span>' + esc(r.category) + '</span>';
    if(r.kcal) h += '<span>~' + esc(r.kcal) + ' kcal</span>';
    if(r.timeMinutes != null) h += '<span>' + fmtTime(r.timeMinutes) + '</span>';
    h += '</div>';
    if(r.tags && r.tags.length){
      h += '<div>' + r.tags.map(function(t){ return '<span class="tag">#' + esc(t) + '</span>'; }).join(' ') + '</div>';
    }
    h += '<div class="badges">';
    if(r.mode) h += '<span class="badge">' + esc(r.mode) + '</span>';
    if(r.source) h += '<span class="badge src">' + esc(r.source) + '</span>';
    if(r.allergens && r.allergens.length) h += '<span class="badge alg">allergeni: ' + esc(r.allergens.join(', ')) + '</span>';
    h += '</div></article>';
    return h;
  }

  function apply(){
    var list = R.filter(matches);
    $('grid').innerHTML = list.map(cardHtml).join('');
    $('count').textContent = list.length + (list.length === 1 ? ' ricetta' : ' ricette');
    $('empty').style.display = list.length ? 'none' : 'block';
    $('grid').querySelectorAll('.card').forEach(function(c){
      c.addEventListener('click', function(){ openDetail(c.getAttribute('data-slug')); });
    });
  }

  // detail
  var overlay = $('overlay'), sheet = $('sheet');
  function openDetail(slug){
    var r = null;
    R.forEach(function(x){ if(x.slug === slug) r = x; });
    if(!r) return;
    var h = '<button class="close" type="button" id="closeBtn" aria-label="Chiudi">×</button>';
    h += '<h2>' + esc(r.title) + '</h2>';
    h += '<div class="meta"><span>' + esc(r.category) + '</span>';
    if(r.servings) h += '<span>' + esc(r.servings) + '</span>';
    if(r.kcal) h += '<span>~' + esc(r.kcal) + ' kcal a porzione</span>';
    if(r.timeMinutes != null) h += '<span>cottura: ' + fmtTime(r.timeMinutes) + '</span>';
    h += '</div>';
    h += '<div class="badges" style="margin-top:8px">';
    if(r.mode) h += '<span class="badge">' + esc(r.mode) + '</span>';
    if(r.source) h += '<span class="badge src">' + esc(r.source) + '</span>';
    h += '</div>';
    if(r.allergens && r.allergens.length){
      h += '<div class="warnbox">Allergeni: ' + esc(r.allergens.join(', ')) + '</div>';
    }
    if(r.nutrition) h += '<p class="nutri">' + esc(r.nutrition) + '</p>';
    (r.ingredients || []).forEach(function(g){
      h += '<h4>' + esc(g.label || 'Ingredienti') + '</h4><ul>';
      (g.items || []).forEach(function(it){ h += '<li>' + esc(it) + '</li>'; });
      h += '</ul>';
    });
    if(r.steps && r.steps.length){
      h += '<h4>Procedimento</h4><ol>';
      r.steps.forEach(function(s){ h += '<li>' + esc(s) + '</li>'; });
      h += '</ol>';
    }
    sheet.innerHTML = h;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    $('closeBtn').addEventListener('click', closeDetail);
    sheet.scrollTop = 0; overlay.scrollTop = 0;
  }
  function closeDetail(){
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  overlay.addEventListener('click', function(e){ if(e.target === overlay) closeDetail(); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeDetail(); });

  // views
  $('btnRecipes').addEventListener('click', function(){
    $('viewRecipes').style.display = ''; $('viewGuide').style.display = 'none';
    $('btnRecipes').classList.add('on'); $('btnGuide').classList.remove('on');
  });
  $('btnGuide').addEventListener('click', function(){
    $('viewRecipes').style.display = 'none'; $('viewGuide').style.display = '';
    $('btnGuide').classList.add('on'); $('btnRecipes').classList.remove('on');
  });

  renderCats();
  setTime(1440);
  apply();
})();
