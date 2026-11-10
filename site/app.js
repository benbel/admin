const ANNUAIRE = "https://lannuaire.service-public.gouv.fr/gouvernement/";
const RACINE = "gouvernement";
const EXEMPLE = [
  { op: "creer", id: "n0", nom: "Direction générale de l'environnement", parent: "05f90b6a-e3d9-4a41-a919-2e2f2d77e517" },
  { op: "deplacer", id: "788fbe81-0c4b-4cea-b43a-9074d6aebe01", parent: "n0" },
  { op: "deplacer", id: "7a9c104f-d084-4acd-8dc1-15623daab613", parent: "n0" },
  { op: "deplacer", id: "72569d98-5b45-477c-ba48-ba88e88be503", parent: "n0" },
  { op: "deplacer", id: "6b0d4e7c-bd64-483b-a34e-4ea12be4fddc", parent: "n0" },
  { op: "deplacer", id: "ef797219-781f-4b8c-9b13-25ddb219f116", parent: "n0" },
  { op: "deplacer", id: "90b4a970-ca3b-4658-a6af-edc7ffee1fe8", parent: "n0" },
  { op: "supprimer", id: "9d2b584b-a219-4c78-bbd3-a85386cdc275" },
  { op: "deplacer", id: "3c94847b-5f70-4fbf-a6a8-9a6196791267", parent: "e7b05d23-4d86-400a-b8cf-38d8f40dbfff" },
  { op: "deplacer", id: "8884e740-cc68-4d1f-a825-be7289da3c54", parent: "e7b05d23-4d86-400a-b8cf-38d8f40dbfff" },
  ];

let base = null;
let services = new Map();
let operations = [];
let descriptions = [];
let ouverts = new Set([RACINE]);
let focus = RACINE;
let journalOuvert = false;
let choisi = null;
let mode = null;
let formulaire = null;
let glisse = null;

const arbre = document.getElementById("arbre");
const selection = document.getElementById("selection");
const journal = document.getElementById("journal");
const ariane = document.getElementById("ariane");

function element(balise, classe, texte) {
  const e = document.createElement(balise);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

function bouton(texte, action) {
  const b = element("button", "", texte);
  b.type = "button";
  b.addEventListener("click", action);
  return b;
}

function service(id) {
  return services.get(id);
}

function nom(id) {
  return id === RACINE ? "Gouvernement" : service(id).nom;
}

function ajoute(id, libelle, parent, apres) {
  services.set(id, { id: id, nom: libelle, parent: parent, enfants: [], supprime: false, notes: [], nouveau: true });
  const freres = service(parent).enfants;
  const rang = apres ? freres.indexOf(apres) + 1 : freres.length;
  freres.splice(rang, 0, id);
}

function detache(id) {
  const freres = service(service(id).parent).enfants;
  freres.splice(freres.indexOf(id), 1);
}

function rattache(id, parent) {
  detache(id);
  service(id).parent = parent;
  service(parent).enfants.push(id);
}

function note(id, texte) {
  service(id).notes.push(texte);
}

function supprime(id) {
  service(id).supprime = true;
  service(id).enfants.forEach(supprime);
}

function actifs(id) {
  return service(id).enfants.filter(e => !service(e).supprime);
}

function descendants(id) {
  return service(id).enfants.flatMap(e => [e].concat(descendants(e)));
}

function ancetres(id) {
  const liste = [];
  let courant = service(id).parent;
  while (courant) {
    liste.push(courant);
    courant = service(courant).parent;
  }
  return liste;
}

function applique(op) {
  const s = service(op.id);
  if (op.op === "creer") {
    ajoute(op.id, op.nom, op.parent);
    note(op.id, "créé");
    return "Création de " + op.nom;
  }
  if (op.op === "renommer") {
    const ancien = s.nom;
    s.nom = op.nom;
    note(op.id, "anciennement " + ancien);
    return ancien + " devient " + op.nom;
  }
  if (op.op === "deplacer") {
    const ancien = s.parent;
    rattache(op.id, op.parent);
    note(op.id, "rattaché à " + nom(op.parent) + ", auparavant " + nom(ancien));
    if (ancien !== RACINE) note(ancien, s.nom + " transféré à " + nom(op.parent));
    return s.nom + " → " + nom(op.parent);
  }
  if (op.op === "fusionner") {
    const a = service(op.a), b = service(op.b);
    ajoute(op.id, op.nom, a.parent, op.a);
    [a, b].forEach(x => {
      actifs(x.id).forEach(e => rattache(e, op.id));
      supprime(x.id);
      note(x.id, "fusionné dans " + op.nom);
    });
    note(op.id, "fusion de " + a.nom + " et " + b.nom);
    return "Fusion de " + a.nom + " et " + b.nom + " : " + op.nom;
  }
  if (op.op === "scinder") {
    ajoute(op.nouveau, op.nom, s.parent, op.id);
    op.enfants.forEach(e => rattache(e, op.nouveau));
    note(op.nouveau, "issu de " + s.nom);
    note(op.id, "scindé, " + op.nom + " créé");
    return "Scission de " + s.nom + " : " + op.nom;
  }
  if (op.op === "supprimer") {
    supprime(op.id);
    note(op.id, "supprimé");
    return "Suppression de " + s.nom;
  }
  return "";
}

function construit() {
  services = new Map();
  services.set(RACINE, { id: RACINE, nom: "Gouvernement", parent: null, enfants: base.racines.slice(), supprime: false, notes: [], nouveau: false });
  base.services.forEach(b => services.set(b.id, { id: b.id, nom: b.nom, parent: null, enfants: b.enfants.slice(), supprime: false, notes: [], nouveau: false }));
  services.forEach(s => { s.enfants = s.enfants.filter(e => services.has(e)); });
  services.forEach(s => s.enfants.forEach(e => { service(e).parent = s.id; }));
  descriptions = [];
  for (let k = 0; k < operations.length; k += 1) {
    try {
      descriptions.push(applique(operations[k]));
    } catch (erreur) {
      operations = operations.slice(0, k);
    }
  }
}

function identifiant() {
  return "n" + operations.length;
}

function enregistre(op) {
  operations.push(op);
  formulaire = null;
  mode = null;
  construit();
  history.replaceState(null, "", "#" + encodeURIComponent(JSON.stringify(operations)));
  rend();
}

function annule(nombre) {
  operations = operations.slice(0, operations.length - nombre);
  construit();
  if (choisi && !services.has(choisi)) choisi = null;
  history.replaceState(null, "", operations.length ? "#" + encodeURIComponent(JSON.stringify(operations)) : location.pathname);
  formulaire = null;
  mode = null;
  rend();
}

function ouvreChemin(id) {
  ancetres(id).forEach(a => ouverts.add(a));
}

function dans(id, racine) {
  return racine === RACINE || id === racine || ancetres(id).includes(racine);
}

function recentre(id) {
  focus = id;
  ouverts.add(id);
  rend();
  arbre.scrollTo(0, 0);
}

function montre(id) {
  if (!dans(id, focus)) focus = RACINE;
  ouvreChemin(id);
  choisit(id);
  document.querySelector(".choisi > .service").scrollIntoView({ block: "nearest", inline: "start" });
}

function choisit(id) {
  choisi = id;
  mode = null;
  formulaire = null;
  rend();
}

function cibleValide(id) {
  if (!mode || service(id).supprime || id === mode.id) return false;
  if (mode.type === "deplacer") return id !== service(mode.id).parent && !descendants(mode.id).includes(id);
  return !descendants(mode.id).includes(id) && !descendants(id).includes(mode.id);
}

function clique(id) {
  if (!mode) {
    choisit(id === choisi ? null : id);
    return;
  }
  if (!cibleValide(id)) return;
  if (mode.type === "deplacer") {
    ouvreChemin(mode.id);
    ouverts.add(id);
    enregistre({ op: "deplacer", id: mode.id, parent: id });
    return;
  }
  formulaire = { type: "fusionner", cible: id };
  mode = null;
  rend();
}

function marque(id, contient) {
  const s = service(id);
  const dessous = s.enfants.map(e => marque(e, contient)).some(x => x);
  contient.set(id, dessous);
  return dessous || s.notes.length > 0;
}

function branche(id, contient) {
  const s = service(id);
  const bloc = element("div", "branche");
  const boite = element("div", "service");
  const ouvert = ouverts.has(id) && s.enfants.length > 0;
  const horizontal = ancetres(id).length % 2 === 0;
  if (ouvert) bloc.classList.add("ouvert");
  if (horizontal) bloc.classList.add("h");
  if (s.supprime) bloc.classList.add("supprime");
  if (s.notes.length) bloc.classList.add("modifie");
  if (contient.get(id)) bloc.classList.add("contient");
  if (id === choisi) bloc.classList.add("choisi");
  if (mode && cibleValide(id)) bloc.classList.add("cible");
  const etiquette = element("span", "etiquette");
  etiquette.append(element("span", "nom", s.nom));
  boite.append(etiquette);
  boite.addEventListener("click", () => clique(id));
  if (s.enfants.length) {
    const b = bouton(ouvert ? "[−]" : "[+]", e => {
      e.stopPropagation();
      if (ouvert) ouverts.delete(id);
      else ouverts.add(id);
      rend();
    });
    b.classList.add("bascule");
    etiquette.append(b);
  }
  if (!s.supprime) {
    boite.draggable = true;
    boite.addEventListener("dragstart", e => {
      glisse = id;
      e.dataTransfer.effectAllowed = "move";
    });
    boite.addEventListener("dragend", () => { glisse = null; });
    boite.addEventListener("dragover", e => {
      if (!glisse || glisse === id || service(glisse).parent === id || descendants(glisse).includes(id)) return;
      e.preventDefault();
      bloc.classList.add("survol");
    });
    boite.addEventListener("dragleave", () => bloc.classList.remove("survol"));
    boite.addEventListener("drop", e => {
      e.preventDefault();
      const deplace = glisse;
      glisse = null;
      ouverts.add(id);
      enregistre({ op: "deplacer", id: deplace, parent: id });
    });
  }
  bloc.append(boite);
  if (ouvert) {
    const rangee = element("div", horizontal ? "enfants horizontal" : "enfants vertical");
    s.enfants.forEach(e => rangee.append(branche(e, contient)));
    bloc.append(rangee);
  }
  return bloc;
}

function champ(etiquette, valeur) {
  const label = element("label", "", etiquette);
  const input = element("input");
  input.type = "text";
  input.value = valeur;
  input.required = true;
  label.append(input);
  return [label, input];
}

function formulaireNom(etiquette, valeur, validation, extra) {
  const f = element("form");
  const [label, input] = champ(etiquette, valeur);
  f.append(label);
  if (extra) f.append(extra);
  const actions = element("div", "actions");
  const valider = element("button", "", "valider");
  valider.type = "submit";
  actions.append(valider, bouton("annuler", () => { formulaire = null; rend(); }));
  f.append(actions);
  f.addEventListener("submit", e => {
    e.preventDefault();
    if (input.value.trim()) validation(input.value.trim(), f);
  });
  setTimeout(() => input.focus(), 0);
  return f;
}

function cases(id) {
  const ul = element("ul");
  actifs(id).forEach(e => {
    const li = element("li");
    const label = element("label");
    const c = element("input");
    c.type = "checkbox";
    c.value = e;
    label.append(c, " " + nom(e));
    li.append(label);
    ul.append(li);
  });
  return ul;
}

function rendFormulaire(id) {
  const s = service(id);
  if (formulaire.type === "renommer") {
    return formulaireNom("Nouveau nom", s.nom, v => enregistre({ op: "renommer", id: id, nom: v }));
  }
  if (formulaire.type === "creer") {
    return formulaireNom(id === RACINE ? "Nom du ministère" : "Nom du sous-service", "", v => {
      ouverts.add(id);
      enregistre({ op: "creer", id: identifiant(), nom: v, parent: id });
    });
  }
  if (formulaire.type === "scinder") {
    return formulaireNom("Nom du nouveau service", "", (v, f) => {
      const enfants = [...f.querySelectorAll("input[type=checkbox]:checked")].map(c => c.value);
      const nouveau = identifiant();
      ouverts.add(service(id).parent);
      if (enfants.length) ouverts.add(nouveau);
      enregistre({ op: "scinder", id: id, nouveau: nouveau, nom: v, enfants: enfants });
    }, cases(id));
  }
  if (formulaire.type === "fusionner") {
    const f = formulaireNom("Nom du service issu de la fusion avec " + nom(formulaire.cible), s.nom, v => {
      const nouveau = identifiant();
      ouvreChemin(id);
      ouverts.add(nouveau);
      enregistre({ op: "fusionner", id: nouveau, a: id, b: formulaire.cible, nom: v });
    });
    return f;
  }
  return element("div");
}

function rendSelection() {
  selection.innerHTML = "";
  const id = choisi || RACINE;
  const s = service(id);
  const titre = element("h2", "", s.nom + " ");
  if (!s.nouveau && id !== RACINE) {
    const lien = element("a", "externe", "annuaire");
    lien.href = ANNUAIRE + id;
    lien.target = "_blank";
    titre.append(lien);
  }
  selection.append(titre);
  if (s.notes.length) {
    const ul = element("ul");
    s.notes.forEach(n => ul.append(element("li", "", n)));
    selection.append(ul);
  }
  if (s.supprime) return;
  if (mode) {
    selection.append(element("p", "", (mode.type === "deplacer" ? "Choisir le nouveau service de rattachement" : "Choisir le service à fusionner") + " (Échap pour annuler)"));
    return;
  }
  const actions = element("div", "actions");
  const ouvre = type => () => { formulaire = { type: type }; rend(); };
  if (id === RACINE) {
    actions.append(bouton("créer un ministère", ouvre("creer")));
  } else {
    if (s.enfants.length && id !== focus) actions.append(bouton("recentrer", () => recentre(id)));
    actions.append(bouton("renommer", ouvre("renommer")));
    actions.append(bouton("créer un sous-service", ouvre("creer")));
    if (actifs(id).length > 1) actions.append(bouton("scinder", ouvre("scinder")));
    actions.append(bouton("fusionner avec…", () => { mode = { type: "fusionner", id: id }; formulaire = null; rend(); }));
    actions.append(bouton("rattacher à…", () => { mode = { type: "deplacer", id: id }; formulaire = null; rend(); }));
    actions.append(bouton("supprimer", () => enregistre({ op: "supprimer", id: id })));
  }
  selection.append(actions);
  if (formulaire) selection.append(rendFormulaire(id));
}

function cible(op) {
  return op.op === "scinder" ? op.nouveau : op.id;
}

function rendJournal() {
  journal.innerHTML = "";
  const titre = element("h2", "", "Modifications (" + operations.length + ")");
  journal.append(titre);
  if (!operations.length) {
    const p = element("p", "", "Exemple : ");
    const lien = element("a", "", "pôle ministériel de l'écologie");
    lien.href = "#" + encodeURIComponent(JSON.stringify(EXEMPLE));
    lien.addEventListener("click", e => {
      e.preventDefault();
      operations = EXEMPLE.slice();
      construit();
      history.replaceState(null, "", lien.href);
      ouvreModifications();
      montre(EXEMPLE[0].id);
    });
    p.append(lien);
    journal.append(p);
    return;
  }
  const bascule = bouton(journalOuvert ? "[−]" : "[+]", () => {
    journalOuvert = !journalOuvert;
    rend();
  });
  bascule.classList.add("bascule");
  titre.append(bascule);
  const ol = element("ul");
  ol.hidden = !journalOuvert;
  descriptions.forEach((d, k) => {
    const li = element("li");
    const a = element("a", "", d);
    a.addEventListener("click", () => montre(cible(operations[k])));
    li.append(a);
    ol.append(li);
  });
  journal.append(ol);
  const actions = element("div", "actions");
  actions.append(bouton("annuler la dernière", () => annule(1)));
  actions.append(bouton("tout annuler", () => annule(operations.length)));
  actions.append(bouton("déplier les modifications", ouvreModifications));
  journal.append(actions);
}

function ouvreModifications() {
  services.forEach(s => { if (s.notes.length) ouvreChemin(s.id); });
  rend();
}

function rendNoms() {
  const liste = document.getElementById("noms");
  liste.innerHTML = "";
  [...services.values()]
    .filter(s => s.id !== RACINE && !s.supprime)
    .map(s => s.nom)
    .sort((a, b) => a.localeCompare(b, "fr"))
    .forEach(n => liste.append(new Option(n)));
}

function rendAriane() {
  ariane.innerHTML = "";
  if (focus === RACINE) return;
  ancetres(focus).reverse().forEach(a => {
    const lien = element("a", "", nom(a));
    lien.addEventListener("click", () => recentre(a));
    ariane.append(lien, " › ");
  });
  ariane.append(nom(focus));
}

function rend() {
  if (!services.has(focus)) focus = RACINE;
  const contient = new Map();
  marque(RACINE, contient);
  arbre.innerHTML = "";
  if (focus === RACINE) service(RACINE).enfants.forEach(e => arbre.append(branche(e, contient)));
  else arbre.append(branche(focus, contient));
  rendAriane();
  rendSelection();
  rendJournal();
  rendNoms();
}

document.getElementById("recherche").addEventListener("change", e => {
  const trouve = [...services.values()].find(s => s.nom === e.target.value && !s.supprime);
  if (!trouve) return;
  e.target.value = "";
  if (mode) clique(trouve.id);
  else montre(trouve.id);
});

window.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (mode || formulaire) {
    mode = null;
    formulaire = null;
  } else {
    choisi = null;
  }
  rend();
});

function lit() {
  try {
    const valeur = JSON.parse(decodeURIComponent(location.hash.slice(1)));
    return Array.isArray(valeur) ? valeur : [];
  } catch (erreur) {
    return [];
  }
}

fetch("services.json")
  .then(r => r.json())
  .then(donnees => {
    base = donnees;
    operations = lit();
    construit();
    rend();
  });
