// 단일 Lap 버튼 → 다중 레인 자동 배정 전략 벤치마크
// 레인별 구간(segment) 시간(초)을 시뮬레이션하여, 출발 다이브 효과와
// length마다 도착 순서가 바뀌는 경우(예: 갈때 2-3-4-5, 올때 2-4-3-5)의
// 자동 배정 정확도를 전략별로 비교한다.

// ---- 시나리오: lane별 segment 시간(초) ----
const scenarios = {
  // 일관 순서(역전 없음)
  'A_순서일관': {
    2: [12.8, 13.2, 13.3, 13.4],
    3: [13.1, 13.5, 13.6, 13.7],
    4: [13.4, 13.8, 13.9, 14.0],
    5: [13.8, 14.1, 14.2, 14.3],
  },
  // 사용자 예시: 갈때 2-3-4-5, 올때 2-4-3-5 (seg1에서 L4가 L3 추월)
  'B_복귀역전': {
    2: [12.8, 13.2, 13.3, 13.4], // cum 12.8 26.0 39.3 52.7
    3: [13.0, 13.7, 13.6, 14.0], // cum 13.0 26.7 40.3 54.3
    4: [13.3, 13.2, 13.5, 13.6], // cum 13.3 26.5 40.0 53.6
    5: [13.8, 14.0, 14.2, 14.3], // cum 13.8 27.8 42.0 56.3
  },
  // 매 구간 리드 교차(여러 번 역전)
  'C_난전': {
    2: [13.0, 13.6, 13.2, 13.8],
    3: [13.1, 13.3, 13.7, 13.4],
    4: [13.2, 13.5, 13.3, 13.6],
    5: [13.15, 13.45, 13.5, 13.5],
  },
  // 초접전(0.3초 이내 밀집)
  'D_초접전': {
    2: [13.00, 13.30, 13.32, 13.40],
    3: [13.08, 13.34, 13.28, 13.46],
    4: [13.12, 13.26, 13.36, 13.38],
    5: [13.18, 13.40, 13.30, 13.50],
  },
  // 큰 격차(쉬움)
  'E_큰격차': {
    2: [12.5, 12.8, 12.9, 13.0],
    3: [13.5, 13.8, 13.9, 14.0],
    4: [14.5, 14.8, 14.9, 15.0],
    5: [15.5, 15.8, 15.9, 16.0],
  },
};

const SEG = 4;

function buildTaps(lanes){
  const laneIds = Object.keys(lanes).map(Number);
  const taps = [];
  for (const id of laneIds){
    let cum = 0;
    lanes[id].forEach((d, seg) => { cum += d; taps.push({ lane:id, seg, t:cum }); });
  }
  taps.sort((a,b) => a.t - b.t);
  // round0(seg==0) 도착 순서로 slot 정의
  const seg0 = taps.filter(x => x.seg===0).sort((a,b)=>a.t-b.t);
  const slotOfLane = {}; // lane -> slotIndex
  seg0.forEach((x,i)=> slotOfLane[x.lane] = i);
  return { taps, laneIds, slotOfLane };
}

// slot 상태 초기화
function initSlots(n){
  return Array.from({length:n},(_,i)=>({ idx:i, splits:[], lastCum:0, nextSeg:0 }));
}
function paceAvg(s){ return s.splits.reduce((a,b)=>a+b,0)/s.splits.length; }
function paceLast(s){ return s.splits.at(-1); }
function paceEwma(s,a=0.5){ let p=s.splits[0]; for(let i=1;i<s.splits.length;i++) p=a*s.splits[i]+(1-a)*p; return p; }

// ---- 전략들: taps -> 각 tap의 예측 slotIdx ----

// 1) 라운드로빈(순서 고정 가정): 각 round에서 slot 0..n-1 순서로
function stratRoundRobin({taps, slotCount}){
  const pred = new Map();
  const slots = initSlots(slotCount);
  // 라운드 = segment 단위(라운드 감지 가정)
  for (let seg=0; seg<SEG; seg++){
    const round = taps.filter(x=>x.seg===seg).sort((a,b)=>a.t-b.t);
    round.forEach((tap, i)=>{ pred.set(tap, i); slots[i].splits.push(tap.t-slots[i].lastCum); slots[i].lastCum=tap.t; });
  }
  return pred;
}

// 2) 그리디 최근접(예측 arrival = lastCum + pace)
function stratGreedy(paceFn){
  return ({taps, slotCount})=>{
    const pred = new Map();
    const slots = initSlots(slotCount);
    for (const tap of taps){
      const active = slots.filter(s=>s.nextSeg<SEG);
      let best=active[0], bs=Infinity;
      for(const s of active){
        const pace = s.splits.length? paceFn(s) : 1e9; // 첫 구간 전엔 도착 순서로
        const exp = s.splits.length? s.lastCum+pace : Infinity;
        const sc = Math.abs(tap.t-exp);
        if(sc<bs){bs=sc;best=s;}
      }
      // 첫 라운드(아무 slot도 split 없을 때)는 가장 낮은 미기록 slot
      if(active.every(s=>s.splits.length===0) || best.splits.length===0){
        best = active.find(s=>s.splits.length<=Math.min(...active.map(a=>a.splits.length))) || active[0];
      }
      pred.set(tap, best.idx);
      best.splits.push(tap.t-best.lastCum); best.lastCum=tap.t; best.nextSeg++;
    }
    return pred;
  };
}

// 3) 라운드 단조 매칭(직선상 점-점 최소비용 = 정렬 후 순서 매칭)
function stratMonotonic(paceFn){
  return ({taps, slotCount})=>{
    const pred = new Map();
    const slots = initSlots(slotCount);
    for (let seg=0; seg<SEG; seg++){
      const round = taps.filter(x=>x.seg===seg).sort((a,b)=>a.t-b.t);
      const active = slots.filter(s=>s.nextSeg===seg);
      if (seg===0){ // 도착 순서로 slot 정의
        round.forEach((tap,i)=>{ pred.set(tap,i); slots[i].splits.push(tap.t); slots[i].lastCum=tap.t; slots[i].nextSeg=1; });
        continue;
      }
      // 예측 arrival로 slot 정렬
      const order = active.map(s=>({s, exp:s.lastCum+paceFn(s)})).sort((a,b)=>a.exp-b.exp);
      round.forEach((tap,i)=>{ const s=order[i].s; pred.set(tap,s.idx); s.splits.push(tap.t-s.lastCum); s.lastCum=tap.t; s.nextSeg++; });
    }
    return pred;
  };
}

// 4) 레인-이력 모드: 각 slot이 어느 선수인지 알고(레인 사전배정),
//    그 선수의 '과거 구간 프로파일(history)'로 도착 예측 → 순서 역전 포착
function stratLaneHistory(histories){
  return ({taps, slotCount, slotOfLane, laneIds})=>{
    const pred = new Map();
    const laneOfSlot = {}; for(const l of laneIds) laneOfSlot[slotOfLane[l]] = l;
    const slots = initSlots(slotCount);
    for (let seg=0; seg<SEG; seg++){
      const round = taps.filter(x=>x.seg===seg).sort((a,b)=>a.t-b.t);
      const active = slots.filter(s=>s.nextSeg===seg);
      // 예측 arrival = lastCum + 해당 선수 history의 이 구간 시간
      const order = active.map(s=>({s, exp:s.lastCum + histories[laneOfSlot[s.idx]][seg]})).sort((a,b)=>a.exp-b.exp);
      round.forEach((tap,i)=>{ const s=order[i].s; pred.set(tap,s.idx); s.lastCum=tap.t; s.nextSeg++; });
    }
    return pred;
  };
}

function accuracy(pred, taps, slotOfLane){
  let correct=0, total=0;
  for(const tap of taps){
    if(tap.seg===0) continue; // round0은 정의용
    total++;
    if(pred.get(tap) === slotOfLane[tap.lane]) correct++;
  }
  return { correct, total, pct: total? (correct/total*100):100 };
}

// history = 실제와 약간 다른(노이즈) 과거 프로파일
function makeHistory(lanes, noise=0.15){
  const h={};
  for(const id of Object.keys(lanes)) h[id]=lanes[id].map(v=> +(v + (Math.random()*2-1)*noise).toFixed(3));
  return h;
}

const strategies = {
  '라운드로빈(순서고정)': stratRoundRobin,
  '그리디-평균페이스(구)': stratGreedy(paceAvg),
  '그리디-최근구간': stratGreedy(paceLast),
  '단조매칭-평균': stratMonotonic(paceAvg),
  '단조매칭-최근': stratMonotonic(paceLast),
  '단조매칭-EWMA': stratMonotonic(s=>paceEwma(s,0.6)),
};

console.log('=== 100(4×25) · 4레인 · 자동 배정 정확도(%) ===\n');
const names = Object.keys(scenarios);
const stratNames = Object.keys(strategies);
const pad = s => String(s).padEnd(22);
const padn = s => String(s).padStart(9);

// 헤더
process.stdout.write(pad('전략'));
names.forEach(n=>process.stdout.write(padn(n)));
process.stdout.write(padn('평균')+'\n');

const totals = {};
for(const sn of stratNames){
  process.stdout.write(pad(sn));
  let sum=0;
  for(const scn of names){
    const lanes = scenarios[scn];
    const ctx = buildTaps(lanes);
    const pred = strategies[sn]({...ctx, slotCount:Object.keys(lanes).length});
    const a = accuracy(pred, ctx.taps, ctx.slotOfLane);
    sum += a.pct;
    process.stdout.write(padn(a.pct.toFixed(0)+'%'));
  }
  const avg = sum/names.length; totals[sn]=avg;
  process.stdout.write(padn(avg.toFixed(1)+'%')+'\n');
}

// 레인-이력 모드(여러 노이즈 평균)
process.stdout.write('\n'+pad('레인이력(사전배정)'));
let lhSum=0;
for(const scn of names){
  const lanes = scenarios[scn];
  let acc=0; const TRIALS=200;
  for(let t=0;t<TRIALS;t++){
    const ctx = buildTaps(lanes);
    const hist = makeHistory(lanes, 0.15);
    const pred = stratLaneHistory(hist)({...ctx, slotCount:Object.keys(lanes).length});
    acc += accuracy(pred, ctx.taps, ctx.slotOfLane).pct;
  }
  acc/=TRIALS; lhSum+=acc;
  process.stdout.write(padn(acc.toFixed(0)+'%'));
}
process.stdout.write(padn((lhSum/names.length).toFixed(1)+'%')+'\n');
