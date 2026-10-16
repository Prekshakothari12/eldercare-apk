const roleDefaults={senior:"home",caregiver:"home",family:"family"};
const roleNav={
  senior:[["home","home","fa-house"],["medicines","medicines","fa-pills"],["food","food_plan","fa-leaf"],["community","audio_short","fa-music"],["schemes","sn_short","fa-landmark"],["records","records","fa-file-medical"]],
  caregiver:[["home","home","fa-house"],["helpers","my_tasks","fa-list-check"],["settings","settings","fa-gear"]],
  family:[["family","overview","fa-house"],["helpers","helpers","fa-bag-shopping"],["medicines","medicines","fa-pills"],["food","food","fa-leaf"],["records","records","fa-file-medical"],["settings","settings","fa-gear"]]
};
function buildRoleNav(role){
  const current=(location.hash.replace("#/","")||roleDefaults[role]);
  return (roleNav[role]||[]).map(([route,key,icon])=>
    `<button class="${current===route?"active":""}" aria-label="${t(key)||key}" onclick="location.hash='#/${route}'"><i class="fa-solid ${icon}"></i><span>${t(key)||key}</span></button>`
  ).join("");
}
