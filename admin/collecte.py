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
TITRE = re.compile(r'<h1 id="titlePage">(.*?)</h1>', re.S)
SORTIE = Path(__file__).parent.parent / "site" / "services.json"
PROFONDEUR = 6
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
    return list(dict.fromkeys(LIEN.findall(bloc.group(0)))) if bloc else []


def fiche(identifiant):
    page = telecharge(ANNUAIRE + "/gouvernement/" + identifiant)
    titre = TITRE.search(page)
    return identifiant, texte(titre.group(1)) if titre else "", enfants(page)


def collecte():
    ministeres = list(dict.fromkeys(LIEN.findall(telecharge(DEPART))))
    services = {}
    parents = {identifiant: None for identifiant in ministeres}
    niveau = ministeres
    with ThreadPoolExecutor(PARALLELE) as executeur:
        for profondeur in range(PROFONDEUR):
            suivant = []
            for identifiant, nom, liste in executeur.map(fiche, niveau):
                services[identifiant] = {"nom": nom, "parent": parents[identifiant], "enfants": []}
                for enfant in liste:
                    if enfant not in parents:
                        parents[enfant] = identifiant
                        suivant.append(enfant)
            print(profondeur, len(niveau), len(suivant), file=sys.stderr)
            niveau = suivant if profondeur < PROFONDEUR - 1 else []
    for identifiant, service in services.items():
        if service["parent"] in services:
            services[service["parent"]]["enfants"].append(identifiant)
    return [
        {"id": identifiant, "nom": service["nom"], "enfants": service["enfants"]}
        for identifiant, service in services.items()
        if service["nom"]
        ], ministeres


def main():
    services, ministeres = collecte()
    SORTIE.write_text(
        json.dumps({"racines": ministeres, "services": services}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
        )


if __name__ == "__main__":
    main()
