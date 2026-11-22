(function(){
  var R = window.RECIPES || [];
  var state = { q:'', cat:'', src:'', mode:'' };
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
  function fillSelect(el, values, allLabel){
    el.innerHTML = '';
    var o = document.createElement('option'); o.value = ''; o.textContent = allLabel; el.appendChild(o);
    values.forEach(function(v){
      var op = document.createElement('option'); op.value = v; op.textContent = v; el.appendChild(op);
    });
  }
  var COURSE_ORDER = ['Antipasti','Antipasti e snack','Primi','Secondi','Piatti unici','Contorni','Contorni & pane','Dolci','Colazioni','Liquori'];
  var courses = uniq('course');
  courses.sort(function(a, b){
    var ia = COURSE_ORDER.indexOf(a), ib = COURSE_ORDER.indexOf(b);
    if(ia === -1) ia = 99; if(ib === -1) ib = 99;
    return ia !== ib ? ia - ib : (a < b ? -1 : 1);
  });
  fillSelect($('catSel'), courses, 'Tutte le portate');
  fillSelect($('srcSel'), uniq('source'), 'Tutte le fonti');
  var allModes = {};
  R.forEach(function(r){ modesOf(r).forEach(function(m){ allModes[m] = 1; }); });
  fillSelect($('modeSel'), Object.keys(allModes).sort(), 'Tutti i metodi');

  $('q').addEventListener('input', function(e){ state.q = e.target.value.trim().toLowerCase(); apply(); });
  $('catSel').addEventListener('change', function(e){ state.cat = e.target.value; apply(); });
  $('srcSel').addEventListener('change', function(e){ state.src = e.target.value; apply(); });
  $('modeSel').addEventListener('change', function(e){ state.mode = e.target.value; apply(); });
  $('resetBtn').addEventListener('click', function(){
    state = { q:'', cat:'', src:'', mode:'' };
    $('q').value = ''; $('catSel').value = ''; $('srcSel').value = ''; $('modeSel').value = '';
    apply();
  });

  function matches(r){
    if(state.cat && (r.course || r.category) !== state.cat) return false;
    if(state.src && r.source !== state.src) return false;
    if(state.mode && modesOf(r).indexOf(state.mode) === -1) return false;
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
    h += '<div class="meta"><span>' + esc(r.course || r.category) + '</span>';
    if(r.kcal) h += '<span>~' + esc(r.kcal) + ' kcal</span>';
    if(r.timeMinutes != null) h += '<span>cottura ' + fmtTime(r.timeMinutes) + '</span>';
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

  var overlay = $('overlay'), sheet = $('sheet');
  var detailState = {r: null, base: 0, n: 0};
  function baseServings(r){
    var m = (r.servings || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : 0;
  }
  function fmtQty(v){
    if(v >= 100) return String(Math.round(v / 5) * 5);
    if(v >= 20) return String(Math.round(v));
    if(v >= 10){ var r = Math.round(v * 2) / 2; return String(r).replace('.', ','); }
    var whole = Math.floor(v), frac = v - whole;
    var fr = [[0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾']];
    for(var i = 0; i < fr.length; i++){
      if(Math.abs(frac - fr[i][0]) < 0.06) return (whole > 0 ? String(whole) : '') + fr[i][1];
    }
    if(frac < 0.06) return String(whole);
    if(frac > 0.94) return String(whole + 1);
    return String(Math.round(v * 10) / 10).replace('.', ',');
  }
  function scaleItem(text, f){
    if(f === 1) return text;
    var m = text.match(/^(\s*)(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?)(?:\s*-\s*(\d+(?:[.,]\d+)?))?(.*)$/);
    if(!m) return text;
    function val(s){
      if(s.indexOf('/') >= 0){ var p = s.split('/'); return parseFloat(p[0].replace(',', '.')) / parseFloat(p[1]); }
      return parseFloat(s.replace(',', '.'));
    }
    var out = fmtQty(val(m[2]) * f);
    if(m[3]) out += '-' + fmtQty(val(m[3]) * f);
    return m[1] + out + m[4];
  }
  function ingredientsHtml(r, f){
    var h = '';
    (r.ingredients || []).forEach(function(g){
      if(typeof g === 'string'){ h += '<ul><li>' + esc(scaleItem(g, f)) + '</li></ul>'; return; }
      h += '<h4>' + esc(g.label || 'Ingredienti') + '</h4><ul>';
      (g.items || []).forEach(function(it){ h += '<li>' + esc(scaleItem(it, f)) + '</li>'; });
      h += '</ul>';
    });
    return h;
  }
  function openDetail(slug){
    var r = null;
    R.forEach(function(x){ if(x.slug === slug) r = x; });
    if(!r) return;
    var h = '<button class="close" type="button" id="closeBtn" aria-label="Chiudi">×</button>';
    h += '<h2>' + esc(r.title) + '</h2>';
    h += '<div class="meta"><span>' + esc(r.course || r.category) + '</span>';
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
    } else if(r.allergensVerified){
      h += '<p class="nutri">Nessun allergene da segnalare.</p>';
    }
    h += '<div style="margin-top:10px"><button class="sharebtn" type="button" id="shareBtn">Condividi ricetta</button></div>';
    if(r.nutrition) h += '<p class="nutri">' + esc(r.nutrition) + '</p>';
    detailState = {r: r, base: baseServings(r), n: baseServings(r)};
    if(detailState.base){
      h += '<div class="scaleRow">Porzioni: <button type="button" id="svMinus" aria-label="Meno porzioni">−</button> <strong id="svCount">' + detailState.n + '</strong> <button type="button" id="svPlus" aria-label="Più porzioni">+</button> <span class="scaleNote" id="svNote"></span></div>';
    }
    h += '<div id="ingBox">' + ingredientsHtml(r, 1) + '</div>';
    if(r.steps && r.steps.length){
      h += '<h4>Procedimento</h4><ol>';
      r.steps.forEach(function(s){ h += '<li>' + esc(s) + '</li>'; });
      h += '</ol>';
    }
    sheet.innerHTML = h;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    $('closeBtn').addEventListener('click', closeDetail);
    var shareBtn = $('shareBtn');
    if(shareBtn) shareBtn.addEventListener('click', function(){
      var url = location.origin + location.pathname + '#ricetta=' + r.slug;
      if(navigator.share){
        navigator.share({title: r.title + ' — I Tramin', url: url}).catch(function(){});
      } else if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(url).then(function(){
          shareBtn.textContent = 'Link copiato ✓';
          setTimeout(function(){ shareBtn.textContent = 'Condividi ricetta'; }, 2000);
        });
      }
    });
    if(detailState.base){
      $('svMinus').addEventListener('click', function(){ setServings(detailState.n - 1); });
      $('svPlus').addEventListener('click', function(){ setServings(detailState.n + 1); });
    }
    try{ history.replaceState(null, '', '#ricetta=' + r.slug); }catch(e){}
    sheet.scrollTop = 0; overlay.scrollTop = 0;
  }
  function setServings(n){
    if(!detailState.r || !detailState.base) return;
    detailState.n = Math.max(1, Math.min(24, n));
    $('svCount').textContent = detailState.n;
    var f = detailState.n / detailState.base;
    $('ingBox').innerHTML = ingredientsHtml(detailState.r, f);
    $('svNote').textContent = (f === 1) ? '' : 'quantità ricalcolate per ' + detailState.n + ' porzioni; i passaggi restano quelli originali';
  }
  function closeDetail(){
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    try{ history.replaceState(null, '', location.pathname); }catch(e){}
  }
  overlay.addEventListener('click', function(e){ if(e.target === overlay) closeDetail(); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeDetail(); });
  var hashMatch = (location.hash || '').match(/ricetta=([a-z0-9\-]+)/i);
  if(hashMatch) openDetail(hashMatch[1]);

  /* ---- Calcolatore sous vide ---- */
  var BEEF_DONE = {'Al sangue':52,'Media al sangue':55,'Media':58,'Media ben cotta':62,'Ben cotta':66};
  var PORK_DONE = {'Rosato':58,'Medio':60,'Ben cotto':65};
  var SV_CUTS = [
    {id:'filetto-manzo', label:'Manzo — filetto', type:'steak', factor:0.55, done:BEEF_DONE, defDone:'Media al sangue', defThick:5, finish:'Rosolatura veloce, 1 minuto per lato.'},
    {id:'controfiletto', label:'Manzo — controfiletto / entrecôte', type:'steak', done:BEEF_DONE, defDone:'Media al sangue', defThick:3, finish:'Rosolatura 1 minuto per lato.'},
    {id:'fiorentina', label:'Manzo — fiorentina (T-bone)', type:'steak', done:BEEF_DONE, defDone:'Media al sangue', defThick:4, finish:'Rosolatura 1 minuto per lato, più 30 secondi sui bordi e sull\u2019osso.'},
    {id:'ribeye', label:'Manzo — ribeye / costata', type:'steak', done:BEEF_DONE, defDone:'Media al sangue', defThick:4, finish:'Rosolatura 1 minuto per lato.'},
    {id:'picanha', label:'Manzo — picanha', type:'steak', done:BEEF_DONE, defDone:'Media al sangue', defThick:5, finish:'Rosolatura dal lato del grasso, poi a fette contro fibra.'},
    {id:'bavetta', label:'Manzo — bavetta / diaframma', type:'steak', done:BEEF_DONE, defDone:'Media al sangue', defThick:2, finish:'Rosolatura forte e breve; tagliare contro fibra.'},
    {id:'girello', label:'Manzo — girello / magatello (arrosto)', type:'steak', factor:0.6, done:BEEF_DONE, defDone:'Media al sangue', defThick:8, finish:'Rosolatura su tutti i lati prima di affettare.'},
    {id:'cappello-prete', label:'Manzo — cappello del prete intero (brasato)', type:'braise', temp:79, anchors:[[3,2.5],[4,3.5],[5,5],[6,6.5],[8,9],[10,12]], defThick:8, finish:'A fine cottura riduci il fondo in padella e affetta contro fibra.', slowNote:'Lo stesso taglio in slow cook: LOW circa 8 ore, HIGH circa 4 ore.'},
    {id:'guancia', label:'Manzo — guancia', type:'braise', temp:75, anchors:[[3,6],[4,8],[5,10],[6,12]], defThick:5, finish:'Fondo ristretto in padella; la guancia si sfalda con la forchetta.', slowNote:'In slow cook: LOW circa 8 ore, HIGH circa 4 ore.'},
    {id:'coda', label:'Manzo — coda', type:'braise', temp:79, anchors:[[4,7],[5,8],[6,10],[7,12]], defThick:5, finish:'Stacca la polpa dall\u2019osso e rimettila nel fondo ristretto.', slowNote:'In slow cook: LOW circa 8 ore, HIGH circa 4 ore.'},
    {id:'brasato-generico', label:'Manzo — altro taglio da brasato (intero)', type:'braise', temp:79, anchors:[[3,2.5],[4,3.5],[5,5],[6,6.5],[8,9],[10,12]], defThick:7, finish:'Rosola prima di mettere in sacchetto, o a fine cottura; riduci il fondo.', slowNote:'In slow cook: LOW circa 8 ore, HIGH circa 4 ore.'},
    {id:'filetto-maiale', label:'Maiale — filetto', type:'steak', factor:0.55, done:PORK_DONE, defDone:'Medio', defThick:5, finish:'Rosolatura su tutti i lati, poi 5 minuti di riposo.'},
    {id:'braciole-maiale', label:'Maiale — braciole / lombo', type:'steak', done:PORK_DONE, defDone:'Medio', defThick:2.5, finish:'Rosolatura 1–2 minuti per lato.'},
    {id:'pancia-maiale', label:'Maiale — pancia', type:'braise', temp:73, anchors:[[3,4],[5,6],[7,8],[9,10]], defThick:5, finish:'Pelle croccante in forno o padella rovente a fine cottura.'},
    {id:'costine-maiale', label:'Maiale — costine', type:'braise', temp:74, anchors:[[4,6],[5,7],[6,8],[8,10]], defThick:5, finish:'Glassa con salsa barbecue e passa 10 minuti in forno caldo.'},
    {id:'spalla-maiale', label:'Maiale — spalla / coppa intera', type:'braise', temp:75, anchors:[[6,8],[8,10],[10,12]], defThick:8, finish:'Sfilaccia con due forchette e condisci con il fondo.'},
    {id:'petto-pollo', label:'Pollo — petto', type:'steak', factor:0.85, done:{'Succoso':62,'Classico':65}, defDone:'Succoso', defThick:3, finish:'Rosolatura breve, 1 minuto per lato.'},
    {id:'coscia-pollo', label:'Pollo — coscia disossata', type:'steak', temp:65, defThick:3, finish:'Rosolatura dal lato della pelle, se presente.'},
    {id:'coscia-pollo-osso', label:'Pollo — coscia con osso', type:'braise', temp:75, anchors:[[4,2],[5,2.5],[6,3]], defThick:5, finish:'Rosolatura dal lato della pelle.'},
    {id:'petto-anatra', label:'Anatra — petto', type:'steak', done:{'Rosa':57,'Medio':60,'Ben cotto':63}, defDone:'Rosa', defThick:3, finish:'Pelle croccante in padella fredda portata a calore, 5–6 minuti.'},
    {id:'carre-agnello', label:'Agnello — carré / braciole', type:'steak', factor:0.75, done:BEEF_DONE, defDone:'Media al sangue', defThick:4, finish:'Rosolatura 1 minuto per lato.'},
    {id:'cosciotto-agnello', label:'Agnello — cosciotto / spalla', type:'braise', temp:68, anchors:[[6,8],[8,10],[10,12]], defThick:8, finish:'Rosolatura prima del sacchetto o a fine cottura.'},
    {id:'salmone', label:'Pesce — salmone', type:'fish', done:{'Fondente':45,'Morbido':48,'Cotto':52}, defDone:'Morbido', defThick:3, finish:'Servire così com\u2019è; pelle croccante in padella se gradita.'},
    {id:'pesce-bianco', label:'Pesce — filetti bianchi (branzino, merluzzo)', type:'fish', temp:51, defThick:2.5, finish:'Servire subito, si sfalda facilmente.'},
    {id:'tonno', label:'Pesce — tonno (trancio)', type:'fish', temp:45, defThick:3, finish:'Scottatura velocissima in padella, 20 secondi per lato.'},
    {id:'polpo', label:'Polpo', type:'fixed', temp:82, hours:[4,5], defThick:6, finish:'Asciuga e passa 1–2 minuti per lato su piastra rovente.'},
    {id:'gamberi', label:'Gamberi', type:'fixed', temp:60, hours:[0.5,0.75], defThick:2, finish:'Pronti da servire, anche tiepidi in insalata.'},
    {id:'capesante', label:'Capesante', type:'fixed', temp:60, hours:[0.5,0.67], defThick:3, finish:'Scottatura 30 secondi per lato in padella rovente.'},
    {id:'uova', label:'Uova in guscio', type:'fixed', done:{'Morbido cremoso':63,'Sodo':75}, defDone:'Morbido cremoso', hours:[1,1], defThick:5, finish:'Raffredda in acqua fredda prima di sgusciare.'},
    {id:'verdure', label:'Verdure', type:'fixed', temp:83, hours:[1,1.5], defThick:3, finish:'Condisci a crudo con olio e sale.'}
  ];
  var svCut = $('svCut'), svThick = $('svThick'), svDone = $('svDone'), svDoneLabel = $('svDoneLabel'), svResult = $('svResult');
  SV_CUTS.forEach(function(c){
    var op = document.createElement('option'); op.value = c.id; op.textContent = c.label; svCut.appendChild(op);
  });
  function svCurrent(){ var v = svCut.value; for(var i=0;i<SV_CUTS.length;i++) if(SV_CUTS[i].id===v) return SV_CUTS[i]; return SV_CUTS[0]; }
  function svRound5(m){ return Math.max(5, Math.round(m/5)*5); }
  function svInterp(anchors, cm){
    if(cm <= anchors[0][0]) return anchors[0][1];
    for(var i=1;i<anchors.length;i++){
      if(cm <= anchors[i][0]){
        var a=anchors[i-1], b=anchors[i];
        return a[1] + (b[1]-a[1]) * (cm-a[0])/(b[0]-a[0]);
      }
    }
    return anchors[anchors.length-1][1];
  }
  function svSetupDone(cut){
    svDone.innerHTML = '';
    if(cut.done){
      Object.keys(cut.done).forEach(function(k){
        var op = document.createElement('option'); op.value = k; op.textContent = k; svDone.appendChild(op);
      });
      svDone.value = cut.defDone || Object.keys(cut.done)[0];
      svDone.style.display = ''; svDoneLabel.style.display = '';
    } else {
      svDone.style.display = 'none'; svDoneLabel.style.display = 'none';
    }
  }
  function svCalc(){
    var cut = svCurrent();
    var cm = parseFloat(svThick.value) || cut.defThick;
    var temp = cut.temp;
    if(cut.done) temp = cut.done[svDone.value];
    var tMin, tMax, extra = '';
    if(cut.type === 'steak'){
      var dmm = cm*10;
      tMin = svRound5(0.105 * dmm * dmm * (cut.factor || 1));
      tMax = tMin + (tMin <= 90 ? 30 : 45);
    } else if(cut.type === 'fish'){
      tMin = Math.round(20 + 9*cm);
      tMax = tMin + 15;
    } else if(cut.type === 'braise'){
      var h = svInterp(cut.anchors, cm);
      tMin = Math.round(h*60/30)*30;
      tMax = Math.round(h*1.2*60/30)*30;
    } else {
      tMin = Math.round(cut.hours[0]*60);
      tMax = Math.round(cut.hours[1]*60);
    }
    var html = '<strong style="font-size:22px">' + temp + ' °C</strong> &nbsp;·&nbsp; tempo consigliato: <strong>' +
      (tMin === tMax ? fmtTime(tMin) : 'da ' + fmtTime(tMin) + ' a ' + fmtTime(tMax)) + '</strong>';
    html += '<br><span style="color:var(--muted);font-size:14px">' + (cut.type === 'braise' ? 'Tempo minimo per ottenere la tenerezza: ' : 'Tempo minimo per portare il cuore a temperatura: ') + fmtTime(tMin) + '.</span>';
    if(temp < 54){
      if(tMin > 150) html += '<br><span style="color:var(--warn)">Attenzione: con questo spessore il cuore non arriva a temperatura entro il limite di sicurezza per i ' + temp + ' °C (massimo 2 ore e mezza sotto i 54 °C). Parti da almeno 54 °C.</span>';
      else if(tMax > 150) html += '<br><span style="color:var(--warn)">Attenzione: sotto i 54 °C non superare le 2 ore e mezza di cottura in totale.</span>';
    }
    if(cut.finish) html += '<br>Finitura: ' + esc(cut.finish);
    if(cut.slowNote) html += '<br><span style="color:var(--muted)">' + esc(cut.slowNote) + '</span>';
    svResult.innerHTML = html;
  }
  svCut.addEventListener('change', function(){
    var cut = svCurrent();
    svThick.value = cut.defThick;
    svSetupDone(cut);
    svCalc();
  });
  svThick.addEventListener('input', svCalc);
  svDone.addEventListener('change', svCalc);
  svSetupDone(svCurrent());
  svCalc();

  $('btnRecipes').addEventListener('click', function(){
    $('viewRecipes').style.display = ''; $('viewGuide').style.display = 'none';
    $('btnRecipes').classList.add('on'); $('btnGuide').classList.remove('on');
  });
  $('btnGuide').addEventListener('click', function(){
    $('viewRecipes').style.display = 'none'; $('viewGuide').style.display = '';
    $('btnGuide').classList.add('on'); $('btnRecipes').classList.remove('on');
  });

  apply();
})();
