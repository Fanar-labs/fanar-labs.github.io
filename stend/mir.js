// mir.js — ЯДРО МИРА. Ничего не знает ни про экран, ни про наблюдателя.
// Один и тот же файл крутит и стенд (с картинкой), и прогонялка (в фоновых потоках).

function createMir(cfg){
  cfg = cfg || {};

  // ---------- физика (это устройство мира, не политика существ) ----------
  const CW = 90, CH = 60;
  const MAX_E = 100, START_E = 45;
  const METAB = 0.14, MOVE_COST = 0.10, EAT_YIELD = 26;
  const REPRO_E = 82, REPRO_AGE = 90, MAX_AGE = 1600;
  const SIGHT = 6;
  const RAID_COST = 1.4, RAID_TAKE = 0.28, GIFT_FRAC = 0.12;
  const MUT = 0.13;
  const MEM = 3, ACQ_MAX = 8;
  const NI = 9 + MEM, NH = 8, NO = 5 + MEM;
  const NW = NI*NH + NH + NH*NO + NO;
  const GROWN_AGE = 300;     // с какого возраста смерть считается «пожившей»
  const MET_MIN = 50;        // сколько раз рядом должен был оказаться сосед, чтобы «случай был»

  // ---------- ручки ----------
  const M = {
    press: cfg.press !== undefined ? cfg.press : 52,
    mobility: cfg.mobility !== undefined ? cfg.mobility : 0.75,
    seed: cfg.seed !== undefined ? cfg.seed : 1,
    CW, CH, MAX_E, MEM, GROWN_AGE, NW,
  };

  // ---------- воспроизводимая случайность ----------
  let rngState = 0;
  function rnd(){
    rngState |= 0; rngState = rngState + 0x6D2B79F5 | 0;
    let t = Math.imul(rngState ^ rngState >>> 15, 1 | rngState);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  function gauss(){ return (rnd()+rnd()+rnd()+rnd()+rnd()+rnd()-3)/1.5; }

  function newGenome(){ const g = new Float32Array(NW); for (let i=0;i<NW;i++) g[i] = gauss()*1.1; return g; }
  function mutate(g){ const c = new Float32Array(NW); for (let i=0;i<NW;i++) c[i] = g[i] + gauss()*MUT; return c; }

  // буферы на весь мир: раньше здесь рождалось по четыре массива на существо за такт
  const _x = new Float32Array(NI), _h = new Float32Array(NH), _o = new Float32Array(NO);
  const _inp = new Float32Array(9);
  function think(g, mem){                       // вход берёт из _inp, новую память пишет в mem
    for (let i=0;i<9;i++) _x[i] = _inp[i];
    for (let i=0;i<MEM;i++) _x[9+i] = mem[i];
    let k = 0;
    for (let j=0;j<NH;j++){ let s=0; for (let i=0;i<NI;i++) s += _x[i]*g[k++]; _h[j] = Math.tanh(s); }
    for (let j=0;j<NH;j++) _h[j] = Math.tanh(_h[j] + g[k++]);
    for (let j=0;j<NO;j++){ let s=0; for (let i=0;i<NH;i++) s += _h[i]*g[k++]; _o[j] = s; }
    for (let j=0;j<NO;j++) _o[j] += g[k++];
    let best = 0; for (let j=1;j<5;j++) if (_o[j] > _o[best]) best = j;
    for (let i=0;i<MEM;i++) mem[i] = Math.tanh(_o[5+i]);   // вход уже скопирован, писать безопасно
    return best;
  }

  function makeBeing(x, y, genome, line, gen){
    return { id: M.nextId++, x, y, e: START_E, age: 0, g: genome, line, gen,
             mem: new Float32Array(MEM), know: new Map(), raided: 0, gave: 0, met: 0 };
  }

  function remember(b, otherId, delta){
    const cur = b.know.get(otherId) || 0;
    b.know.set(otherId, Math.max(-4, Math.min(4, cur + delta)));
    if (b.know.size > ACQ_MAX){
      let weakest = null, wv = 1e9;
      for (const [id, v] of b.know){ if (Math.abs(v) < wv){ wv = Math.abs(v); weakest = id; } }
      b.know.delete(weakest);
    }
  }

  // карта видимости: для каждой клетки — лучшая еда в квадрате 13×13 вокруг и её адрес.
  // Считается раз за такт скользящим максимумом (два прохода), а не 169 чтениями на существо.
  let hMax, hArg, vMax, vArg, dqI, dqV;
  const BX = Math.ceil(CW/6), BY = Math.ceil(CH/6);
  const bHead = new Int32Array(BX*BY);
  let bNext = new Int32Array(2048);
  function allocView(){
    hMax = new Float32Array(CW*CH); hArg = new Int32Array(CW*CH);
    vMax = new Float32Array(CW*CH); vArg = new Int32Array(CW*CH);
    dqI = new Int32Array(Math.max(CW, CH) + 2*SIGHT + 4);
    dqV = new Float32Array(Math.max(CW, CH) + 2*SIGHT + 4);
  }
  function buildView(){
    const food = M.food, W = 2*SIGHT + 1;
    // проход по строкам
    for (let y=0; y<CH; y++){
      const row = y*CW;
      let head = 0, tail = 0;                       // дек индексов-кандидатов
      for (let k = -SIGHT; k < CW + SIGHT; k++){
        const x = ((k % CW) + CW) % CW, i = row + x, v = food[i];
        while (tail > head && dqV[tail-1] <= v) tail--;
        dqI[tail] = k; dqV[tail] = v; tail++;
        const centre = k - SIGHT;
        if (dqI[head] < centre - SIGHT) head++;
        if (centre >= 0 && centre < CW){
          const cx = dqI[head], sx = ((cx % CW) + CW) % CW;
          hMax[row + centre] = dqV[head]; hArg[row + centre] = row + sx;
        }
      }
    }
    // проход по столбцам
    for (let x=0; x<CW; x++){
      let head = 0, tail = 0;
      for (let k = -SIGHT; k < CH + SIGHT; k++){
        const y = ((k % CH) + CH) % CH, i = y*CW + x, v = hMax[i];
        while (tail > head && dqV[tail-1] <= v) tail--;
        dqI[tail] = k; dqV[tail] = v; tail++;
        const centre = k - SIGHT;
        if (dqI[head] < centre - SIGHT) head++;
        if (centre >= 0 && centre < CH){
          const cy = ((dqI[head] % CH) + CH) % CH;
          vMax[centre*CW + x] = dqV[head]; vArg[centre*CW + x] = hArg[cy*CW + x];
        }
      }
    }
  }

  M.reset = function(seed){
    if (seed !== undefined) M.seed = seed;
    rngState = M.seed >>> 0;
    M.food = new Float32Array(CW*CH);
    for (let i=0;i<M.food.length;i++) M.food[i] = rnd();
    M.beings = []; M.tick = 0; M.genMax = 0; M.nextId = 1;
    M.deaths = []; M.raidWin = []; M.giftWin = []; M.log = [];
    M.clearCounters();
    allocView();
    for (let i=0;i<140;i++)
      M.beings.push(makeBeing(rnd()*CW, rnd()*CH, newGenome(), Math.floor(rnd()*360), 0));
    M.say('прогон начат, сид ' + M.seed);
  };

  M.clearCounters = function(){
    M.revengeHits = M.revengeAll = M.recipHits = M.recipAll = 0;
    M.foeMeet = M.friendMeet = M.allMeet = M.knownMeet = 0;
  };

  M.say = function(t){ M.log.unshift('т.' + M.tick + ' — ' + t); if (M.log.length > 40) M.log.pop(); };

  function idx(cx, cy){ return ((cy+CH)%CH)*CW + ((cx+CW)%CW); }

  M.growth = function(){ return 0.00015 + Math.pow(M.press/100, 2.1) * 0.0060; };

  M.step = function(){
    const growth = M.growth();
    const food = M.food, beings = M.beings;
    for (let i=0;i<food.length;i++) food[i] += growth * (1 - food[i]);
    buildView();

    if (bNext.length < beings.length) bNext = new Int32Array(beings.length*2);
    bHead.fill(-1);
    for (let i=0;i<beings.length;i++){
      const b = beings[i];
      const k = ((b.y/6)|0)*BX + ((b.x/6)|0);
      bNext[i] = bHead[k]; bHead[k] = i;
    }
    function nearest(b){
      let best = null, bd = 1e9;
      const bx = (b.x/6)|0, by = (b.y/6)|0;
      for (let dy=-1; dy<=1; dy++){
        const yy = by + dy; if (yy < 0 || yy >= BY) continue;
        for (let dx=-1; dx<=1; dx++){
          const xx = bx + dx; if (xx < 0 || xx >= BX) continue;
          for (let i = bHead[yy*BX + xx]; i !== -1; i = bNext[i]){
            const o = beings[i];
            if (o === b || o.e <= 0) continue;
            const ddx = o.x-b.x, ddy = o.y-b.y, d = ddx*ddx + ddy*ddy;
            if (d < bd){ bd = d; best = o; }
          }
        }
      }
      return (best && bd < 9) ? best : null;
    }

    let raids = 0, gifts = 0;
    const born = [];

    for (const b of beings){
      if (b.e <= 0) continue;
      const cx = Math.floor(b.x), cy = Math.floor(b.y);

      const me = idx(cx, cy);
      const bestF = vMax[me], arg = vArg[me];
      const ax = arg % CW, ay = (arg / CW) | 0;
      let bfx = ax - cx, bfy = ay - cy;                    // кратчайший путь по тору
      if (bfx >  CW/2) bfx -= CW; if (bfx < -CW/2) bfx += CW;
      if (bfy >  CH/2) bfy -= CH; if (bfy < -CH/2) bfy += CH;
      const here = food[me];
      const nb = nearest(b);
      const score = nb ? (b.know.get(nb.id) || 0) : 0;

      if (nb){
        b.met++;
        M.allMeet++;
        if (b.know.has(nb.id)) M.knownMeet++;
        if (score < 0) M.foeMeet++; else if (score > 0) M.friendMeet++;
      }

      _inp[0] = 1 - b.e/MAX_E;
      _inp[1] = here;
      _inp[2] = bestF;
      _inp[3] = Math.min(1, Math.sqrt(bfx*bfx+bfy*bfy)/SIGHT);
      _inp[4] = nb ? 1 : 0;
      _inp[5] = nb ? Math.min(2, nb.e/Math.max(1,b.e))/2 : 0;
      _inp[6] = nb ? (Math.abs(((nb.line-b.line+540)%360)-180)/180) : 0;
      _inp[7] = score/4;
      _inp[8] = 1;

      const act = think(b.g, b.mem);
      b.e -= METAB;

      if (act === 0){
        const d = Math.sqrt(bfx*bfx + bfy*bfy) || 1;
        b.x = (b.x + bfx/d*M.mobility + CW) % CW;
        b.y = (b.y + bfy/d*M.mobility + CH) % CH;
        b.e -= MOVE_COST;
      } else if (act === 1){
        const take = Math.min(here, 0.34);
        food[me] -= take;
        b.e = Math.min(MAX_E, b.e + take*EAT_YIELD);
      } else if (act === 2){
        b.e -= RAID_COST;
        if (nb){
          M.revengeAll++; if (score < 0) M.revengeHits++;
          const p = b.e / (b.e + nb.e);
          if (rnd() < p){
            const got = nb.e * RAID_TAKE;
            nb.e -= got; b.e = Math.min(MAX_E, b.e + got*0.8);
          }
          remember(nb, b.id, -1);
          b.raided++; raids++;
        }
      } else if (act === 3){
        if (nb){
          M.recipAll++; if (score > 0) M.recipHits++;
          const give = b.e * GIFT_FRAC;
          b.e -= give; nb.e = Math.min(MAX_E, nb.e + give);
          remember(nb, b.id, +1);
          b.gave++; gifts++;
        }
      } else {
        b.e += METAB*0.45;
        b.x = (b.x + (rnd()-0.5)*0.1 + CW) % CW;
      }

      b.age++;
      if (b.e > REPRO_E && b.age > REPRO_AGE){
        b.e /= 2;
        const child = makeBeing((b.x + (rnd()-0.5)*2 + CW)%CW, (b.y + (rnd()-0.5)*2 + CH)%CH,
                                mutate(b.g), (b.line + Math.round(gauss()*4) + 360)%360, b.gen+1);
        child.e = b.e;
        born.push(child);
        if (child.gen > M.genMax){
          M.genMax = child.gen;
          if (M.genMax % 50 === 0) M.say('поколение ' + M.genMax);
        }
      }
    }

    const alive = [];
    for (const b of beings){
      if (b.e <= 0 || b.age > MAX_AGE){
        M.deaths.push({ raided: b.raided, gave: b.gave, age: b.age, met: b.met });
        if (M.deaths.length > 400) M.deaths.shift();
        if (M.picked === b) M.picked = null;
      } else alive.push(b);
    }
    M.beings = alive.concat(born);

    M.raidWin.push(raids); if (M.raidWin.length > 100) M.raidWin.shift();
    M.giftWin.push(gifts); if (M.giftWin.length > 100) M.giftWin.shift();

    if (M.beings.length < 12){
      for (let i=0;i<24;i++)
        M.beings.push(makeBeing(rnd()*CW, rnd()*CH, newGenome(), Math.floor(rnd()*360), M.genMax));
      M.say('мир почти вымер — подсеяно 24 случайных');
    }
    if (M.beings.length > 1200) M.beings.length = 1200;

    M.tick++;
  };

  // ---------- замеры ----------
  M.metrics = function(){
    const grown = M.deaths.filter(d => d.age > GROWN_AGE);
    const cleanG = grown.filter(d => d.raided === 0).length;
    const fair = grown.filter(d => d.met > MET_MIN);          // у кого случай был
    const cleanF = fair.filter(d => d.raided === 0).length;
    const cleanA = M.deaths.filter(d => d.raided === 0).length;
    const P = (a, b) => b > 0 ? a/b : null;
    let acq = 0; for (const b of M.beings) acq += b.know.size;
    return {
      tick: M.tick, pop: M.beings.length, gen: M.genMax,
      grownN: grown.length, fairN: fair.length,
      tailFair: P(cleanF, fair.length),          // ГЛАВНОЕ: не отнял, хотя соседи были рядом
      tail:    P(cleanG, grown.length),          // не отнял ни разу, среди поживших
      met: grown.length ? grown.reduce((a,d)=>a+d.met,0)/grown.length : 0,
      tailAll: P(cleanA, M.deaths.length),       // то же, но со всеми — завышает
      life: M.deaths.length ? M.deaths.reduce((a,d)=>a+d.age,0)/M.deaths.length : 0,
      acq: M.beings.length ? acq/M.beings.length : 0,
      raids: M.raidWin.reduce((a,c)=>a+c,0),
      gifts: M.giftWin.reduce((a,c)=>a+c,0),
      revenge: P(M.revengeHits, M.revengeAll), revengeBase: P(M.foeMeet, M.allMeet),
      recip:   P(M.recipHits, M.recipAll),      recipBase:   P(M.friendMeet, M.allMeet),
      repeat:  P(M.knownMeet, M.allMeet),
      raidEvents: M.revengeAll, giftEvents: M.recipAll,
    };
  };

  M.reset(M.seed);
  return M;
}

if (typeof module !== 'undefined') module.exports = { createMir };
