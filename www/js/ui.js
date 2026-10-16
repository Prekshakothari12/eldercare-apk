const $=s=>document.querySelector(s),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function maskPhone(phone){const digits=String(phone||"").replace(/\D/g,"");return digits.length===10?`+91 ${digits.slice(0,6).replace(/\d/g,"X")}${digits.slice(6)}`:"—"}
function maskPhoneShort(phone){const digits=String(phone||"").replace(/\D/g,"");return digits.length===10?`XXXXXX${digits.slice(6)}`:""}

/** Host element for overlays — prefer #app so UI stays in the phone column */
function appHost(){
  return document.getElementById("app") || document.getElementById("login-screen") || document.body;
}

function toast(message,error=false){
  document.querySelectorAll(".toast").forEach(el=>el.remove());
  const el=document.createElement("div");
  el.className=`toast${error?" error":""}`;
  el.textContent=message;
  appHost().append(el);
  setTimeout(()=>el.remove(),3000);
}

function formatTime(t){const [h,m]=t.split(":").map(Number);return new Date(2000,0,1,h,m).toLocaleTimeString(typeof localeTag==="function"?localeTag():"en-IN",{hour:"numeric",minute:"2-digit"})}
function formatDateTime(value){const date=value instanceof Date?value:new Date(value);return date.toLocaleString(typeof localeTag==="function"?localeTag():"en-IN")}

/** Bottom sheet inside the app column only — never full browser width */
function modal(content){
  const b=document.createElement("div");
  b.className="modal-backdrop overlay app-overlay";
  b.innerHTML=`<div class="modal sheet"><div class="modal-handle"></div>${content}</div>`;
  b.addEventListener("click",e=>{if(e.target===b)b.remove()});
  appHost().append(b);
  applyTranslations?.(b);
  return b;
}

function initials(name){return String(name||"?").split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()}
function seniorSwitcherLabel(profile){const name=profile?.name||t("linked_senior");const masked=maskPhoneShort(profile?.phone);return masked?`${name} (${masked})`:name}

/* ===================================================================
   Notifications that work in the installed Android app AND in a browser.
   The Android WebView has no `Notification` API, so in the APK we must use
   the Capacitor LocalNotifications plugin.
   =================================================================== */
function ecPlugin(name){return (window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins[name])||null}
function ecIsNative(){try{return !!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform())}catch(e){return false}}
let __ecChannelsReady=null,__ecPermAskedThisLaunch=false;
async function ecEnsureNotifyReady(){
  const LN=ecPlugin("LocalNotifications");
  if(!LN)return false;
  try{
    let st=await LN.checkPermissions();
    if(st&&st.display!=="granted"&&!__ecPermAskedThisLaunch){
      __ecPermAskedThisLaunch=true;           // ask at most once per app launch
      st=await LN.requestPermissions();
    }
    if(!st||st.display!=="granted")return false;
    if(!__ecChannelsReady){
      __ecChannelsReady=Promise.all([
        LN.createChannel({id:"general",name:"ElderCare updates",description:"Medicines, bookings and reminders",importance:4,visibility:1,vibration:true}).catch(()=>{}),
        LN.createChannel({id:"meds",name:"Medicine reminders",description:"Time to take a medicine",importance:5,visibility:1,vibration:true}).catch(()=>{}),
        LN.createChannel({id:"sos",name:"SOS alerts",description:"Emergency alerts",importance:5,visibility:1,vibration:true}).catch(()=>{})
      ]);
    }
    await __ecChannelsReady;
    return true;
  }catch(e){console.warn("notify setup",e);return false}
}
/** Show a notification now. opts: {tag, channel:"general"|"meds"|"sos"} */
async function ecNotify(title,body,opts){
  opts=opts||{};
  const LN=ecPlugin("LocalNotifications");
  if(LN){
    if(!(await ecEnsureNotifyReady()))return false;
    try{
      await LN.schedule({notifications:[{id:Math.floor(Math.random()*2000000000),title:String(title||"ElderCare"),body:String(body||""),channelId:opts.channel||"general"}]});
      return true;
    }catch(e){console.warn("LocalNotifications.schedule",e);return false}
  }
  /* Browser */
  try{
    if(!("Notification"in window))return false;
    if(Notification.permission==="default"&&!__ecPermAskedThisLaunch){__ecPermAskedThisLaunch=true;await Notification.requestPermission()}
    if(Notification.permission!=="granted")return false;
    const reg=navigator.serviceWorker?await navigator.serviceWorker.getRegistration():null;
    if(reg&&reg.showNotification){await reg.showNotification(title,{body,tag:opts.tag||undefined,renotify:!!opts.tag,vibrate:[200,100,200]});return true}
    new Notification(title,{body,tag:opts.tag||undefined});
    return true;
  }catch(e){console.warn("notify",e);return false}
}
window.ecNotify=ecNotify;
window.ecEnsureNotifyReady=ecEnsureNotifyReady;

/* ===================================================================
   External links (schemes, maps, YouTube, proof photos).
   Inside the APK a target="_blank" link opens INSIDE the app's WebView,
   where many government sites fail to load. Open them in the phone's
   browser (Chrome Custom Tab) instead.
   =================================================================== */
function ecOpenExternal(url){
  const B=ecPlugin("Browser");
  if(B&&B.open){B.open({url:url}).catch(()=>{window.open(url,"_system")});return}
  window.open(url,"_blank","noopener");
}
window.ecOpenExternal=ecOpenExternal;
document.addEventListener("click",function(e){
  if(!ecIsNative())return;
  const a=e.target&&e.target.closest?e.target.closest("a[href]"):null;
  if(!a)return;
  if(a.closest(".sos-family-overlay,.sos-modal,.caregiver-sos,.sos-banner"))return;   // SOS links behave exactly as before
  const href=a.getAttribute("href")||"";
  if(!/^https?:\/\//i.test(href))return;           // tel:, #/route etc. behave normally
  e.preventDefault();
  ecOpenExternal(href);
},true);
