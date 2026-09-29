"use strict";

/* ================================================================
   Cliente de SolarLab
   La interfaz conserva las mismas rutas de la API, pero organiza la
   lógica del navegador en bloques independientes para facilitar su
   mantenimiento.
   ================================================================ */
const qs = (selector, root = document) => root.querySelector(selector);
const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const numberText = (value, decimals = 3) => value == null || Number.isNaN(value) ? "—" : Number(value).toFixed(decimals);
const shortNumber = new Intl.NumberFormat("es", {notation:"compact", maximumFractionDigits:1});
const PALETTE = ["#2563eb","#f59e0b","#dc2626","#9333a6","#169c6b","#64748b"];
const HIT = "#169c6b", MISS = "#dc2626";
const SCORE_FIELDS = [["accuracy","Accuracy"],["f1_macro","F1 macro"],["mcc","MCC"],["auc","AUC (OvR)"]];

const state = { models: [], pointCache: Object.create(null), lastQuery: null };
let viewA, viewB;

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  let payload = null;
  try { payload = await response.json(); } catch (_) {}
  if (!response.ok) throw new Error(payload?.error || `Error ${response.status}`);
  return payload;
}

function notify(message, kind = "success") {
  const toast = document.createElement("div");
  toast.className = `toast align-items-center text-bg-${kind} border-0`;
  toast.innerHTML = `<div class="d-flex"><div class="toast-body">${safe(message)}</div><button class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  qs("#toasts").appendChild(toast);
  toast.addEventListener("hidden.bs.toast", () => toast.remove());
  new bootstrap.Toast(toast, {delay:4500}).show();
}

const findModel = id => state.models.find(model => model.id === id);
const displayName = model => `${model.dataset.toUpperCase()} · #${model.rank ?? "-"} · ${model.modelo} · ${model.escalador}+${model.reductor}`;

// ----------------------------- visualización de puntos en canvas
class SpatialView {
  constructor(canvas, clickHandler) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.data = null;
    this.marker = null;
    this.mode = "pred";
    this.dimension = 300;
    this.onPointClick = clickHandler;
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    canvas.addEventListener("click", event => this.receiveClick(event));
  }
  load(data) { this.data = data; this.marker = null; this.paint(); }
  changeMode(mode) { this.mode = mode; this.paint(); }
  mark(lat, lon, nearest) { this.marker = {lat, lon, nearest}; this.paint(); }
  resize() {
    const width = Math.max(240, this.canvas.parentElement.clientWidth);
    const ratio = window.devicePixelRatio || 1;
    this.canvas.style.width = this.canvas.style.height = `${width}px`;
    this.canvas.width = this.canvas.height = Math.round(width * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.dimension = width;
    this.paint();
  }
  projection() {
    const bounds = this.data.bounds, padding = 34, size = this.dimension;
    const dx = (bounds.lon_max - bounds.lon_min) || 1;
    const dy = (bounds.lat_max - bounds.lat_min) || 1;
    const scale = Math.min((size - padding * 2) / dx, (size - padding * 2) / dy);
    this.mapping = {scale, ox:(size-dx*scale)/2, oy:(size-dy*scale)/2, bounds};
  }
  xy(lat, lon) {
    const {scale, ox, oy, bounds} = this.mapping;
    return [ox + (lon-bounds.lon_min)*scale, this.dimension-(oy+(lat-bounds.lat_min)*scale)];
  }
  geo(x, y) {
    const {scale, ox, oy, bounds} = this.mapping;
    return [(this.dimension-y-oy)/scale+bounds.lat_min, (x-ox)/scale+bounds.lon_min];
  }
  pointColor(point) {
    if (this.mode === "error") return point[3] === point[4] ? HIT : MISS;
    return PALETTE[(this.mode === "real" ? point[3] : point[4]) % PALETTE.length];
  }
  paint() {
    const g = this.context, size = this.dimension;
    g.clearRect(0,0,size,size);
    if (!this.data) return;
    this.projection();
    const {bounds, scale} = this.mapping;
    g.strokeStyle="#e4e9f1"; g.fillStyle="#8490a3"; g.font="10px system-ui"; g.lineWidth=1;
    for(let step=0; step<=4; step++){
      const lon=bounds.lon_min+(bounds.lon_max-bounds.lon_min)*step/4;
      const lat=bounds.lat_min+(bounds.lat_max-bounds.lat_min)*step/4;
      const [x]=this.xy(bounds.lat_min,lon), [,y]=this.xy(lat,bounds.lon_min);
      g.beginPath();g.moveTo(x,8);g.lineTo(x,size-22);g.stroke();
      g.beginPath();g.moveTo(30,y);g.lineTo(size-8,y);g.stroke();
      g.textAlign="center";g.fillText(shortNumber.format(lon),x,size-8);
      g.textAlign="right";g.fillText(shortNumber.format(lat),28,y+3);
    }
    const radius=Math.max(2.5,Math.min(9,0.5*this.data.median_nn*scale));
    const points=this.data.points;
    const ordered=this.mode === "error" ? [...points].sort((a,b)=>(a[3]===a[4])-(b[3]===b[4])).reverse() : points;
    ordered.forEach(point=>{
      const [x,y]=this.xy(point[0],point[1]);
      g.beginPath();g.arc(x,y,radius,0,Math.PI*2);g.fillStyle=this.pointColor(point);g.globalAlpha=.9;g.fill();
      g.globalAlpha=1;g.strokeStyle="rgba(255,255,255,.85)";g.lineWidth=.8;g.stroke();
    });
    if(this.marker){
      const [cx,cy]=this.xy(this.marker.lat,this.marker.lon);
      const [nx,ny]=this.xy(this.marker.nearest.lat,this.marker.nearest.lon);
      g.lineWidth=2;g.strokeStyle="#111827";g.beginPath();g.arc(nx,ny,radius+4,0,Math.PI*2);g.stroke();
      g.lineWidth=1.5;g.beginPath();g.moveTo(cx-9,cy);g.lineTo(cx+9,cy);g.moveTo(cx,cy-9);g.lineTo(cx,cy+9);g.stroke();
    }
  }
  receiveClick(event){
    if(!this.data)return;
    const rect=this.canvas.getBoundingClientRect();
    const [lat,lon]=this.geo(event.clientX-rect.left,event.clientY-rect.top);
    this.onPointClick(lat,lon);
  }
}

// ---------------------------------------------- datos y selectores
async function pointsFor(modelId){
  if(!state.pointCache[modelId]) state.pointCache[modelId]=await requestJson(`/api/models/${encodeURIComponent(modelId)}/points`);
  return state.pointCache[modelId];
}

function populateSelectors(){
  const first=qs("#selA"), second=qs("#selB");
  const previous=[first.value,second.value], groups={};
  state.models.forEach(model=>(groups[model.dataset] ??= []).push(model));
  const options=Object.entries(groups).map(([dataset,models])=>`<optgroup label="${safe(dataset.toUpperCase())}">${models.map(model=>`<option value="${safe(model.id)}">${safe(displayName(model))}</option>`).join("")}</optgroup>`).join("");
  first.innerHTML=second.innerHTML=options;
  const ids=state.models.map(model=>model.id);
  first.value=ids.includes(previous[0])?previous[0]:(ids[0]??"");
  second.value=ids.includes(previous[1])?previous[1]:(ids[1]??ids[0]??"");
}

async function refreshWorkspace(){
  state.models=(await requestJson("/api/models")).models;
  state.pointCache=Object.create(null);
  renderRepository();
  populateSelectors();
  await compareModels();
}

// ------------------------------------------------ comparación
async function compareModels(){
  const idA=qs("#selA").value,idB=qs("#selB").value;
  const modelA=findModel(idA),modelB=findModel(idB);
  if(!modelA || !modelB){
    qs("#titleA").textContent=qs("#titleB").textContent="No hay modelos disponibles";
    qs("#metricas").innerHTML=qs("#cmA").innerHTML=qs("#cmB").innerHTML="";
    viewA.load(null);viewB.load(null);return;
  }
  try{
    const [dataA,dataB]=await Promise.all([pointsFor(idA),pointsFor(idB)]);
    viewA.load(dataA);viewB.load(dataB);
  }catch(error){notify(error.message,"danger");return;}
  qs("#titleA").textContent=displayName(modelA);qs("#titleB").textContent=displayName(modelB);
  updateLegend(modelA);drawMetrics(modelA,modelB);
  qs("#cmA").innerHTML=buildConfusion(modelA);qs("#cmB").innerHTML=buildConfusion(modelB);
  if(state.lastQuery) classify(state.lastQuery.lat,state.lastQuery.lon);
}

function updateLegend(model){
  const mode=qs('input[name="mode"]:checked').value;
  const entries=mode === "error" ? [[HIT,"Acierto"],[MISS,"Error"]] : model.etiquetas.map((label,index)=>{
    const range=model.rangos_irradiancia?.[String(index)];
    return [PALETTE[index%PALETTE.length],range?`${label} (${numberText(range[0],1)}–${numberText(range[1],1)})`:label];
  });
  qs("#legend").innerHTML=entries.map(([color,label])=>`<span><span class="sw" style="background:${color}"></span>${safe(label)}</span>`).join("");
}

const averageScore=model=>SCORE_FIELDS.reduce((sum,[key])=>sum+(model.metricas[key]??0),0)/SCORE_FIELDS.length;

function drawMetrics(modelA,modelB){
  const rows=SCORE_FIELDS.map(([key,label])=>[label,modelA.metricas[key],modelB.metricas[key],modelA.metricas_std?.[key],modelB.metricas_std?.[key]]);
  rows.push(["Promedio de métricas",averageScore(modelA),averageScore(modelB)]);
  const cell=(value,sd,accent,highlight)=>`<div class="${highlight?"win":""}">${numberText(value)}${sd!=null?`<span class="text-body-secondary fw-normal small"> ±${numberText(sd)}</span>`:""}</div><div class="metric-bar"><div style="width:${Math.max(0,Math.min(1,value))*100}%;background:${accent}"></div></div>`;
  qs("#metricas").innerHTML=`<table class="table align-middle mb-0"><thead><tr><th>Métrica</th><th><span class="badge tag-a">A</span></th><th><span class="badge tag-b">B</span></th><th class="text-end">Diferencia</th></tr></thead><tbody>${rows.map(([label,a,b,sa,sb])=>{const delta=b-a,eps=1e-9,klass=Math.abs(delta)<eps?"text-body-secondary":delta>0?"text-danger":"text-primary";return `<tr><td class="fw-semibold">${label}</td><td>${cell(a,sa,"#2563eb",a>b+eps)}</td><td>${cell(b,sb,"#c026d3",b>a+eps)}</td><td class="text-end ${klass}">${delta>0?"+":""}${numberText(delta)}</td></tr>`}).join("")}</tbody></table><div class="px-3 pb-3 small text-body-secondary">Las barras representan el valor de cada métrica. La diferencia corresponde a B − A.</div>`;
}

function buildConfusion(model){
  const matrix=model.matriz_confusion||[],labels=model.etiquetas;
  const body=matrix.map((row,i)=>{const total=row.reduce((sum,value)=>sum+value,0)||1;return `<tr><th>${safe(labels[i]??i)}</th>${row.map((value,j)=>{const proportion=value/total,correct=i===j,background=correct?`rgba(22,156,107,${.12+.75*proportion})`:`rgba(220,38,38,${.06+.7*proportion})`;return `<td style="background:${background}" title="${(proportion*100).toFixed(1)}% de la fila">${value}</td>`}).join("")}</tr>`}).join("");
  return `<table class="cm"><thead><tr><th></th>${labels.map(label=>`<th>${safe(label)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table><div class="text-center small text-body-secondary mt-2">Filas: clase real · Columnas: clase predicha</div>`;
}

// ------------------------------------------------------ consulta puntual
async function classify(lat,lon){
  const idA=qs("#selA").value,idB=qs("#selB").value;if(!idA||!idB)return;
  state.lastQuery={lat,lon};qs("#inLat").value=Math.round(lat*100)/100;qs("#inLon").value=Math.round(lon*100)/100;
  try{
    const send=id=>requestJson("/api/clasificar",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model_id:id,lat,lon})});
    const [resultA,resultB]=await Promise.all([send(idA),send(idB)]);
    viewA.mark(lat,lon,resultA.punto);viewB.mark(lat,lon,resultB.punto);renderClassification(resultA,resultB);
  }catch(error){notify(error.message,"danger");}
}

function resultCard(letter,result){
  const model=findModel(result.model_id),color=PALETTE[result.clase_pred%PALETTE.length];
  const range=result.rango_pred?`${numberText(result.rango_pred[0],1)} – ${numberText(result.rango_pred[1],1)}`:"—";
  return `<div class="res-card"><div class="d-flex justify-content-between align-items-center mb-1"><span><span class="badge ${letter==="A"?"tag-a":"tag-b"}">${letter}</span><span class="small text-body-secondary ms-1">${safe(model?.modelo||"")}</span></span><span class="pill cls" style="background:${color}">${safe(result.etiqueta_pred)}</span></div><div class="small">Rango: <b>${range}</b> · Valor vecino: <b>${numberText(result.valor,1)}</b> · Real: ${safe(result.etiqueta_real)} ${result.acierto?'<i class="bi bi-check-circle-fill text-success"></i>':'<i class="bi bi-x-circle-fill text-danger"></i>'}</div>${result.fuera_de_cobertura?'<div class="small text-warning-emphasis mt-1"><i class="bi bi-exclamation-triangle me-1"></i>La posición está alejada de los puntos disponibles; se utilizó el vecino más cercano.</div>':""}</div>`;
}

function renderClassification(a,b){
  const same=a.clase_pred===b.clase_pred;
  qs("#resultado").innerHTML=resultCard("A",a)+resultCard("B",b)+`<div class="alert ${same?"alert-success":"alert-warning"} py-2 mb-0 small"><i class="bi ${same?"bi-check2-all":"bi-shuffle"} me-1"></i>${same?`Los dos modelos entregan la clase <b>${safe(a.etiqueta_pred)}</b>.`:`Los modelos entregan resultados distintos: A = <b>${safe(a.etiqueta_pred)}</b>, B = <b>${safe(b.etiqueta_pred)}</b>.`}</div>`;
}

// -------------------------------------------------------- repositorio
function renderRepository(){
  const total=state.models.length;
  qs("#countModels").textContent=total;
  qs("#countModelsMirror").textContent=total;
  qs("#tbodyModels").innerHTML=total?state.models.map(model=>`<tr><td><span class="badge text-bg-secondary">${safe(model.dataset)}</span><div class="small text-body-secondary">#${safe(model.rank??"-")}</div></td><td><div class="fw-semibold">${safe(model.modelo)}</div><div class="small text-body-secondary">${safe(model.escalador)} + ${safe(model.reductor)} · ${safe(model.discretizador??"")}</div></td>${SCORE_FIELDS.map(([key])=>`<td class="text-end">${numberText(model.metricas[key])}</td>`).join("")}<td class="text-end text-nowrap">${model.tiene_joblib?`<a class="btn btn-sm btn-outline-secondary" title="Descargar pipeline" href="/api/models/${encodeURIComponent(model.id)}/joblib"><i class="bi bi-download"></i></a>`:""}<button class="btn btn-sm btn-outline-danger" data-remove="${safe(model.id)}" title="Eliminar"><i class="bi bi-trash3"></i></button></td></tr>`).join(""): '<tr><td colspan="7" class="text-center text-body-secondary py-5">No hay modelos almacenados.</td></tr>';
}

qs("#tbodyModels").addEventListener("click",async event=>{const button=event.target.closest("[data-remove]");if(!button||!confirm("¿Deseas eliminar este modelo?"))return;try{await requestJson(`/api/models/${encodeURIComponent(button.dataset.remove)}`,{method:"DELETE"});notify("Modelo eliminado");await refreshWorkspace()}catch(error){notify(error.message,"danger")}});

qs("#formUpload").addEventListener("submit",async event=>{event.preventDefault();const button=qs("#btnUpload");button.disabled=true;try{const form=new FormData(event.target);if(!form.get("joblib")?.name)form.delete("joblib");const result=await requestJson("/api/models",{method:"POST",body:form});notify(`Modelo guardado: ${result.id}`);event.target.reset();await refreshWorkspace()}catch(error){notify(error.message,"danger")}finally{button.disabled=false}});

// ------------------------------------------------------------- arranque
viewA=new SpatialView(qs("#mapA"),classify);viewB=new SpatialView(qs("#mapB"),classify);
qs("#selA").addEventListener("change",compareModels);qs("#selB").addEventListener("change",compareModels);
qs("#modeGroup").addEventListener("change",()=>{const mode=qs('input[name="mode"]:checked').value;viewA.changeMode(mode);viewB.changeMode(mode);const model=findModel(qs("#selA").value);if(model)updateLegend(model)});
qs("#formConsulta").addEventListener("submit",event=>{event.preventDefault();classify(parseFloat(qs("#inLat").value),parseFloat(qs("#inLon").value))});
refreshWorkspace().catch(error=>notify(error.message,"danger"));
