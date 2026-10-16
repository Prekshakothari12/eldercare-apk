const demoMedicines=[{id:"m1",name:"Amlodipine",dosage:"1 tablet after food",times:["08:00","14:00","20:00"],stock:12,expiry:"2027-04-01",daysLeft:30},{id:"m2",name:"Metformin",dosage:"1 tablet after food",times:["08:00","20:00"],stock:3,expiry:"2026-12-01",daysLeft:30}];
const schemeDescKeys=["scheme_ign","scheme_pmjay","scheme_atal","scheme_scss","scheme_pmvvy","scheme_rail"];
const schemeNameKeys={"Atal Pension Yojana":"scheme_name_atal","Senior Citizens Savings Scheme":"scheme_name_scss","Railway Concession":"scheme_name_rail"};
function schemeList(){return schemes.map((s,i)=>[schemeNameKeys[s[0]]?t(schemeNameKeys[s[0]]):s[0],t(schemeDescKeys[i]),s[2],s[3]])}
function schemeCategoryLabel(category){return t(({Pension:"pension",Health:"health",Finance:"finance",Legal:"legal",Travel:"travel"})[category]||"other")}
const schemes=[["IGNOAPS","Indira Gandhi National Old Age Pension Scheme","Pension","https://nsap.nic.in/"],["PM-JAY","Ayushman Bharat health cover","Health","https://pmjay.gov.in/"],["Atal Pension Yojana","Guaranteed pension savings scheme","Pension","https://www.pfrda.org.in/"],["Senior Citizens Savings Scheme","Government-backed savings account","Finance","https://www.indiapost.gov.in/"],["PMVVY","Pradhan Mantri Vaya Vandana Yojana","Pension","https://licindia.in/"],["Railway Concession","Travel assistance for senior citizens","Travel","https://www.irctc.co.in/"]];

const DEFAULT_HELPER_PROFILES=[
  {id:"h1",name:"Sunita Devi",skill:"Medicines & pharmacy",eta:"30–45 min",icon:"fa-pills",phone:"9000000011",ratingSum:0,ratingCount:0},
  {id:"h2",name:"Ravi Kumar",skill:"Groceries & errands",eta:"40–60 min",icon:"fa-cart-shopping",phone:"9000000012",ratingSum:0,ratingCount:0},
  {id:"h3",name:"Meena Sharma",skill:"Doctor visits & lab",eta:"On appointment",icon:"fa-user-nurse",phone:"9000000013",ratingSum:0,ratingCount:0},
  {id:"h4",name:"Imran Ali",skill:"Bills & documents",eta:"Same day",icon:"fa-file-invoice",phone:"9000000014",ratingSum:0,ratingCount:0}
];
function normalizeHelperProfile(h){
  if(!h||typeof h!=="object")return h;
  const out={...h};
  out.ratingSum=Number(out.ratingSum)||0;
  out.ratingCount=Number(out.ratingCount)||0;
  /* Never treat legacy demo rating strings as genuine ratings */
  if(out.ratingCount<=0){delete out.rating}
  return out;
}
function loadHelperProfiles(){
  try{
    const stored=JSON.parse(localStorage.getItem("helperProfiles")||"null");
    if(Array.isArray(stored)&&stored.length)return stored.map(normalizeHelperProfile);
  }catch(e){}
  return DEFAULT_HELPER_PROFILES.map(h=>({...h}));
}
function saveHelperProfiles(list){
  try{localStorage.setItem("helperProfiles",JSON.stringify(list||HELPER_PROFILES))}catch(e){}
}
let HELPER_PROFILES=loadHelperProfiles();
function getHelperById(id){return (HELPER_PROFILES||[]).find(h=>h.id===id)||null}
/** Genuine average only — never show fake/demo ratings. */
function helperAverageRating(h){
  if(!h||!(h.ratingCount>0))return null;
  return h.ratingSum/h.ratingCount;
}
function helperDisplayRating(h){
  if(!h)return "—";
  const avg=helperAverageRating(h);
  if(avg==null)return t("no_ratings_yet")||"No ratings yet";
  const n=h.ratingCount;
  const label=n===1?(t("review_one")||"1 review"):(t("reviews_n")||"{n} reviews").replace("{n}",String(n));
  return avg.toFixed(1)+" ("+label+")";
}
function helperRatingStarsHtml(h){
  const avg=helperAverageRating(h);
  if(avg==null)return `<span class="helper-rating muted">⭐ ${esc(t("no_ratings_yet")||"No ratings yet")}</span>`;
  const n=h.ratingCount;
  const label=n===1?(t("review_one")||"1 review"):(t("reviews_n")||"{n} reviews").replace("{n}",String(n));
  return `<span class="helper-rating">⭐ ${avg.toFixed(1)} (${esc(label)})</span>`;
}
function helperRegisteredBadgeHtml(){
  return `<span class="helper-registered-badge">✓ ${esc(t("eldercare_registered_helper")||"ElderCare Registered Helper")}</span>`;
}
let helperReviews=JSON.parse(localStorage.getItem("helperReviews")||"null")||[];
function saveHelperReviews(){try{localStorage.setItem("helperReviews",JSON.stringify(helperReviews||[]))}catch(e){}}
function getHelperReviews(helperId){
  /* Reviews live on the bookings (synced through Firestore), so every phone sees the same list */
  const fromBookings=(typeof helperBookings!=="undefined"&&helperBookings||[]).filter(b=>b&&b.helperId===helperId&&b.rating!=null&&b.rating!=="")
    .map(b=>({id:"rv_"+b.id,bookingId:b.id,helperId:b.helperId,stars:Number(b.rating),text:b.reviewText||"",author:b.ratedBy||b.bookedByName||"",at:b.ratedAt||b.updatedAt||0}));
  return fromBookings.sort((a,b)=>(b.at||0)-(a.at||0));
}
function ecRecomputeHelperRatings(){
  try{
    (HELPER_PROFILES||[]).forEach(h=>{
      const rs=getHelperReviews(h.id);
      h.ratingSum=rs.reduce((s,r)=>s+(Number(r.stars)||0),0);
      h.ratingCount=rs.length;
      delete h.rating;
    });
    saveHelperProfiles(HELPER_PROFILES);
  }catch(e){}
}
let medicines=JSON.parse(localStorage.getItem("medicines")||"null")||demoMedicines;
function saveMedicines(){localStorage.setItem("medicines",JSON.stringify(medicines))}
let circlePosts=JSON.parse(localStorage.getItem("circlePosts")||"null")||[];
let helperBookings=JSON.parse(localStorage.getItem("helperBookings")||"null")||[];
let records=[]; /* filled per linked senior from the cloud — see ecStartRecordsCloud() */
function saveData(){localStorage.setItem("circlePosts",JSON.stringify(circlePosts));localStorage.setItem("helperBookings",JSON.stringify(helperBookings));ecSaveRecordsCache()}
/* ---------- Health records (Firestore "healthRecords", one doc per record, linked by senior phone) ---------- */
function ecRecordsSenior(){try{return typeof seniorPhoneForMeds==="function"?seniorPhoneForMeds():""}catch(e){return""}}
function ecRecordsKey(){const s=ecRecordsSenior();return s?"records_senior_"+s:""}
function ecLoadRecordsCache(){const k=ecRecordsKey();if(!k)return[];try{return JSON.parse(localStorage.getItem(k)||"[]")||[]}catch(e){return[]}}
function ecSaveRecordsCache(){const k=ecRecordsKey();if(!k)return;try{localStorage.setItem(k,JSON.stringify(records||[]))}catch(e){}}
var recordsUnsub=null,recordsFor="";
/* Records waiting to reach the cloud (kept on the phone and retried until they upload) */
const EC_PENDING_REC="eldercarePendingRecords";
function ecPendingRecords(){try{return JSON.parse(localStorage.getItem(EC_PENDING_REC)||"[]")||[]}catch(e){return[]}}
function ecSetPendingRecords(list){try{localStorage.setItem(EC_PENDING_REC,JSON.stringify(list||[]))}catch(e){}}
function ecRemovePendingRecord(id){ecSetPendingRecords(ecPendingRecords().filter(r=>r.id!==id))}
/* Wait until this phone is signed in to Firebase (the sign-in after login runs in the background).
   Uploading before that finished is what made saves fail "sometimes". */
async function ecCloudReady(timeoutMs){
  if(typeof db==="undefined"||!db)return false;
  if(typeof auth==="undefined"||!auth)return true;
  if(auth.currentUser)return true;
  await new Promise(res=>{let done=false,un=null;const fin=()=>{if(done)return;done=true;try{un&&un()}catch(e){}res()};
    try{un=auth.onAuthStateChanged(u=>{if(u)fin()})}catch(e){fin()}
    setTimeout(fin,timeoutMs||10000)});
  if(auth.currentUser)return true;
  try{await auth.signInAnonymously()}catch(e){}
  return !!auth.currentUser;
}
window.ecCloudReady=ecCloudReady;
/* Firestore error codes in plain words (shown once so the real cause is visible) */
function ecCloudErrorText(code){
  if(code==="permission-denied")return "Firebase blocked the upload (permission-denied). Publish firestore.rules and enable Email/Password sign-in.";
  if(code==="invalid-argument"||code==="resource-exhausted")return "File too large to upload. Please use a smaller photo.";
  if(code==="unauthenticated")return "Not signed in to Firebase yet. It will retry automatically.";
  return "";
}
window.ecCloudErrorText=ecCloudErrorText;
let ecRecUploadBusy=false;
async function ecUploadPendingRecords(){
  const d=(typeof db!=="undefined"&&db)?db:null;
  if(!d||ecRecUploadBusy)return;
  const pending=ecPendingRecords();
  if(!pending.length)return;
  ecRecUploadBusy=true;
  try{
    await ecCloudReady(10000);
    for(const rec of pending){
      try{
        await Promise.race([d.collection("healthRecords").doc(String(rec.id)).set(rec),new Promise((_,rej)=>setTimeout(()=>rej({code:"timeout"}),20000))]);
        ecRemovePendingRecord(rec.id);
      }catch(e){
        console.warn("record upload",rec.id,e&&e.code);
        const code=(e&&e.code)||"error";
        if(window.__ecRecLastErr!==code){const msg=ecCloudErrorText(code);if(msg)toast(msg,true)}
        window.__ecRecLastErr=code;
      }
    }
  }finally{ecRecUploadBusy=false}
}
setInterval(()=>{if(session&&session.user)ecUploadPendingRecords()},15000);
function ecStopRecordsCloud(){if(recordsUnsub){try{recordsUnsub()}catch(e){}}recordsUnsub=null;recordsFor=""}
function ecStartRecordsCloud(){
  const d=(typeof db!=="undefined"&&db)?db:null;
  if(!d||!session||!session.user)return;
  const sen=ecRecordsSenior();
  if(recordsUnsub&&recordsFor===sen)return;
  ecStopRecordsCloud();
  records=ecLoadRecordsCache();
  if(!sen)return;
  recordsFor=sen;
  recordsUnsub=d.collection("healthRecords").where("seniorPhone","==",sen).onSnapshot(snap=>{
    if(recordsFor!==sen)return;
    const list=[];
    snap.forEach(doc=>{const r=doc.data();if(r&&r.id)list.push(r)});
    list.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    /* One-time move of records saved on this phone before cloud sync */
    if(!list.length&&!localStorage.getItem("eldercareRecordsMigrated")){
      localStorage.setItem("eldercareRecordsMigrated","1");
      let legacy=[];try{legacy=JSON.parse(localStorage.getItem("records")||"[]")||[]}catch(e){}
      legacy.forEach(r=>{if(r&&r.id)d.collection("healthRecords").doc(String(r.id)).set({...r,seniorPhone:sen},{merge:true}).catch(()=>{})});
      if(legacy.length)return;
    }
    /* Keep records from this phone that are still uploading, so they never disappear */
    const pend=ecPendingRecords().filter(r=>r.seniorPhone===sen&&!list.some(x=>x.id===r.id));
    /* (a record leaves the waiting list only when its upload is confirmed — see ecUploadPendingRecords) */
    if(pend.length){list.unshift(...pend);list.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))}
    const before=JSON.stringify(records||[]);
    records=list;
    ecSaveRecordsCache();
    if(before!==JSON.stringify(list)||!window.__ecRecordsPainted){
      window.__ecRecordsPainted=true;
      const route=location.hash.replace("#/","");
      if(route==="records"&&!document.querySelector(".modal-backdrop"))render();
    }
  },err=>{console.warn("records listen",err&&err.code);ecStopRecordsCloud();setTimeout(ecStartRecordsCloud,15000)});
}
window.ecRecordsCloudRestart=function(){ecStopRecordsCloud();ecStartRecordsCloud()};
setInterval(()=>{if(session&&session.user){if(!recordsUnsub||recordsFor!==ecRecordsSenior())ecStartRecordsCloud()}else if(recordsUnsub)ecStopRecordsCloud()},2500);
/* ---------- Shared bookings (Firestore) — same pattern as SOS ---------- */
function bookingsDb(){try{return(typeof db!=="undefined"&&db)?db:null}catch(e){return null}}
function bookingSig(b){return b?[b.id,b.status,b.updatedAt||b.createdAt,b.proofUrl||"",b.rating||"",b.itemProgress||""].join("|"):""}
function sanitizeBooking(booking){
  const clean=JSON.parse(JSON.stringify(booking||{}));
  delete clean._cloud;
  Object.keys(clean).forEach(k=>{if(clean[k]===undefined)delete clean[k]});
  if(clean.rating==null)delete clean.rating;
  return clean;
}
function cloudBookingSet(booking){
  const d=bookingsDb();
  if(!d||!booking||!booking.id)return Promise.resolve("local");
  const clean=sanitizeBooking(booking);
  clean.updatedAt=Date.now();
  return d.collection("bookings").doc(String(booking.id)).set(clean,{merge:true})
    .then(function(){return "cloud"})
    .catch(function(e){console.warn("cloud booking set",e);return "local"});
}
function cloudBookingUpdate(id,patch){
  const d=bookingsDb();
  if(!d||!id)return Promise.resolve("local");
  const data=sanitizeBooking({...patch,updatedAt:Date.now()});
  return d.collection("bookings").doc(String(id)).set(data,{merge:true})
    .then(function(){return "cloud"})
    .catch(function(e){console.warn("cloud booking update",e);return "local"});
}
var cloudBookingsUnsub=null,cloudBookingsFor="";
function filterBookingsForRole(all){
  if(!session||!session.user)return[];
  const role=session.role;
  const mePhone=String(session.user.phone||"").replace(/\D/g,"");
  const myHelperId=session.user.helperId||"";
  if(role==="caregiver"||role==="helper"){
    return all.filter(b=>(b.helperId&&myHelperId&&b.helperId===myHelperId)||(mePhone&&String(b.helperPhone||"").replace(/\D/g,"")===mePhone));
  }
  if(role==="senior"){
    return all.filter(b=>String(b.seniorPhone||"").replace(/\D/g,"")===mePhone);
  }
  const linkedPhones=new Set();
  (session.user.linkedSeniors||[]).forEach(s=>{if(s&&s.phone)linkedPhones.add(String(s.phone).replace(/\D/g,""))});
  if(session.user.linkedSeniorPhone)linkedPhones.add(String(session.user.linkedSeniorPhone).replace(/\D/g,""));
  return all.filter(b=>{
    const fam=String(b.familyPhone||b.bookedByPhone||"").replace(/\D/g,"");
    if(mePhone&&fam&&fam===mePhone)return true;
    const sen=String(b.seniorPhone||"").replace(/\D/g,"");
    if(sen&&linkedPhones.has(sen))return true;
    if(!fam&&!sen)return true;
    return false;
  });
}
function visibleBookings(){return filterBookingsForRole(helperBookings||[])}
/* Notify on booking changes that came from ANOTHER phone */
function ecBookingNotify(all){
  if(!session||!session.user||typeof ecNotify!=="function")return;
  const me=String(session.user.phone||"").replace(/\D/g,"");
  const role=session.role;
  const KEY="eldercareBookingSeen_"+role+"_"+me;
  let seen=null;try{seen=JSON.parse(localStorage.getItem(KEY)||"null")}catch(e){}
  const first=!seen;seen=seen||{};
  const hi=(typeof activeLanguage!=="undefined"&&activeLanguage==="hi");
  filterBookingsForRole(all).forEach(b=>{
    const st=b.status||"Requested",prev=seen[b.id];
    seen[b.id]=st;
    if(first||prev===st)return;
    const hp=getHelperById(b.helperId),helperName=(hp&&hp.name)||b.helperName||"Helper";
    if(role==="caregiver"||role==="helper"){
      if(!prev&&st==="Requested")ecNotify(hi?"नया काम बुक हुआ":"New task booked",(b.task||"")+" · "+(b.date||"")+" "+(b.time||"")+(b.bookedByName?" · "+b.bookedByName:""),{tag:"bk-"+b.id});
      else if(st==="Cancelled")ecNotify(hi?"बुकिंग रद्द":"Booking cancelled",(b.task||"")+" · "+(b.date||""),{tag:"bk-"+b.id});
    }else if(prev&&["Accepted","Declined","Completed"].includes(st)){
      const msg={Accepted:hi?helperName+" ने काम स्वीकार किया":helperName+" accepted the task",Declined:hi?helperName+" ने काम मना किया":helperName+" declined the task",Completed:hi?helperName+" ने काम पूरा किया (फ़ोटो प्रमाण के साथ)":helperName+" completed the task (proof photo added)"}[st];
      ecNotify(hi?"हेल्पर अपडेट":"Helper update",msg+" · "+(b.task||""),{tag:"bk-"+b.id});
    }
  });
  try{localStorage.setItem(KEY,JSON.stringify(seen))}catch(e){}
}
function applyBookingsFromCloud(list){
  const incoming=Array.isArray(list)?list:[];
  try{ecBookingNotify(incoming)}catch(e){console.warn("booking notify",e)}
  const byId={};
  (helperBookings||[]).forEach(b=>{if(b&&b.id)byId[b.id]=b});
  incoming.forEach(b=>{
    if(!b||!b.id)return;
    const local=byId[b.id];
    if(!local||Number(b.updatedAt||0)>=Number(local.updatedAt||0))byId[b.id]={...b,_cloud:true};
  });
  const merged=Object.values(byId).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const prev=(helperBookings||[]).map(bookingSig).join(";");
  const next=merged.map(bookingSig).join(";");
  if(prev===next)return;
  helperBookings=merged;
  try{localStorage.setItem("helperBookings",JSON.stringify(helperBookings))}catch(e){}
  ecRecomputeHelperRatings();
  if(typeof render==="function"){
    clearTimeout(window.__bookingsRenderTimer);
    window.__bookingsRenderTimer=setTimeout(()=>{try{render()}catch(e){}},400);
  }
}
function startCloudBookingsListener(){
  const d=bookingsDb();
  if(!d||!session||!session.user)return;
  const me=String(session.user.phone||"").replace(/\D/g,"");
  const key=session.role+"|"+me+"|"+(session.user.helperId||"");
  if(cloudBookingsUnsub&&cloudBookingsFor===key)return;
  if(cloudBookingsUnsub){try{cloudBookingsUnsub()}catch(e){}}
  cloudBookingsFor=key;
  cloudBookingsUnsub=d.collection("bookings").onSnapshot(snap=>{
    const all=[];
    snap.forEach(doc=>{const b=doc.data();if(b&&b.id)all.push({...b,_cloud:true})});
    all.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    applyBookingsFromCloud(all);
  },err=>{
    console.warn("cloud bookings listen",err);
    /* Offline / still signing in — retry so tasks appear as soon as access is allowed */
    stopCloudBookingsListener();
    setTimeout(()=>{try{startCloudBookingsListener()}catch(e){}},15000);
  });
}
function stopCloudBookingsListener(){
  if(cloudBookingsUnsub){try{cloudBookingsUnsub()}catch(e){}cloudBookingsUnsub=null;cloudBookingsFor=""}
}
function statusBadgeClass(status){
  const s=(status||"Requested").toLowerCase();
  if(s==="completed")return"success";
  if(s==="declined"||s==="cancelled")return"danger";
  if(s==="in progress"||s==="accepted")return"warning";
  return"blue";
}
function cancelBooking(id){
  const b=(helperBookings||[]).find(x=>x.id===id);
  if(!b)return;
  const st=b.status||"Requested";
  if(st!=="Requested"&&st!=="Accepted"){toast(t("cannot_cancel_status")||"Can only cancel Requested or Accepted bookings",true);return}
  if(!confirm(t("confirm_cancel_booking")||"Cancel this booking?"))return;
  const patch={status:"Cancelled",updatedAt:Date.now()};
  const i=helperBookings.findIndex(x=>x.id===id);
  if(i>=0){helperBookings[i]={...helperBookings[i],...patch};saveData()}
  cloudBookingUpdate(id,patch).then(()=>toast(t("booking_cancelled")||"Booking cancelled")).catch(()=>toast(t("error")||"Update failed",true));
  if(typeof render==="function")render();
}
function rateBooking(id,stars,reviewText){
  const b=(helperBookings||[]).find(x=>x.id===id);
  if(!b){toast(t("error")||"Booking not found",true);return}
  if((b.status||"")!=="Completed"){toast(t("rate_only_completed")||"You can only rate completed bookings",true);return}
  if(b.rating!=null&&b.rating!==""){toast(t("already_reviewed")||"You have already reviewed this booking.");return}
  const n=Math.round(Number(stars));
  if(!(n>=1&&n<=5)){toast(t("select_stars")||"Please select a rating from 1 to 5 stars",true);return}
  const text=String(reviewText||"").trim();
  const hp=getHelperById(b.helperId);
  if(!hp){toast(t("error")||"Helper not found",true);return}
  /* Update booking — one review per completed booking */
  b.rating=n;
  b.reviewText=text;
  b.ratedAt=Date.now();
  b.ratedBy=session.user?.name||"";
  b.updatedAt=Date.now();
  const bi=helperBookings.findIndex(x=>x.id===id);
  if(bi>=0)helperBookings[bi]=b;
  saveData();
  /* Genuine average: totalRatingScore / reviewCount — never replace with current user's stars */
  ecRecomputeHelperRatings();
  /* Store individual review for display */
  helperReviews.push({
    id:"r"+Date.now()+"_"+Math.random().toString(36).slice(2,6),
    bookingId:id,
    helperId:b.helperId,
    stars:n,
    text:text,
    author:session.user?.name||(t("user")||"User"),
    at:Date.now()
  });
  saveHelperReviews();
  try{
    if(typeof cloudBookingUpdate==="function")cloudBookingUpdate(id,{rating:n,reviewText:text,ratedAt:b.ratedAt,ratedBy:b.ratedBy});
  }catch(e){}
  toast(t("review_submitted")||"Thank you for your review");
  document.querySelector(".modal-backdrop")?.remove();
  if(typeof render==="function")render();
}
function askRatingForBooking(id){
  const b=(helperBookings||[]).find(x=>x.id===id);
  if(!b){toast(t("error")||"Booking not found",true);return}
  if((b.status||"")!=="Completed"){toast(t("rate_only_completed")||"You can only rate completed bookings",true);return}
  if(b.rating!=null&&b.rating!==""){toast(t("already_reviewed")||"You have already reviewed this booking.");return}
  const hp=getHelperById(b.helperId);
  const helperName=hp?hp.name:(b.helperName||t("helper")||"Helper");
  const starsHtml=[1,2,3,4,5].map(s=>`<button type="button" class="rate-star-btn" data-stars="${s}" aria-label="${s}" style="background:none;border:0;font-size:2rem;cursor:pointer;padding:4px;line-height:1;color:#cbd5e1">⭐</button>`).join("");
  modal(`<h2>${esc(t("rate_your_helper")||"Rate Your Helper")}</h2>
    <p class="muted">${esc(helperName)} · ${esc(b.task||"")}</p>
    <div class="rate-stars-row" id="rate-stars-row" style="display:flex;gap:4px;justify-content:center;margin:16px 0">${starsHtml}</div>
    <p class="muted" id="rate-stars-label" style="text-align:center;min-height:1.2em"></p>
    <div class="form-field"><label>${esc(t("write_review_optional")||"Write a review (optional)")}</label>
      <textarea id="rate-review-text" rows="3" placeholder="${esc(t("write_review")||"Write a review")}" style="width:100%;border-radius:12px;border:1px solid var(--border);padding:10px;font:inherit"></textarea>
    </div>
    <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">
      <button type="button" class="btn btn-primary" id="rate-submit-btn">${esc(t("submit_review")||"Submit Review")}</button>
      <button type="button" class="btn btn-secondary" onclick="document.querySelector('.modal-backdrop')?.remove()">${esc(t("cancel")||"Cancel")}</button>
    </div>`);
  let selected=0;
  const row=document.getElementById("rate-stars-row");
  const label=document.getElementById("rate-stars-label");
  const btns=row?row.querySelectorAll(".rate-star-btn"):[];
  function paint(n){
    selected=n;
    btns.forEach((btn,i)=>{btn.style.color=i<n?"#f59e0b":"#cbd5e1";btn.style.transform=i<n?"scale(1.15)":"scale(1)"});
    if(label)label.textContent=n?`${n} / 5` : "";
  }
  btns.forEach(btn=>{
    btn.onclick=()=>paint(Number(btn.getAttribute("data-stars"))||0);
  });
  const submit=document.getElementById("rate-submit-btn");
  if(submit)submit.onclick=()=>{
    if(!selected){toast(t("select_stars")||"Please select a rating from 1 to 5 stars",true);return}
    const text=(document.getElementById("rate-review-text")||{}).value||"";
    rateBooking(id,selected,text);
  };
}
function showHelperReviews(helperId){
  const hp=getHelperById(helperId);
  if(!hp)return;
  const revs=getHelperReviews(helperId);
  const ratingLine=helperRatingStarsHtml(hp);
  const list=revs.length?revs.map(r=>{
    const stars="⭐".repeat(Math.max(1,Math.min(5,Number(r.stars)||0)));
    return `<article class="card" style="padding:12px;margin:0">
      <div class="row between"><strong translate="no">${esc(r.author||"")}</strong><span>${stars}</span></div>
      ${r.text?`<p style="margin:6px 0 0" translate="no">${esc(r.text)}</p>`:""}
    </article>`;
  }).join(""):`<p class="muted">${esc(t("no_reviews_yet")||"No reviews yet")}</p>`;
  modal(`<h2>${esc(hp.name)}</h2>
    ${helperRegisteredBadgeHtml()}
    <p style="margin:8px 0">${ratingLine}</p>
    <h3 style="margin:12px 0 8px;font-size:1rem">${esc(t("reviews")||"Reviews")}</h3>
    <div class="stack" style="gap:8px;max-height:50vh;overflow:auto">${list}</div>
    <button type="button" class="btn btn-secondary" style="margin-top:12px;width:100%" onclick="document.querySelector('.modal-backdrop')?.remove()">${esc(t("close")||"Close")}</button>`);
}
const communityRooms=[
  {key:"hindi_news",icon:"fa-newspaper",q:"hindi news live"},
  {key:"kishore_songs",icon:"fa-music",q:"kishore kumar hit songs"},
  {key:"lata_songs",icon:"fa-music",q:"lata mangeshkar hit songs"},
  {key:"old_songs",icon:"fa-record-vinyl",q:"old hindi songs jukebox"},
  {key:"rafi_songs",icon:"fa-music",q:"mohammed rafi hit songs"},
  {key:"bhajans",icon:"fa-music",q:"morning bhajan playlist"},
  {key:"krishna_bhajan",icon:"fa-music",q:"krishna bhajan"},
  {key:"ganesh_aarti",icon:"fa-om",q:"ganesh aarti"},
  {key:"hanuman_chalisa",icon:"fa-hands-praying",q:"hanuman chalisa"},
  {key:"morning_yoga",icon:"fa-spa",q:"yoga for senior citizens"},
  {key:"pranayama",icon:"fa-wind",q:"pranayama for seniors"},
  {key:"hindi_motivation",icon:"fa-lightbulb",q:"hindi motivational speech"},
  {key:"sandeep_maheshwari",icon:"fa-microphone",q:"sandeep maheshwari hindi"},
  {key:"gaur_gopal",icon:"fa-microphone",q:"gaur gopal das"},
  {key:"healthy_walking",icon:"fa-person-walking",q:"walking exercise for elderly"},
  {key:"book_reading",icon:"fa-book-open",q:"hindi kahani for seniors"},
  {key:"news_seniors",icon:"fa-newspaper",q:"DD News Hindi"}
];
let dietDataCache=null;
async function loadDietData(){if(dietDataCache)return dietDataCache;try{const r=await fetch("data/dietData.json");dietDataCache=await r.json()}catch(e){dietDataCache={general:{eat:["Seasonal fruit","Vegetables","Whole grains","Water"],avoid:["Excess fried food","Sugary drinks","Tobacco and alcohol"]}}}return dietDataCache}
function seniorConditions(){
  const shared=localStorage.getItem("sharedHealthConditions")||localStorage.getItem("healthConditions")||"";
  const u=session.user||{};
  const raw=u.healthConditions||shared;
  if(Array.isArray(raw))return raw.map(s=>String(s).toLowerCase());
  return String(raw).split(/[,;|]/).map(s=>s.trim().toLowerCase()).filter(Boolean)
}function mapConditionKey(c){if(/diabet|sugar/.test(c))return"diabetes";if(/bp|blood.?pressure|hypertension/.test(c))return"high BP";if(/cholest/.test(c))return"cholesterol";if(/kidney/.test(c))return"kidney";if(/heart|cardio/.test(c))return"heart";if(/arthritis|joint/.test(c))return"arthritis";return"general"}
async function foodSuggestions(){const data=await loadDietData();const keys=seniorConditions().map(mapConditionKey);if(!keys.length)keys.push("general");const eat=[],avoid=[],seenE=new Set(),seenA=new Set();keys.forEach(k=>{const block=data[k]||data.general;(block.eat||[]).forEach(x=>{if(!seenE.has(x)){seenE.add(x);eat.push(x)}});(block.avoid||[]).forEach(x=>{if(!seenA.has(x)){seenA.add(x);avoid.push(x)}})});return{eat,avoid,keys}}
function ytSearchUrl(q){return "https://www.youtube.com/results?search_query="+encodeURIComponent(q)}

function seniorHeader(title){
  const greet=t(greetingKey())||t("good_morning")||"Hello,";
  const date=new Date().toLocaleDateString(localeTag(),{weekday:"short",day:"numeric",month:"short"});
  return `<header class="senior-header">
    <div class="greeting">
      <small>${greet}</small>
      <strong>${esc(session.user.name)}</strong>
      ${title&&title!==t("home")?`<span class="sub">${esc(title)}</span>`:`<span class="sub">${date}</span>`}
    </div>
    <div class="senior-actions">
      <button class="icon-btn" type="button" aria-label="${t("increase_text")}" onclick="cycleSeniorTextSize()">A+</button>
      <button type="button" class="logout-btn" aria-label="${t("logout")||"Logout"}" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i></button>
    </div>
  </header>`;
}
function seniorNav(title){return seniorHeader(title)}
function seniorShell(title,body){return `<div class="page">${seniorHeader(title)}<main class="container senior-content">${body}</main><nav class="bottom-nav senior-nav">${buildRoleNav("senior")}</nav></div>`}
function cycleSeniorTextSize(){
  const sizes=["18px","22px","26px"];
  const titles=["26px","30px","34px"];
  const root=document.documentElement;
  const current=sizes.indexOf(getComputedStyle(root).getPropertyValue("--fs-base").trim());
  const i=(current+1)%sizes.length;
  root.style.setProperty("--fs-base",sizes[i]);
  root.style.setProperty("--fs-title",titles[i]);
  root.style.setProperty("--fs-body",sizes[i]);
}
function todayDoses(){const nowMin=new Date().getHours()*60+new Date().getMinutes();return medicines.flatMap(m=>(m.times||[]).map(time=>{const [h,min]=time.split(":").map(Number);return{id:m.id,name:m.name,dosage:m.dosage,time,minutes:h*60+min}})).sort((a,b)=>a.minutes-b.minutes).map(d=>({...d,past:d.minutes<nowMin}))}
function doseBadge(d,isNext){return isNext?`<span class="badge warning">${t("dose_next")}</span>`:d.past?`<span class="badge grey">${t("dose_earlier")}</span>`:`<span class="badge blue">${t("dose_later")}</span>`}
function seniorTile(route,icon,tone,titleKey){return `<button type="button" class="home-tile feature-tile" aria-label="${t(titleKey)}" onclick="location.hash='#/${route}'"><span class="ic ${tone}"><i class="fa-solid ${icon}"></i></span><b>${t(titleKey)}</b></button>`}
function greetingKey(){const h=new Date().getHours();return h<12?"good_morning":h<17?"good_afternoon":"good_evening"}
/** Pick a call: open phone dialer with a real registered number (emergency contact preferred; else senior phone from signup). */
/** Family members the senior can call: emergency contacts + linked family users */
function seniorFamilyContacts(){
  const list=[];
  const seen=new Set();
  const mine=String(session.user?.phone||"").replace(/\D/g,"");
  const add=(name,phone)=>{
    const p=String(phone||"").replace(/\D/g,"");
    if(p.length<10||seen.has(p)||p===mine)return;
    seen.add(p);
    list.push({name:name||(typeof t==="function"?t("family"):"Family"),phone:p});
  };
  // Only users with role "family" linked to this senior — never helpers/caregivers
  try{
    const users=JSON.parse(localStorage.getItem("eldercareLocalUsers")||"{}");
    const myId=session.user?.uid||("local-"+mine);
    Object.values(users).forEach(u=>{
      if((u.role||"")!=="family")return;
      const ids=u.linkedSeniorIds||[];
      const phones=(u.linkedSeniors||[]).map(s=>String(s.phone||"").replace(/\D/g,""));
      if(ids.includes(myId)||ids.includes("local-"+mine)||phones.includes(mine)){
        add(u.name,u.phone);
      }
    });
  }catch(e){}
  // Emergency contacts that are not helpers
  (session.user?.emergencyContacts||[]).forEach(c=>{
    const rel=String(c.relationship||c.role||"").toLowerCase();
    if(rel.includes("helper")||rel.includes("caregiver")||rel.includes("सहायक"))return;
    add(c.name,c.phone);
  });
  return list;
}
function seniorCallPhone(){
  const c=seniorFamilyContacts()[0];
  return c?c.phone:"";
}
function seniorHome(){const next=(typeof nextDoseForHome==="function"?nextDoseForHome():null);
const latest=(visibleBookings()||[])[0];
const familyContacts=typeof seniorFamilyContacts==="function"?seniorFamilyContacts():[];
const medCard=next?`<section class="hero-card today-meds"><div class="hero-ic"><i class="fa-solid fa-pills"></i></div><div class="hero-body"><small>${t("next_medicine")||t("todays_medicines")||"Next medicine"}</small><h2>${esc(next.name)}</h2><p>${esc(next.dosage||"")} · ${formatTime(next.time)}</p></div></section>`:`<section class="hero-card today-meds"><div class="hero-ic"><i class="fa-solid fa-pills"></i></div><div class="hero-body"><small>${t("todays_medicines")}</small><h2>${t("no_medicines_list")}</h2></div></section>`;
const callCard=familyContacts.length
  ? familyContacts.map(c=>`<a href="tel:+91${c.phone}" class="senior-call-card" style="display:flex;align-items:center;gap:14px;margin:0 0 16px;padding:18px 20px;border-radius:20px;background:linear-gradient(135deg,#ECFEFF,#CCFBF1);box-shadow:0 2px 8px rgba(0,0,0,.08);text-decoration:none;color:#111827;-webkit-tap-highlight-color:transparent;">
      <span style="flex:0 0 56px;width:56px;height:56px;border-radius:16px;background:#0f766e;display:flex;align-items:center;justify-content:center;"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.2 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8z" fill="#fff"/></svg></span>
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;">
        <span style="font-size:13px;color:#4b5563;text-decoration:none;">${t("call_family")||"Call family"}</span>
        <span style="font-size:18px;font-weight:700;color:#111827;text-decoration:none;">${(t("call_name")||"Call {name}").replace("{name}",esc(c.name))}</span>
        <span style="font-size:14px;color:#4b5563;text-decoration:none;">${t("call_tap_hint")||"Tap to open your phone dialer"}</span>
      </span>
    </a>`).join("")
  :"";
return `${medCard}
${callCard}
<div class="grid-home feature-grid">
  ${seniorTile("schemes","fa-landmark","t1","sn_title")}
  ${seniorTile("community","fa-music","t3","audio_rooms")}
  ${seniorTile("medicines","fa-pills","t2","medicines")}
  ${seniorTile("records","fa-file-medical","t5","records")}
  ${seniorTile("food","fa-leaf","t4","food_plan")}
  ${seniorTile("helpers","fa-user-nurse","t6","helper_status")}
</div>
${latest?`<section class="card helper-status-card"><h2>${t("helper_status")}</h2><p><strong>${esc(latest.helperName||t("helper"))}</strong> · ${esc(latest.task||"")}</p><p class="muted">${esc(latest.date||"")} ${esc(latest.time||"")} · <span class="badge ${statusBadgeClass(latest.status)}">${esc(latest.status||t("requested"))}</span></p></section>`:""}`;}
function renderSenior(root){root.className="app-shell senior-mode";const route=location.hash.replace("#/","")||"home";let title,body;
if(route==="home"){title=t("home");body=seniorHome()}
else if(route==="medicines"){title=t("my_medicines");body=(typeof renderSeniorMedicinesPage==="function"?renderSeniorMedicinesPage():`<div class="empty card"><h2>${t("no_medicines_list")}</h2></div>`)}
else if(route==="food"){title=t("food_plan");body=`<div id="food-panel"><p class="muted">${t("loading")||"…"}</p></div>`;setTimeout(()=>fillFoodPanel(),0)}
else if(route==="community"){title=t("audio_rooms");body=`<p class="muted" style="margin:0 0 16px">${t("tap_to_watch")||""}</p><div class="grid">${communityRooms.map(r=>`<a class="card community-room" href="${ytSearchUrl(r.q)}" target="_blank" rel="noopener" style="display:block;text-align:left;width:100%;text-decoration:none;color:inherit"><div class="row" style="gap:12px;align-items:center"><span class="ic t3" style="width:48px;height:48px;border-radius:14px;display:grid;place-items:center"><i class="fa-solid ${r.icon}"></i></span><div><h2 style="margin:0">${t(r.key)}</h2><p class="muted" style="margin:4px 0 0">${t(r.key+"_desc")}</p><small style="color:var(--primary)">▶ YouTube</small></div></div></a>`).join("")}</div>`}
else if(route==="records"){title=t("records");body=`<div class="stack">${records.length?records.map(r=>`<article class="card" style="cursor:pointer" onclick="viewRecord('${r.id}')">
  <div class="row" style="gap:12px;align-items:center">
    ${r.imageBase64?`<img src="${r.imageBase64}" style="width:56px;height:56px;object-fit:cover;border-radius:10px" alt="">`:`<div class="avatar"><i class="fa-solid fa-file-medical"></i></div>`}
    <div style="flex:1"><strong>${esc(r.type)}</strong><br><span class="muted">${esc(r.doctor||"—")} · ${esc(r.date)}</span></div>
  </div></article>`).join(""):`<div class="empty card"><h2>${t("no_records")}</h2><p>${t("family_uploads_records")}</p></div>`}</div>`}
else if(route==="helpers"){title=t("helper_status");
const mine=visibleBookings();
body=mine.length?`<div class="stack">${mine.map(b=>{
  const hp=getHelperById(b.helperId);
  const st=b.status||t("requested");
  const canRate=st==="Completed"&&(b.rating==null||b.rating==="");
  const alreadyRated=st==="Completed"&&b.rating!=null&&b.rating!=="";
  return `<article class="card booking-card"><div class="row between"><strong>${esc(hp?hp.name:b.helperName||t("helper"))}</strong><span class="badge ${statusBadgeClass(b.status)}">${esc(st)}</span></div><p>${esc(b.task||"")}</p><p class="muted">${esc(b.date||"")} ${esc(b.time||"")}</p>${hp?`<div class="helper-meta" style="margin:4px 0">${helperRegisteredBadgeHtml()} ${helperRatingStarsHtml(hp)}</div>`:""}${b.proofUrl?`<p><a href="${esc(b.proofUrl)}" target="_blank" rel="noopener">${t("view_proof")||"View proof"}</a></p>`:""}${alreadyRated?`<p class="muted">⭐ ${Number(b.rating).toFixed(0)}/5${b.reviewText?` · ${esc(b.reviewText)}`:""}</p>`:""}<div class="row booking-actions" style="gap:8px;flex-wrap:wrap;margin-top:8px">${canRate?`<button type="button" class="btn btn-primary btn-sm" onclick="askRatingForBooking('${b.id}')">${t("rate_helper")||"Rate Helper"}</button>`:""}${hp&&(hp.ratingCount>0)?`<button type="button" class="btn btn-secondary btn-sm" onclick="showHelperReviews('${hp.id}')">${t("reviews")||"Reviews"}</button>`:""}</div></article>`;
}).join("")}</div>`:`<div class="empty card"><h2>${t("no_helper_booked")}</h2><p class="muted">${t("family_books_helper")}</p></div>`}
else if(route==="call"){location.hash="#/schemes";title=t("sn_title");body=`<p class="muted">${t("loading")||""}</p>`}
else{title=t("home");body=seniorHome()}
root.innerHTML=seniorShell(title,body);injectSOS();pollLocalSOSForFamily?.()}

function nextMedicine(){return formatTime(medicines.flatMap(m=>m.times).sort()[0]||"08:00")}
function takeMedicine(id){
  const m=medicines.find(x=>x.id===id);
  if(!m){toast(t("error")||"Not found",true);return}
  m.stock=Math.max(0,Number(m.stock||0)-1);
  saveMedicines();
  toast(t("medicine_taken")||("Taken: "+m.name));
  if(Number(m.stock)<5){
    const msg=(t("low_stock_alert")||"{name} is low — only {n} left. Please buy more.")
      .replace("{name}",m.name).replace("{n}",String(m.stock));
    toast(msg,true);
    showLowStockBanner(m);
    if("Notification"in window&&Notification.permission==="granted"){
      try{new Notification(t("app_name")||"ElderCare",{body:msg,tag:"low-"+m.id})}catch(e){}
    }
  }
  render();
}
function showLowStockBanner(m){
  let host=$("#sos-slot");
  if(!host){host=document.createElement("div");host.id="sos-slot";host.className="sos-slot-fixed";document.body.prepend(host)}
  if(host.querySelector(`[data-low="${m.id}"]`))return;
  const el=document.createElement("div");
  el.className="alert-banner low-stock-banner";
  el.dataset.low=m.id;
  el.innerHTML=`<strong>💊 ${(t("low_stock")||"Low stock")}: ${esc(m.name)}</strong>
    <p class="muted" style="margin:4px 0">Only ${Number(m.stock)} left — please purchase.</p>
    <button type="button" class="btn btn-secondary" style="margin-top:6px" onclick="this.closest('.alert-banner').remove()">OK</button>`;
  host.append(el);
}
function viewMedicine(id){
  const m=medicines.find(x=>x.id===id);
  if(!m)return;
  const times=(m.times||[]).map(formatTime).join(", ");
  modal(`<h2>${esc(m.name)}</h2>
    <div class="stack med-detail">
      <p><strong>${t("dosage")||"Dosage"}:</strong> ${esc(m.dosage)}</p>
      <p><strong>${t("times")||"Times"}:</strong> ${esc(times)}</p>
      <p><strong>${t("total_stock")||"Stock"}:</strong> ${Number(m.stock)}</p>
      <p><strong>${t("expiry")||"Expiry"}:</strong> ${esc(m.expiry||"—")}</p>
      ${Number(m.stock)<5?`<p class="badge warning">${t("low_stock")||"Low stock — buy more"}</p>`:""}
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="btn btn-primary" onclick="document.querySelector('.modal-backdrop')?.remove();takeMedicine('${m.id}')">${t("taken")||"Mark taken"}</button>
        <button class="btn btn-secondary" onclick="document.querySelector('.modal-backdrop')?.remove();editMedicineStock('${m.id}')">${t("update_stock")||"Update stock"}</button>
        <button class="btn btn-ghost" style="color:var(--danger)" onclick="document.querySelector('.modal-backdrop')?.remove();deleteMedicine('${m.id}')">${t("delete")||"Delete"}</button>
      </div>
    </div>`);
}
function editMedicineStock(id){
  const m=medicines.find(x=>x.id===id);
  if(!m)return;
  const modalEl=modal(`<h2>Update stock</h2>
    <p><strong>${esc(m.name)}</strong> — currently ${Number(m.stock)} left</p>
    <form id="stock-form" class="stack">
      <div class="form-field"><label>New quantity</label>
        <input name="stock" type="number" min="0" value="${Number(m.stock)}" required style="font-size:1.2rem"></div>
      <div class="row" style="gap:8px">
        <button type="button" class="btn btn-secondary" data-adj="-1">−1</button>
        <button type="button" class="btn btn-secondary" data-adj="1">+1</button>
        <button type="button" class="btn btn-secondary" data-adj="10">+10</button>
      </div>
      <button class="btn btn-primary" type="submit">Save stock</button>
    </form>`);
  modalEl.querySelectorAll("[data-adj]").forEach(btn=>{
    btn.onclick=()=>{
      const input=modalEl.querySelector('[name=stock]');
      input.value=Math.max(0,Number(input.value||0)+Number(btn.dataset.adj));
    };
  });
  modalEl.querySelector("#stock-form").onsubmit=e=>{
    e.preventDefault();
    m.stock=Math.max(0,Number(new FormData(e.target).get("stock"))||0);
    saveMedicines();
    modalEl.remove();
    toast("Stock updated: "+m.name+" ("+m.stock+" left)");
    if(m.stock<5)showLowStockBanner(m);
    render();
  };
}
function viewRecord(id){
  const r=records.find(x=>x.id===id);
  if(!r){toast("Record not found",true);return}
  const img=r.imageBase64?`<img src="${r.imageBase64}" alt="${esc(r.type)}" style="max-width:100%;border-radius:12px;margin:12px 0">`
    :(r.fileData?`<p><a class="btn btn-secondary" href="${r.fileData}" download="${esc(r.fileName||"record.pdf")}"><i class="fa-solid fa-file-pdf"></i> ${esc(r.fileName||"PDF")}</a></p>`:"");
  modal(`<h2>${esc(r.type||"Record")}</h2>
    <p><strong>${t("doctor")||"Doctor"}:</strong> ${esc(r.doctor||"—")}</p>
    <p><strong>${t("date")||"Date"}:</strong> ${esc(r.date||"—")}</p>
    ${img}
    <div class="row" style="gap:8px;margin-top:12px">
      <button class="btn btn-ghost" style="color:var(--danger)" onclick="document.querySelector('.modal-backdrop')?.remove();deleteRecord('${r.id}')">${t("delete")||"Delete"}</button>
      <button class="btn btn-secondary" onclick="document.querySelector('.modal-backdrop')?.remove()">${t("close")||"Close"}</button>
    </div>`);
}
function deleteRecord(id){
  if(!confirm(t("delete_record")||"Delete this record?"))return;
  records=records.filter(r=>r.id!==id);
  saveData();
  ecRemovePendingRecord(id);
  try{if(db)db.collection("healthRecords").doc(String(id)).delete().catch(()=>{})}catch(e){}
  toast(t("record_deleted")||"Deleted");
  render();
}

function renderCaregiver(root){root.className="app-shell caregiver-mode";const route=location.hash.replace("#/","")||"home";const nav=`<header class="topbar"><div class="logo"><span class="logo-mark">♥</span>${t("app_name")}</div><button class="btn btn-ghost" onclick="logout()">${t("logout")}</button></header>`;let body;if(route==="home")body=`<main class="container"><div id="sos-slot"></div><section class="card hero"><h1>${t("welcome",{name:esc(session.user.name)})}</h1><p>${t("managing_care")}</p><button class="btn btn-secondary" onclick="location.hash='#/settings'">${t("manage_linked")}</button></section><div class="stats section-title"><div class="card stat"><span>${t("medicines")}</span><strong>${medicines.length}</strong><span class="muted">${t("active_word")}</span></div><div class="card stat"><span>${t("check_ins")}</span><strong>2</strong><span class="muted">${t("today")}</span></div><div class="card stat"><span>${t("alerts")}</span><strong>0</strong><span class="muted">${t("active_word")}</span></div></div><h2 class="section-title">${t("todays_medicines")}</h2><div class="card">${medicines.map(m=>`<div class="list-row between"><span>${formatTime(m.times[0])} · ${esc(m.name)}</span><span class="badge success">${t("pending")}</span></div>`).join("")}</div></main>`;else if(route==="medicines")body=`<main class="container"><div class="row between"><h1>${t("medicines")}</h1><button class="btn btn-primary" onclick="addMedicine()">${t("add")}</button></div>
      <div class="stack">${medicines.map(m=>`<article class="card" style="cursor:pointer" onclick="viewMedicine('${m.id}')">
        <div class="row between"><h2>${esc(m.name)}</h2>
          <span class="badge ${Number(m.stock)<5?"warning":"success"}">${Number(m.stock)} left</span></div>
        <p>${esc(m.dosage)}</p>
        <p class="muted">${(m.times||[]).map(formatTime).join(" · ")} · Exp ${esc(m.expiry||"—")}</p>
        <div class="row" style="gap:8px;margin-top:8px" onclick="event.stopPropagation()">
          <button class="btn btn-primary" onclick="takeMedicine('${m.id}')">${t("taken")||"Taken"}</button>
          <button class="btn btn-secondary" onclick="editMedicineStock('${m.id}')">${t("update_stock")||"Stock"}</button>
          <button class="btn btn-ghost" style="color:var(--danger)" onclick="deleteMedicine('${m.id}')">${t("delete")||"Delete"}</button>
        </div>
      </article>`).join("")||`<div class="empty card"><h2>${t("no_medicines_list")||"No medicines"}</h2></div>`}</div></main>`;else if(route==="circle")body=`<main class="container"><div class="row between"><h1>${t("family_circle")}</h1><button class="btn btn-primary" onclick="composePost()">${t("add").replace("+ ","+ ")}${t("post")}</button></div>${circlePosts.length?circlePosts.map(p=>`<article class="card"><div class="row"><div class="avatar">${initials(p.author)}</div><strong translate="no">${esc(p.author)}</strong><span class="muted">${esc(p.date)}</span></div><p translate="no">${esc(p.text)}</p></article>`).join(""):`<div class="empty card"><div class="empty-icon">♡</div><h2>${t("no_posts")}</h2><p>${t("share_update")}</p></div>`}</main>`;else if(route==="helpers")body=`<main class="container"><h1>${t("book_helper")}</h1><div class="card"><form id="helper-form" class="card stack" onsubmit="submitHelper(event)">
        <div class="form-field"><label>${t("helper")||"Helper"}</label>
          <select name="helperId" required>
            ${HELPER_PROFILES.map(h=>`<option value="${h.id}">${esc(h.name)} — ${esc(h.skill)}</option>`).join("")}
          </select>
        </div>
        <div class="form-field"><label>${t("what_need")||"What do you need?"}</label>
          <div class="task-checks" id="task-checks">
            ${[["medicines",(t("buy_medicines")||"Buy medicines")+" (add quantity)"],["groceries",(t("get_groceries")||"Get groceries")+" (add quantity)"],["bills",t("pay_bills")||"Bills"],["doctor",t("doctor_visit")||"Doctor visit"],["lab",t("lab_test")||"Blood test"],["other",t("other")||"Other"]].map(([v,l])=>
              `<label class="check-chip"><input type="checkbox" name="tasks" value="${v}"> ${l}</label>`
            ).join("")}
          </div>
        </div>
        <div id="task-item-builders"></div>
        <div class="form-field"><label>${t("date")||"Date"}</label><input name="date" type="date" required></div>
        <div class="form-field"><label>${t("time")||"Time"}</label><input name="time" type="time"></div>
        <div class="form-field"><label>${t("address")||"Address"}</label><input name="address" placeholder="${t("senior_address")||"Senior's home address"}"></div>
        <div class="form-field"><label>${t("notes")||"Notes"}</label><input name="notes" placeholder="${t("optional_note")||"Optional note"}"></div>
        <button class="btn btn-primary" type="submit" style="width:100%;min-height:48px">${t("confirm_booking")||"Confirm booking"}</button>
      </form></div><h2 class="section-title">${t("my_bookings")}</h2><div class="stack">${helperBookings.length?helperBookings.map(b=>`<article class="card row between"><span><strong>${esc(b.task)}</strong><br>${esc(b.date)} ${esc(b.time)}</span><span class="badge blue">${esc(b.status==="Requested"?t("requested"):b.status)}</span></article>`).join(""):`<div class='empty card'>${t("no_bookings")}</div>`}</div></main>`;else if(route==="schemes")body=`<main class="container"><h1>${t("gov_schemes")}</h1><div class="scheme-grid">${schemeList().map(s=>`<article class="card"><span class="badge blue">${schemeCategoryLabel(s[2])}</span><h2>${s[0]}</h2><p>${s[1]}</p><a class="btn btn-secondary" href="${s[3]}" target="_blank" rel="noopener">${t("view_details")}</a></article>`).join("")}</div></main>`;else if(route==="records")body=`<main class="container"><div class="row between"><h1>${t("health_records")||"Health records"}</h1><button class="btn btn-primary" onclick="uploadRecord()">${t("upload_new")||"Upload"}</button></div>
          <div class="stack">${records.length?records.map(r=>`<article class="card record-card" style="cursor:pointer" onclick="viewRecord('${r.id}')">
            <div class="row" style="gap:12px;align-items:center">
              ${r.imageBase64?`<img src="${r.imageBase64}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:10px">`:`<div class="avatar"><i class="fa-solid fa-file-medical"></i></div>`}
              <div style="flex:1"><strong>${esc(r.type)}</strong><br><span class="muted">${esc(r.doctor||t("doctor_not_added")||"No doctor")} · ${esc(r.date)}</span></div>
              <button class="btn btn-ghost" style="color:var(--danger)" onclick="event.stopPropagation();deleteRecord('${r.id}')">${t("delete")||"Delete"}</button>
            </div>
          </article>`).join(""):`<div class="empty card"><div class="empty-icon">▧</div><h2>${t("no_records")||"No records"}</h2><p>${t("upload_prescription")||"Upload a prescription or report"}</p></div>`}</div></main>`;else body=`<main class="container"><h1>${t("settings")}</h1><div class="card stack"><p><strong>${esc(session.user.name)}</strong><br>${esc(session.user.phone)}</p><button class="btn btn-secondary" onclick="linkSenior()">${t("add_senior_phone")}</button><p>${t("linked_count",{n:session.user.linkedSeniors?.length||session.user.linkedSeniorIds?.length||0})}</p><button class="btn btn-secondary" onclick="location.hash='#/records'">${t("health_records")}</button><button class="btn btn-secondary" onclick="location.hash='#/schemes'">${t("gov_schemes")}</button><button class="btn btn-primary" onclick="logout()">${t("logout")}</button></div></main>`;root.innerHTML=nav+body+`<nav class="bottom-nav">${[["home","home"],["medicines","medicines"],["circle","circle"],["helpers","helpers"],["settings","settings"]].map(([r,key])=>`<button class="${route===r?"active":""}" onclick="location.hash='#/${r}'">${t(key)}</button>`).join("")}</nav>`;listenForCaregiverSOS();if((location.hash.replace("#/","")||"")==="helpers"&&typeof bindHelperTaskBuilders==="function")bindHelperTaskBuilders();if(route==="helpers"){const f=$("#helper-form");if(f)f.onsubmit=submitHelper;if(typeof bindHelperTaskBuilders==="function")bindHelperTaskBuilders();}}
function addMedicine(){
  const m=modal(`<h2>${t("add_medicine")||"Add medicine"}</h2>
    <form id="medicine-form" class="stack">
      <div class="form-field"><label>${t("name")||"Name"}</label><input name="name" required></div>
      <div class="form-field"><label>${t("dosage")||"Dosage"}</label><input name="dosage" value="${t("dosage_after_food")||"1 tablet after food"}" required></div>
      <div class="form-field"><label>${t("times_comma")||"Times (comma separated)"}</label><input name="times" placeholder="08:00,20:00" required></div>
      <div class="form-field"><label>${t("total_stock")||"Quantity / stock"}</label><input name="stock" type="number" min="1" value="10" required></div>
      <div class="form-field"><label>${t("expiry")||"Expiry"}</label><input name="expiry" type="date"></div>
      <button class="btn btn-primary" type="submit">${t("save")||"Save"}</button>
    </form>`);
  $("#medicine-form").onsubmit=e=>{
    e.preventDefault();
    const d=Object.fromEntries(new FormData(e.target));
    medicines.push({
      id:"m"+Date.now(),
      name:d.name,
      dosage:d.dosage,
      times:String(d.times).split(",").map(x=>x.trim()).filter(Boolean),
      stock:Number(d.stock)||0,
      expiry:d.expiry||""
    });
    saveMedicines();
    m.remove();
    toast(t("medicine_saved")||"Saved");
    render();
  };
}
function deleteMedicine(id){if(!confirm(t("delete_medicine")||"Delete this medicine?"))return;medicines=medicines.filter(m=>m.id!==id);saveMedicines();toast(t("medicine_deleted")||"Deleted");render()}
function composePost(){const m=modal(`<h2>${t("new_post")}</h2><textarea id="post-text" style="width:100%;min-height:120px"></textarea><button class="btn btn-primary" style="margin-top:12px" id="post-submit">${t("post")}</button>`);$("#post-submit").onclick=()=>{const text=$("#post-text").value.trim();if(!text)return toast(t("write_update"),true);circlePosts.unshift({author:session.user.name,text,date:formatDateTime(new Date())});saveData();m.remove();render()}}
let bookingSubmitBusy=false;
async function submitHelper(e){
  e.preventDefault();
  if(bookingSubmitBusy)return;
  const form=e.target;
  const submitBtn=form.querySelector('[type="submit"]');
  const fd=new FormData(form);
  const helperId=fd.get("helperId");
  const hp=getHelperById(helperId);
  if(!helperId||!hp){toast(t("select_helper")||"Please select a helper",true);return}
  const dateVal=String(fd.get("date")||"").trim();
  const timeVal=String(fd.get("time")||"").trim();
  const addressVal=String(fd.get("address")||"").trim();
  if(!dateVal){toast(t("date_required")||"Date is required",true);return}
  const today=new Date();today.setHours(0,0,0,0);
  const chosen=new Date(dateVal+"T00:00:00");
  if(isNaN(chosen.getTime())||chosen<today){toast(t("date_not_past")||"Date cannot be in the past",true);return}
  if(!timeVal){toast(t("time_required")||"Time is required",true);return}
  if(!addressVal){toast(t("address_required")||"Address is required",true);return}
  const tasks=fd.getAll("tasks");
  const categories=[];
  for(const cat of tasks){
    const items=[];
    fd.getAll("item_"+cat).forEach(it=>{if(String(it).trim())items.push(String(it).trim())});
    /* Medicines & groceries: items are compulsory — do not auto-fill category name */
    if((cat==="medicines"||cat==="groceries")&&!items.length){
      const msg=cat==="medicines"
        ?(t("medicines_items_required")||"Please add at least one medicine (with quantity) before booking.")
        :(t("groceries_items_required")||"Please add at least one grocery item (with quantity) before booking.");
      toast(msg,true);
      return;
    }
    if(!items.length) items.push(String(cat));
    categories.push({category:cat,items:items,done:[]});
  }
  if(!categories.length){
    const singleTask=String(fd.get("task")||"").trim();
    if(singleTask){
      const noteItems=String(fd.get("notes")||"").trim();
      categories.push({category:singleTask,items:noteItems?[noteItems]:[singleTask],done:[]});
    }
  }
  if(!categories.length){
    toast(t("task_item_required")||"Select at least one task and add at least one item",true);
    return;
  }
  const seniorPhone=(session.user?.linkedSeniors||[])[0]?.phone||session.user?.linkedSeniorPhone||"";
  let seniorName="";
  try{
    const users=JSON.parse(localStorage.getItem("eldercareLocalUsers")||"{}");
    const sid=session.user?.linkedSeniorIds?.[0];
    if(sid&&users){const u=Object.values(users).find(x=>x.uid===sid||("local-"+x.phone)===sid);if(u)seniorName=u.name||""}
    if(!seniorName&&seniorPhone){const u=Object.values(users).find(x=>String(x.phone||"").replace(/\D/g,"")===String(seniorPhone).replace(/\D/g,""));if(u)seniorName=u.name||""}
  }catch(err){}
  const taskLabel=categories.map(c=>c.category).join(", ");
  const booking={
    id:"h"+Date.now()+"_"+Math.random().toString(36).slice(2,8),
    helperId:helperId,
    helperName:hp.name||"Helper",
    helperPhone:String(hp.phone||"").replace(/\D/g,""),
    task:taskLabel,
    categories:categories,
    notes:String(fd.get("notes")||""),
    date:dateVal,
    time:timeVal,
    address:addressVal,
    status:"Requested",
    createdAt:Date.now(),
    updatedAt:Date.now(),
    bookedByName:session.user?.name||"",
    bookedByPhone:String(session.user?.phone||"").replace(/\D/g,""),
    familyName:session.user?.name||"",
    familyPhone:String(session.user?.phone||"").replace(/\D/g,""),
    seniorName:seniorName,
    seniorPhone:String(seniorPhone||"").replace(/\D/g,""),
    proofUrl:"",
    rating:null,
    itemProgress:""
  };
  bookingSubmitBusy=true;
  if(submitBtn){submitBtn.disabled=true;submitBtn.textContent=t("saving")||"Saving…"}
  helperBookings.unshift(booking);
  saveData();
  try{
    const where=await cloudBookingSet(booking);
    if(where==="cloud") toast((t("booked")||"Booked")+" "+(hp.name||"helper"));
    else toast((t("booked")||"Booked")+" "+(hp.name||"helper")+" · "+(t("saved_offline")||"Saved on this phone"));
    form.reset();
    const builders=document.getElementById("task-item-builders");
    if(builders)builders.innerHTML="";
    const hid=document.getElementById("helper-id-input");
    if(hid)hid.value=helperId;
  }catch(err){
    toast((t("booked")||"Booked")+" "+(hp.name||"helper"));
  }
  bookingSubmitBusy=false;
  if(submitBtn){submitBtn.disabled=false;submitBtn.textContent=t("confirm_booking")||"Confirm booking"}
  render();
}
function bindHelperTaskBuilders(){
  const checks=document.getElementById("task-checks");
  const host=document.getElementById("task-item-builders");
  if(!checks||!host) return;
  function rebuild(){
    host.innerHTML="";
    checks.querySelectorAll("input[name=tasks]:checked").forEach(cb=>{
      const cat=cb.value;
      const label=cb.parentElement?cb.parentElement.textContent.trim():cat;
      const medOptions=(typeof medicines!=="undefined"?medicines:[]).map(m=>`<option value="${esc(m.name)}">${esc(m.name)}</option>`).join("");
      const needsQtyHint = cat==="medicines" || cat==="groceries";
      const itemPh = cat==="medicines"
        ? (t("add_medicine_qty_hint")||"e.g. Dolo 650, 50 strips")
        : cat==="groceries"
          ? (t("add_grocery_qty_hint")||"e.g. Rice, 1 kg")
          : (t("add_item")||"Add item");
      const box=document.createElement("div");
      box.className="card item-builder";
      box.innerHTML=`<strong>${esc(label)}</strong>
        <div class="item-add-row">
          <input type="text" class="item-input" placeholder="${esc(itemPh)}" list="med-list-${cat}">
          ${cat==="medicines"?`<datalist id="med-list-${cat}">${medOptions}</datalist>`:""}
          <button type="button" class="btn btn-secondary item-add-btn">${t("add")||"Add"}</button>
        </div>
        <ul class="item-list" data-cat="${cat}"></ul>`;
      const input=box.querySelector(".item-input");
      const list=box.querySelector(".item-list");
      box.querySelector(".item-add-btn").onclick=function(){
        const v=(input.value||"").trim();
        if(!v) return;
        const li=document.createElement("li");
        li.innerHTML=`<span>${esc(v)}</span><input type="hidden" name="item_${cat}" value="${esc(v)}">
          <button type="button" class="item-remove" aria-label="Remove">&times;</button>`;
        li.querySelector(".item-remove").onclick=function(){ li.remove(); };
        list.append(li);
        input.value="";
        input.focus();
      };
      host.append(box);
    });
  }
  checks.addEventListener("change", rebuild);
}
async function linkSenior(){const phone=prompt(t("enter_senior_phone"));if(!phone)return;try{await linkSeniorByPhone(phone);toast(t("senior_linked"));if(typeof caregiverLoadSenior==="function")await caregiverLoadSenior();render()}catch(error){toast(error.message,true)}}
function uploadRecord(){
  const types=[
    ["Prescription",t("prescription")||"Prescription"],
    ["Lab report",t("lab_report")||"Lab report"],
    ["Blood test",t("blood_test")||"Blood test"],
    ["X-ray / Scan",t("xray_scan")||"X-ray / Scan"],
    ["Discharge summary",t("discharge_summary")||"Discharge summary"],
    ["Doctor's note",t("doctors_note")||"Doctor's note"],
    ["Vaccination",t("vaccination")||"Vaccination"],
    ["Insurance",t("insurance")||"Insurance"],
    ["Bill / Invoice",t("bill_invoice")||"Bill / Invoice"],
    ["Other",t("other")||"Other"]
  ];
  const m=modal(`<h2>${t("upload_health_record")||"Upload record"}</h2>
    <form id="record-form" class="stack">
      <div class="form-field"><label>${t("type")||"Type"}</label>
        <select name="type">${types.map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select></div>
      <div class="form-field"><label>${t("doctor")||"Doctor"}</label><input name="doctor" placeholder="Dr. name"></div>
      <div class="form-field"><label>${t("date")||"Date"}</label><input name="date" type="date" required></div>
      <div class="form-field"><label>${t("file")||"File"}</label>
        <label class="file-pick-btn btn btn-secondary" style="display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer">
          <i class="fa-solid fa-camera"></i> ${t("take_photo_or_file")||"Take photo / Choose file"}
          <input name="photo" type="file" accept="image/*,application/pdf" capture="environment" style="display:none" id="record-file-input">
        </label>
        <div id="record-file-preview" class="muted" style="margin-top:8px"></div>
      </div>
      <button class="btn btn-primary" type="submit" style="width:100%;min-height:48px">${t("save")||"Save"}</button>
    </form>`);
  const fileInput=m.querySelector("#record-file-input");
  if(fileInput) fileInput.onchange=()=>{
    const f=fileInput.files?.[0];
    const prev=m.querySelector("#record-file-preview");
    if(!f||!prev) return;
    if(f.type.startsWith("image/")){
      const url=URL.createObjectURL(f);
      prev.innerHTML=`<img src="${url}" alt="" style="max-width:100%;max-height:120px;border-radius:12px">`;
    } else prev.textContent=f.name;
  };
  $("#record-form").onsubmit=async e=>{
    e.preventDefault();
    if(m.__saving)return;                         // block a second tap while saving (was creating the record twice)
    m.__saving=true;
    const saveBtn=e.target.querySelector('[type="submit"]');
    if(saveBtn){saveBtn.disabled=true;saveBtn.style.opacity=".6"}
    const unlock=()=>{m.__saving=false;if(saveBtn){saveBtn.disabled=false;saveBtn.style.opacity=""}};
    const fd=new FormData(e.target);
    const file=fd.get("photo");
    if(!file||!file.size){unlock();toast(t("photo_required")&&t("photo_required")!=="Photo Required"?t("photo_required"):"Please add a photo or file of the record.",true);return}
    const sen=ecRecordsSenior();
    if(!sen){unlock();toast(t("link_senior_first")||"Link a senior first",true);return}
    let imageBase64="",fileData="",fileName="";
    if(file&&file.size){
      if(file.type==="application/pdf"){
        if(file.size>500*1024){unlock();toast("PDF too large (max 500 KB). Please upload a photo instead.",true);return}
        try{fileData=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)});fileName=file.name}catch(err){unlock();toast("File failed",true);return}
      }else{
        try{imageBase64=await ecCompressRecordImage(file)}catch(err){unlock();toast("Image failed",true);return}
      }
    }
    const rec={id:"r"+Date.now(),type:fd.get("type"),doctor:fd.get("doctor")||"",date:fd.get("date"),imageBase64,fileData,fileName,createdAt:Date.now(),
      seniorPhone:sen,uploadedByPhone:String(session.user.phone||"").replace(/\D/g,""),uploadedByName:session.user.name||""};
    if(!records.some(r=>r.id===rec.id))records.unshift(rec);
    saveData();
    ecSetPendingRecords(ecPendingRecords().concat([rec]));   // uploaded now, retried automatically if it fails
    m.remove();
    toast(t("record_saved")||"Record saved");
    render();
    ecUploadPendingRecords();
  };
}
/* Record photos: keep each record well under Firestore's 1 MB limit (tall or large photos were failing) */
function ecCompressRecordImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const img=new Image();img.onload=()=>{
  let max=1200,q=.7,out="";
  for(let i=0;i<8;i++){
    const scale=Math.min(1,max/Math.max(img.width,img.height));
    const c=document.createElement("canvas");c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);
    const g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,c.width,c.height);g.drawImage(img,0,0,c.width,c.height);
    out=c.toDataURL("image/jpeg",q);
    if(out.length<600000)break;
    if(q>.45)q-=.1;else max=Math.round(max*.8);
  }
  resolve(out)};img.onerror=reject;img.src=reader.result};reader.readAsDataURL(file)})}
async function ecViewProof(id){
  const b=(helperBookings||[]).find(x=>x.id===id);
  if(!b||!b.proofUrl){toast("No proof yet",true);return}
  const src=(typeof resolveProofUrl==="function")?await resolveProofUrl(b.proofUrl):b.proofUrl;
  if(!src){toast("Could not load proof",true);return}
  modal(`<h2>${t("view_proof")||"Proof"}</h2><img src="${esc(src)}" alt="proof" style="max-width:100%;border-radius:12px;margin:12px 0"><button class="btn btn-secondary" style="width:100%" onclick="document.querySelector('.modal-backdrop')?.remove()">${t("close")||"Close"}</button>`);
}
function compressImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const img=new Image();img.onload=()=>{const scale=Math.min(1,800/img.width),canvas=document.createElement("canvas");canvas.width=img.width*scale;canvas.height=img.height*scale;canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL("image/jpeg",.6))};img.onerror=reject;img.src=reader.result};reader.readAsDataURL(file)})}
function familyLinkedSeniorsBlock(){
  const list=(session.user?.linkedSeniors||[]).filter(s=>s&&typeof s==="object"&&(s.name||s.phone));
  if(!list.length)return "";
  return `<h2>${t("linked_seniors")||"Linked seniors"}</h2><div class="stack" style="margin-bottom:14px">${list.map(s=>`<div class="row" style="gap:12px;align-items:center"><div class="avatar">${esc(initials(s.name||"S"))}</div><div><strong>${esc(s.name||t("linked_senior")||"Senior")}</strong><br><span class="muted">+91 ${esc(s.phone||"")}</span></div></div>`).join("")}</div>`;
}
function familyLinkCard(){return `<section class="card section">${familyLinkedSeniorsBlock()}<h2>${t("add_senior_phone")}</h2><p class="muted">${t("link_senior_hint")}</p><form id="family-link-form" class="stack"><div class="form-field"><label>${t("senior_phone_number")}</label><input name="phone" data-phone-input inputmode="numeric" maxlength="10" required></div><button class="btn btn-primary">${t("link")}</button></form></section>`}
function renderFamily(root){
  root.className="app-shell caregiver-mode mobile-app";
  const route=location.hash.replace("#/","")||"family";
  const lowMeds=(typeof stockAlerts==="function"?stockAlerts():medicines.filter(m=>Number(m.stock)<5));
  const taskLabels={
    medicines:"Buy medicines",
    groceries:"Get groceries",
    bills:"Pay bills",
    doctor:"Doctor appointment",
    lab:"Blood test / lab",
    pharmacy:"Pharmacy run",
    accompany:"Accompany senior",
    other:"Other task"
  };
  let main="";
  if(route==="records"){
    main=`<div class="records-title-row">
        <h1 class="page-title">${t("health_records")||"Health Records"}</h1>
        <button type="button" class="btn btn-primary upload-pill" onclick="uploadRecord()"><i class="fa-solid fa-upload"></i> ${t("upload_new")||"Upload New"}</button>
      </div>
      <div class="stack">${(records||[]).length?records.map(r=>`<article class="card" style="cursor:pointer" onclick="viewRecord('${r.id}')">
        <div class="row" style="gap:12px;align-items:center">
          ${r.imageBase64?`<img src="${r.imageBase64}" style="width:56px;height:56px;object-fit:cover;border-radius:10px" alt="">`:`<div class="avatar"><i class="fa-solid fa-file-medical"></i></div>`}
          <div style="flex:1"><strong>${esc(r.type)}</strong><br><span class="muted">${esc(r.doctor||"—")} · ${esc(r.date)}</span></div>
        </div>
      </article>`).join(""):`<div class="empty card empty-records"><div class="empty-icon"><i class="fa-solid fa-folder-open"></i></div><h2>${t("no_records")||"No records yet"}</h2></div>`}</div>`;
  } else if(route==="settings"){
    main=`<h1>${t("settings")||"Settings"}</h1>
      <section class="card"><h2>${t("profile")||"Profile"}</h2><p>${esc(session.user.name)}<br>+91 ${esc(session.user.phone)}</p></section>
      ${familyLinkCard()}
      <section class="card section">
        <p class="muted">Return to login to switch account.</p>
        <button class="btn btn-primary" style="width:100%" onclick="logout()">Logout / Switch account</button>
      </section>`;
  } else if(route==="medicines"){
    main=(typeof renderFamilyMedicinesPage==="function"?renderFamilyMedicinesPage():`<h1>${t("medicines")}</h1>`);
  } else if(route==="food"){
    main=`<h1 style="margin:-8px 0 2px">${t("food_today")||"Healthy Recipes"}</h1>${session.role==="family"?`<p class="muted" style="font-size:0.85rem;margin:0 0 10px">${foodLang()==="hi"?"फ़िल्टर और एलर्जी से रेसिपी चुनें।":"Filter recipes by diet, meal, time and allergies."}</p>`:""}<div id="food-panel"><p class="muted">Loading…</p></div>`;
    setTimeout(()=>fillFoodPanel(),0);
  } else if(route==="helpers"){
    const mine=visibleBookings();
    main=`<h1>${t("book_helper")||"Book a helper"}</h1>
      <p class="muted">${t("choose_trusted_helper")||"Choose a trusted helper — like ordering from a delivery app."}</p>
      <form id="helper-form" class="stack">
        <input type="hidden" name="helperId" id="helper-id-input" required>
        <div class="stack helper-pick">${HELPER_PROFILES.map(h=>`
          <button type="button" class="card helper-card helper-pick-card" data-helper-id="${h.id}">
            <div class="row helper-pick-row">
              <div class="helper-avatar"><i class="fa-solid ${h.icon}"></i></div>
              <div class="helper-pick-info">
                <strong>${esc(h.name)}</strong>
                <p class="muted">${esc(h.skill)}</p>
                <div class="helper-meta">${helperRegisteredBadgeHtml()} ${helperRatingStarsHtml(h)}</div>
              </div>
              <span class="helper-tick"><i class="fa-solid fa-circle-check"></i></span>
            </div>
          </button>`).join("")}</div>
        <section class="card stack helper-book-form">
          <div class="form-field"><label>${t("what_need")||"What do you need?"}</label>
            <div class="task-checks" id="task-checks">
              ${[["medicines",(t("buy_medicines")||"Buy medicines")+" (add quantity)"],["groceries",(t("get_groceries")||"Get groceries")+" (add quantity)"],["bills",t("pay_bills")||"Bills"],["doctor",t("doctor_visit")||"Doctor visit"],["lab",t("lab_test")||"Blood test"],["other",t("other")||"Other"]].map(([v,l])=>
                `<label class="check-chip"><input type="checkbox" name="tasks" value="${v}"> ${l}</label>`
              ).join("")}
            </div>
          </div>
          <div id="task-item-builders"></div>
          <div class="form-field"><label>${t("date")||"Date"}</label><input name="date" type="date" required min="${new Date().toISOString().slice(0,10)}"></div>
          <div class="form-field"><label>${t("time")||"Time"}</label><input name="time" type="time" required></div>
          <div class="form-field"><label>${t("address")||"Address"}</label><input name="address" required placeholder="${t("senior_address")||"Senior's home address"}"></div>
          <div class="form-field"><label>${t("notes")||"Notes"}</label><input name="notes" placeholder="${t("optional_note")||"Optional note"}"></div>
          <button class="btn btn-primary" type="submit">${t("confirm_booking")||"Confirm booking"}</button>
        </section>
      </form>
      <h2 class="section-title">${t("your_bookings")||"Your bookings"}</h2>
      <div class="stack">${mine.length?mine.map(b=>{
        const hp=getHelperById(b.helperId);
        const st=b.status||"Requested";
        const canCancel=st==="Requested"||st==="Accepted";
        const canRate=st==="Completed"&&(b.rating==null||b.rating==="");
        const alreadyRated=st==="Completed"&&b.rating!=null&&b.rating!=="";
        return `<article class="card booking-card">
          <div class="row between"><strong>${esc(hp?hp.name:b.helperName||"Helper")}</strong>
            <span class="badge ${statusBadgeClass(st)}">${esc(st)}</span></div>
          <p class="muted">${esc(b.task)} · ${esc(b.date||"")} ${esc(b.time||"")}</p>
          ${hp?`<div class="helper-meta" style="margin:4px 0">${helperRegisteredBadgeHtml()} ${helperRatingStarsHtml(hp)}</div>`:""}
          ${b.notes?`<p>${esc(b.notes)}</p>`:""}
          ${b.address?`<p class="muted"><i class="fa-solid fa-location-dot"></i> ${esc(b.address)}</p>`:""}
          ${b.proofUrl?`<p class="muted"><button type="button" class="btn btn-secondary btn-sm" onclick="ecViewProof('${b.id}')"><i class="fa-solid fa-image"></i> ${t("view_proof")||"View proof"}</button></p>`:""}
          ${alreadyRated?`<p class="muted">⭐ ${Number(b.rating).toFixed(0)}/5${b.reviewText?` · ${esc(b.reviewText)}`:""}</p>`:""}
          <div class="row booking-actions" style="gap:8px;flex-wrap:wrap;margin-top:8px">
          ${canCancel?`<button type="button" class="btn btn-ghost btn-sm booking-cancel" onclick="cancelBooking('${b.id}')">${t("cancel")||"Cancel"}</button>`:""}
          ${canRate?`<button type="button" class="btn btn-primary btn-sm" onclick="askRatingForBooking('${b.id}')">${t("rate_helper")||"Rate Helper"}</button>`:""}
          ${hp&&(hp.ratingCount>0)?`<button type="button" class="btn btn-secondary btn-sm" onclick="showHelperReviews('${hp.id}')">${t("reviews")||"Reviews"}</button>`:""}
          </div>
        </article>`;
      }).join(""):`<div class="empty card"><div class="empty-icon"><i class="fa-solid fa-clipboard-list"></i></div><h2>${t("no_bookings_short")||"No bookings yet"}</h2></div>`}</div>`;
} else if(route==="records"||route==="circle"){
    main=`<div class="row between"><h1>Health records</h1><button class="btn btn-primary" onclick="uploadRecord()">Upload</button></div>
      <div class="stack">${records.length?records.map(r=>`<article class="card" style="cursor:pointer" onclick="viewRecord('${r.id}')">
        <div class="row" style="gap:12px;align-items:center">
          ${r.imageBase64?`<img src="${r.imageBase64}" style="width:56px;height:56px;object-fit:cover;border-radius:10px" alt="">`:`<div class="avatar"><i class="fa-solid fa-file-medical"></i></div>`}
          <div style="flex:1"><strong>${esc(r.type)}</strong><br><span class="muted">${esc(r.doctor||"—")} · ${esc(r.date)}</span></div>
          <button class="btn btn-ghost" style="color:var(--danger)" onclick="event.stopPropagation();deleteRecord('${r.id}')">Delete</button>
        </div>
      </article>`).join(""):`<div class="empty card"><h2>No records</h2><p>Upload a prescription or report</p></div>`}</div>`;
  } else {
    // Home overview — no "read-only" message
    main=`<div id="sos-slot"></div>
      ${(session.user?.linkedSeniors||[]).some(s=>s&&typeof s==="object"&&(s.name||s.phone))?`<section class="card section">${familyLinkedSeniorsBlock()}</section>`:""}
      ${(typeof renderMedAlertsBlock==="function"?renderMedAlertsBlock():"")}
      <div class="family-quick grid-home" style="margin-bottom:12px">
        <button type="button" class="home-tile" onclick="location.hash='#/helpers'">
          <span class="ic t1"><i class="fa-solid fa-bag-shopping"></i></span>
          <b>Book helper</b><small>Meds · groceries · doctor</small>
        </button>
        <button type="button" class="home-tile" onclick="location.hash='#/food'">
          <span class="ic t4"><i class="fa-solid fa-leaf"></i></span>
          <b>${t("food_plan")||"Healthy Recipes"}</b><small>${t("food_filter_hint")||"Filter by diet & time"}</small>
        </button>
        <button type="button" class="home-tile" onclick="location.hash='#/medicines'">
          <span class="ic t2"><i class="fa-solid fa-pills"></i></span>
          <b>Medicines</b><small>${medicines.length} active</small>
        </button>
        <button type="button" class="home-tile" onclick="location.hash='#/records'">
          <span class="ic t3"><i class="fa-solid fa-file-medical"></i></span>
          <b>Records</b><small>${records.length} files</small>
        </button>
      </div>
      <section class="card section">
        <h2>Medicines</h2>
        <p class="muted">${medicines.length} active · ${lowMeds.length} low stock</p>
        <button class="btn btn-secondary" onclick="location.hash='#/medicines'">See all</button>
      </section>
      <section class="card section">
        <h2>${t("your_bookings")||"Recent helper bookings"}</h2>
        ${(visibleBookings()||[]).slice(0,3).map(b=>{
          const hp=getHelperById(b.helperId);
          const st=b.status||"Requested";
          const canRate=st==="Completed"&&(b.rating==null||b.rating==="");
          return `<div class="card" style="padding:12px;margin:0 0 8px">
            <div class="row between"><strong>${esc(hp?hp.name:b.helperName||t("helper")||"Helper")}</strong>
              <span class="badge ${statusBadgeClass(st)}">${esc(st)}</span></div>
            <p class="muted" style="margin:4px 0">${esc(taskLabels[b.task]||b.task)} · ${esc(b.date||"")} ${esc(b.time||"")}</p>
            ${hp?`<div class="helper-meta">${helperRegisteredBadgeHtml()} ${helperRatingStarsHtml(hp)}</div>`:""}
            ${canRate?`<button type="button" class="btn btn-primary btn-sm" style="margin-top:8px" onclick="askRatingForBooking('${b.id}')">${t("rate_helper")||"Rate Helper"}</button>`:""}
            ${st==="Completed"&&b.rating!=null&&b.rating!==""?`<p class="muted" style="margin-top:6px">⭐ ${Number(b.rating).toFixed(0)}/5</p>`:""}
          </div>`;
        }).join("")||"<p class='muted'>"+(t("no_bookings_short")||"No bookings")+"</p>"}
        <button class="btn btn-primary" style="margin-top:10px;width:100%" onclick="location.hash='#/helpers'">${t("book_helper")||"Book a helper"}</button>
      </section>`;
  }
  root.innerHTML=`<div class="page"><header class="topbar caregiver-bar">
      <div class="logo"><span class="logo-mark"><i class="fa-solid fa-heart"></i></span>${t("app_name")}</div>
      <button type="button" class="logout-btn" aria-label="${t("logout")||"Logout"}" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i></button>
    </header>
    <main class="container">${main}</main>
    <nav class="bottom-nav">${buildRoleNav("family")}</nav></div>`;
  const famRoute=route;
  listenForCaregiverSOS?.();
  pollLocalSOSForFamily?.();
  $("#family-link-form")?.addEventListener("submit",async e=>{
    e.preventDefault();
    try{await linkSeniorByPhone(new FormData(e.target).get("phone"));toast(t("senior_linked")||"Linked");render()}
    catch(err){toast(err.message,true)}
  });
  if(route==="helpers"){
    const f=$("#helper-form");
    if(f)f.onsubmit=submitHelper;
    if(typeof bindHelperTaskBuilders==="function")bindHelperTaskBuilders();
    bindHelperPick();
  }
}
function bindHelperPick(){
  const input=document.getElementById("helper-id-input");
  const cards=document.querySelectorAll(".helper-pick-card");
  if(!input||!cards.length)return;
  cards.forEach(card=>{
    card.onclick=function(){
      cards.forEach(c=>c.classList.remove("selected"));
      card.classList.add("selected");
      input.value=card.getAttribute("data-helper-id")||"";
    };
  });
  if(!input.value) cards[0].click();
}
/* Language switcher lives in the header when logged in (so it never covers header buttons) */
function placeLanguageSwitcher(){
  const sw=window.__langSw||document.querySelector(".language-switcher");
  if(!sw)return;
  window.__langSw=sw;
  const logout=document.querySelector("#app .logout-btn");
  if(!logout){if(sw.parentNode!==document.body)document.body.append(sw);sw.classList.remove("in-header");return}
  let host=logout.parentElement;
  if(!host.classList.contains("senior-actions")&&!host.classList.contains("bar-actions")){
    const wrap=document.createElement("div");wrap.className="bar-actions";
    host.insertBefore(wrap,logout);wrap.append(logout);host=wrap;
  }
  host.insertBefore(sw,host.firstChild);
  sw.classList.add("in-header");
}
function render(){
  const __sw=document.querySelector(".language-switcher");
  if(__sw){window.__langSw=__sw;if(__sw.parentNode!==document.body){document.body.append(__sw);__sw.classList.remove("in-header")}}
  const login=document.getElementById("login-screen");
  const root=document.getElementById("app");
  function showLoginUI(){
    if(login){login.classList.remove("hidden");login.style.display="";}
    if(root){root.classList.add("hidden");root.style.display="none";}
  }
  function showAppUI(){
    if(login){login.classList.add("hidden");login.style.display="none";}
    if(root){root.classList.remove("hidden");root.style.display="block";}
  }
  if(location.hash==="#/login"){showLoginUI();return}
  if(!session.user){showLoginUI();applyTranslations?.();return}
  showAppUI();
  try{startCloudBookingsListener()}catch(e){}
  try{ecStartRecordsCloud()}catch(e){}
  try{
    if(session.role==="senior")renderSenior(root);
    else if(session.role==="family")renderFamily(root);
    else renderCaregiver(root);
  }catch(err){console.error(err);if(root)root.innerHTML="<div class='container' style='padding:24px'><h1>Error loading screen</h1><p>"+String(err.message||err)+"</p></div>";}
  placeLanguageSwitcher();
  applyTranslations?.();
  if(window.__lastRouteHash!==location.hash){window.__lastRouteHash=location.hash;window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0;root&&(root.scrollTop=0)}
}
window.addEventListener("hashchange",render);window.addEventListener("load",()=>{if("serviceWorker"in navigator)navigator.serviceWorker.register("service-worker.js")});const remindedKeys=new Set();
/* —— Permissions: browser dialog only when feature needs it; never if granted/denied —— */
async function getLocationPermissionState(){
  try{
    if(navigator.permissions&&navigator.permissions.query){
      const st=await navigator.permissions.query({name:"geolocation"});
      return st.state;
    }
  }catch(e){}
  return "prompt";
}
function notificationPermissionState(){
  if(!("Notification"in window))return "denied";
  return Notification.permission;
}
/** Request notification only if still "default" (prompt). */
async function ensureNotificationPermission(){
  /* Never prompts. Permissions are asked ONE time by requestStartupPermissions(). */
  if(!("Notification"in window))return "denied";
  return Notification.permission;
}
const PERM_DONE_KEY="eldercarePermsDone";
function capPlugin(n){return (window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins[n])||null}
/** Ask notification + location ONE time, ever. After this, the app never asks again
    (if the user said no, they can change it in phone Settings). */
async function ensureLocationPermission(){
  try{
    const G=capPlugin("Geolocation");
    if(G&&G.checkPermissions){
      const st=await G.checkPermissions();
      if(st&&(st.location==="prompt"||st.location==="prompt-with-rationale")){await G.requestPermissions({permissions:["location"]})}
      return;
    }
    if(!window.__locAskedThisLaunch&&navigator.geolocation){
      window.__locAskedThisLaunch=true;     // once per app launch; Android shows its prompt only if not decided yet
      await new Promise(res=>navigator.geolocation.getCurrentPosition(
        p=>{if(typeof cacheLastLocation==="function")cacheLastLocation(p.coords.latitude,p.coords.longitude);res()},
        ()=>res(),{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
    }
  }catch(e){console.warn("location permission",e)}
}
async function requestStartupPermissions(){
  if(localStorage.getItem(PERM_DONE_KEY)!=="1"){
    localStorage.setItem(PERM_DONE_KEY,"1");      // notifications: only once, ever
    try{
      const LN=capPlugin("LocalNotifications");
      if(LN&&LN.requestPermissions)await LN.requestPermissions();
      else if("Notification"in window&&Notification.permission==="default")await Notification.requestPermission();
    }catch(e){console.warn("notification permission",e)}
    await new Promise(r=>setTimeout(r,800));
  }
  await ensureLocationPermission();               // asks only while Android still says "not asked yet"
}
/* In the installed app, ask right at first launch. In a browser, it is asked after the first sign-in. */
window.addEventListener("load",()=>{
  try{if(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform())setTimeout(requestStartupPermissions,800)}catch(e){}
});
const LOC_ASKED_KEY="eldercareLocAskedOnce";
/** Ask location only once after sign-in if state is still "prompt". Never on page load loops. */
async function askLocationOnceAfterLogin(){
  await requestStartupPermissions();
  if(localStorage.getItem(LOC_ASKED_KEY)==="1"){
    // Already asked; if granted, seed cache quietly
    const state=await getLocationPermissionState();
    if(state==="granted"&&navigator.geolocation){
      navigator.geolocation.getCurrentPosition(
        p=>{if(typeof cacheLastLocation==="function")cacheLastLocation(p.coords.latitude,p.coords.longitude);},
        err=>console.warn("seed location failed",err),
        {enableHighAccuracy:true,timeout:8000,maximumAge:60000}
      );
    }
    return;
  }
  const state=await getLocationPermissionState();
  if(state==="denied"){localStorage.setItem(LOC_ASKED_KEY,"1");return;}
  if(state==="granted"){
    localStorage.setItem(LOC_ASKED_KEY,"1");
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(
        p=>{if(typeof cacheLastLocation==="function")cacheLastLocation(p.coords.latitude,p.coords.longitude);},
        err=>console.warn("seed location failed",err),
        {enableHighAccuracy:true,timeout:8000,maximumAge:60000}
      );
    }
    if(typeof startLocationWatch==="function")startLocationWatch();
    return;
  }
  if(!navigator.geolocation){localStorage.setItem(LOC_ASKED_KEY,"1");return;}
  localStorage.setItem(LOC_ASKED_KEY,"1");
  await new Promise(resolve=>{
    navigator.geolocation.getCurrentPosition(
      p=>{if(typeof cacheLastLocation==="function")cacheLastLocation(p.coords.latitude,p.coords.longitude);resolve();},
      err=>{console.warn("location permission/read failed",err);resolve();},
      {enableHighAccuracy:true,timeout:8000,maximumAge:0}
    );
  });
  if(typeof startLocationWatch==="function")startLocationWatch();
}
/** For SOS: never prompt. If granted, read location; if denied/prompt, return nulls. */
async function ensureLocationPermissionNoPrompt(){
  const state=await getLocationPermissionState();
  if(state==="granted")return "granted";
  return "denied";
}
function locationDeniedHint(){
  return `<p class="perm-settings-hint muted"><i class="fa-solid fa-circle-info"></i> ${t("enable_in_settings")||"Enable location in phone settings to share your position during SOS."}</p>`;
}
function notificationDeniedHint(){
  return `<p class="perm-settings-hint muted"><i class="fa-solid fa-circle-info"></i> ${t("enable_notif_settings")||"Enable notifications in phone settings to receive SOS alerts."}</p>`;
}
/* Medicine reminders handled in medicines.js */

const elderCareRenderSenior=renderSenior,elderCareRenderCaregiver=renderCaregiver;
function passwordSettingsCard(){return `<section class="card section"><h2>${t("change_password")}</h2><form id="change-password-form" class="stack" onsubmit="event.preventDefault();changePassword()"><input name="currentPassword" type="password" placeholder="${t("current_password")}" autocomplete="current-password" required><input name="newPassword" type="password" placeholder="${t("new_password")}" minlength="6" autocomplete="new-password" required><input name="confirmPassword" type="password" placeholder="${t("confirm_new_password")}" minlength="6" autocomplete="new-password" required><button class="btn btn-secondary">${t("change_password")}</button></form></section>`}
renderSenior=function(root){elderCareRenderSenior(root);if(location.hash==="#/settings")root.insertAdjacentHTML("beforeend",passwordSettingsCard())};
renderCaregiver=function(root){elderCareRenderCaregiver(root);if(location.hash==="#/settings")root.insertAdjacentHTML("beforeend",passwordSettingsCard())};

addMedicine=function(){ if(typeof openMedicineForm==="function") openMedicineForm(); };
deleteMedicine=function(id){ if(typeof deleteMedicineById==="function") deleteMedicineById(id); };
takeMedicine=function(id){
  // mark first untaken dose for today for this med
  if(typeof buildTodayDoses!=="function")return;
  const d=buildTodayDoses().find(x=>x.medId===id&&x.status!=="taken");
  if(d) markMedicineTaken(d.medId,d.time);
};

