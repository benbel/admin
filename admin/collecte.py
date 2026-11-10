import html
import json
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ANNUAIRE = "https://lannuaire.service-public.gouv.fr"
DEPART = ANNUAIRE + "/navigation/ministeres"
LIEN = re.compile(r'href="' + re.escape(ANNUAIRE) + r'/gouvernement/([0-9a-f-]{36})"')
LISTE = re.compile(r'data-test="organisations-list".*?</ul>', re.S)
REGROUPEMENT = re.compile(r'href="' + re.escape(ANNUAIRE) + r'/gouvernement/([0-9a-f-]{36})"[^>]*data-test="href-lien-ministeres"')
TITRE = re.compile(r'<h1[^>]*id="(?:titlePage|contentTitle)"[^>]*>(.*?)</h1>', re.S)
TRANSPARENTS = ("Services sous autorité conjointe", "Services centraux")
SORTIE = Path(__file__).parent.parent / "site" / "services.json"
PARALLELE = 6


def telecharge(adresse):
    for essai in range(4):
        try:
            requete = urllib.request.Request(adresse, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(requete, timeout=30) as reponse:
                return reponse.read().decode("utf-8")
        except OSError:
            time.sleep(2 ** essai)
    return ""


def texte(fragment):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", "", fragment)).split())


def enfants(page):
    bloc = LISTE.search(page)
    liste = LIEN.findall(bloc.group(0)) if bloc else []
    return list(dict.fromkeys(liste + REGROUPEMENT.findall(page)))


def fiche(identifiant):
    page = telecharge(ANNUAIRE + "/gouvernement/" + identifiant)
    titre = TITRE.search(page)
    return identifiant, texte(titre.group(1)) if titre else "", enfants(page), 'id="contentTitle"' in page


def deplie(liste, enfants, transparents):
    resultat = []
    for identifiant in liste:
        if identifiant in transparents:
            resultat.extend(deplie(enfants[identifiant], enfants, transparents))
        else:
            resultat.append(identifiant)
    return list(dict.fromkeys(resultat))


def sans_cycles(racines, enfants):
    gardes = {identifiant: [] for identifiant in enfants}
    etat = {}
    for racine in racines:
        if racine in etat:
            continue
        etat[racine] = "en cours"
        pile = [(racine, iter(enfants[racine]))]
        while pile:
            noeud, suite = pile[-1]
            enfant = next(suite, None)
            if enfant is None:
                etat[noeud] = "fini"
                pile.pop()
            elif etat.get(enfant) != "en cours":
                gardes[noeud].append(enfant)
                if enfant not in etat:
                    etat[enfant] = "en cours"
                    pile.append((enfant, iter(enfants[enfant])))
    return gardes


def collecte():
    ministeres = list(dict.fromkeys(LIEN.findall(telecharge(DEPART))))
    noms = {}
    listes = {}
    regroupements = set()
    vus = set(ministeres)
    niveau = ministeres
    profondeur = 0
    with ThreadPoolExecutor(PARALLELE) as executeur:
        while niveau:
            suivant = []
            for identifiant, nom, liste, regroupement in executeur.map(fiche, niveau):
                noms[identifiant] = nom
                listes[identifiant] = liste
                if regroupement:
                    regroupements.add(identifiant)
                for enfant in liste:
                    if enfant not in vus:
                        vus.add(enfant)
                        suivant.append(enfant)
            print(profondeur, len(niveau), len(suivant), file=sys.stderr)
            niveau = suivant
            profondeur += 1
    valides = {identifiant for identifiant, nom in noms.items() if nom}
    racines = [identifiant for identifiant in ministeres if identifiant in valides]
    enfants = {
        identifiant: [enfant for enfant in listes[identifiant] if enfant in valides]
        for identifiant in valides
        }
    transparents = {
        identifiant for identifiant in regroupements & valides
        if noms[identifiant].startswith(TRANSPARENTS)
        }
    print(len(transparents), "regroupements transparents", file=sys.stderr)
    racines = deplie(racines, enfants, transparents)
    enfants = {
        identifiant: deplie(liste, enfants, transparents)
        for identifiant, liste in enfants.items()
        if identifiant not in transparents
        }
    gardes = sans_cycles(racines, enfants)
    return [
        {"id": identifiant, "nom": noms[identifiant], "enfants": gardes[identifiant]}
        for identifiant in noms
        if identifiant in enfants
        ], racines


def main():
    services, ministeres = collecte()
    SORTIE.write_text(
        json.dumps({"racines": ministeres, "services": services}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
        )


if __name__ == "__main__":
    main()
