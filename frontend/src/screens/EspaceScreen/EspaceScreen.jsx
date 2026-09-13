// src/screens/EspaceScreen/EspaceScreen.jsx
//
// ══════════════════════════════════════════════════════════════════════════
//  L'ÉCRAN RÉPONDAIT À SA PROPRE QUESTION PAR « RIEN »
// ══════════════════════════════════════════════════════════════════════════
// Le commentaire de la version précédente disait : « il répond à une seule
// question : qu'est-ce que j'ai à faire maintenant ? ». Ce qu'il affichait,
// c'était trois cartes de chiffres — 100 % de complétude, 1 candidature, un
// paragraphe sur les offres — puis « Brouillon : 1 ».
//
// Aucun de ces éléments n'est une chose à faire. Un profil complet à 100 %
// n'appelle aucune action ; un compteur de dossiers non plus. Quelqu'un qui
// se connecte tombait donc sur un tableau de bord qui l'informait de son
// propre état au lieu de le remettre au travail — sur le seul écran par
// lequel tout le monde passe après s'être connecté.
//
// ══════════════════════════════════════════════════════════════════════════
//  CE QUI LE REMPLACE : UNE FILE, ORDONNÉE PAR URGENCE RÉELLE
// ══════════════════════════════════════════════════════════════════════════
// Chaque entrée est une action, avec son motif et son bouton. L'ordre n'est
// pas décoratif, il suit ce qui coûte le plus cher à rater :
//
//   1. le profil sous le seuil de rapprochement — rien ne peut être produit ;
//   2. un dossier dont l'offre FERME BIENTÔT — c'est irrattrapable ;
//   3. un dossier commencé et laissé en plan ;
//   4. un profil complétable ;
//   5. pas encore regardé les postes qui correspondent ;
//   6. la visibilité auprès des recruteurs — proposée une fois, sans insister.
//
// 🔴 ET QUAND IL N'Y A RIEN, ON LE DIT. La tentation d'un tableau de bord est
// de toujours trouver quelque chose à mettre en avant. Fabriquer une tâche
// pour remplir un écran apprend à l'ignorer — y compris le jour où l'entrée
// est un dossier qui ferme dans deux jours.
import { Link, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useGetProfilQuery } from "../../slices/profilApiSlice";
import { useGetCandidaturesQuery } from "../../slices/candidatureApiSlice";
import { accueilDuRole } from "../../components/Utils/accueilDuRole";
import { joursAvant, URGENCE_JOURS } from "../../utils/format";
import "./EspaceScreen.css";

// Le même seuil que `matchController.COMPLETUDE_MINIMALE`.
//
// En dessous, `GET /api/matchs` répond 400 : proposer « voir les postes qui
// vous correspondent » à quelqu'un sous le seuil l'enverrait sur un message
// d'erreur. L'écran propose donc de compléter le profil, ce qui est la vraie
// étape suivante.
const COMPLETUDE_MINIMALE = 30;

// `URGENCE_JOURS` vient de `utils/format` : le même seuil que celui qui teinte
// l'échéance sur la liste des offres. Deux seuils voisins feraient afficher une
// offre en ambre ici et en neutre là.

const delaiEnMots = (jours) => {
  if (jours === null) return "";
  if (jours < 0) return "la date limite est passée";
  if (jours === 0) return "dernier jour pour candidater";
  if (jours === 1) return "ferme demain";
  return `ferme dans ${jours} jours`;
};

// Une entrée de la file. `ton` porte l'urgence — et le mot « urgent » n'est
// jamais la seule façon de le savoir : le délai est écrit en toutes lettres.
const Entree = ({ ton = "neutre", titre, motif, action, lien, secondaire }) => (
  <li className={`faire-entree faire-entree--${ton}`}>
    <div className="faire-texte">
      {/* h2, pas h3 : le seul titre au-dessus est le h1 de la page, et la file
          est de même niveau que « Aller à ». Écrit en h3, axe signalait un
          saut de niveau — la navigation par titres est la façon dont un
          lecteur d'écran parcourt cet écran. Défaut introduit et corrigé le
          même jour : la vigilance ne remplace pas la mesure. */}
      <h2 className="faire-titre">{titre}</h2>
      <p className="faire-motif">{motif}</p>
    </div>
    <Link to={lien} className={`btn ${secondaire ? "btn-secondaire" : "btn-principal"} btn-compact`}>
      {action}
    </Link>
  </li>
);

const EspaceScreen = () => {
  const { userInfo } = useSelector((state) => state.auth);

  // Un recruteur PUR n'a rien à faire ici : cet écran lui proposerait de
  // compléter son parcours, de voir « les postes qui correspondent à votre
  // parcours » et de se rendre visible auprès des recruteurs — c'est-à-dire
  // auprès de lui-même. Un ADMINISTRATEUR, lui, reste le bienvenu : il doit
  // pouvoir vérifier ce que voient les deux autres rôles.
  const ailleurs = accueilDuRole(userInfo);
  const { data: profil, isLoading: profilCharge } = useGetProfilQuery(undefined, {
    skip: ailleurs !== "/espace",
  });
  const { data: suivi, isLoading: suiviCharge } = useGetCandidaturesQuery(
    undefined,
    { skip: ailleurs !== "/espace" },
  );

  const completude = profil?.completude ?? 0;
  const dossiers = suivi?.candidatures ?? [];

  // Un dossier « en plan » : commencé, pas encore transmis. Une candidature
  // envoyée n'appelle plus rien de la part du candidat — c'est l'employeur
  // qui a la main, et la mettre dans une liste de choses à faire donnerait
  // l'impression qu'on a oublié quelque chose.
  const enPlan = dossiers.filter(
    (d) => d.statut === "brouillon" || d.statut === "prete",
  );

  const avecDelai = enPlan
    .map((d) => ({ ...d, jours: joursAvant(d.dateLimite) }))
    .sort((a, b) => {
      if (a.jours === null) return 1;
      if (b.jours === null) return -1;
      return a.jours - b.jours;
    });

  const presse = (d) => d.jours !== null && d.jours <= URGENCE_JOURS;
  const urgents = avecDelai.filter(presse);
  const tranquilles = avecDelai.filter((d) => !presse(d));

  // ── La file, construite dans l'ordre d'urgence ──────────────────────
  const aFaire = [];

  if (completude < COMPLETUDE_MINIMALE) {
    aFaire.push({
      cle: "profil-bloquant",
      ton: "urgent",
      titre:
        completude === 0
          ? "Commencez par votre parcours"
          : `Votre profil est rempli à ${completude} %`,
      motif:
        completude === 0
          ? "Rien ne peut être rapproché ni rédigé tant qu'il est vide. Comptez dix minutes, une seule fois — et si vous n'avez pas de CV, l'entretien guidé pose les questions à votre place."
          : `En dessous de ${COMPLETUDE_MINIMALE} %, un rapprochement comparerait une fiche de poste détaillée à quelques lignes. Le résultat ne vaudrait rien.`,
      action: completude === 0 ? "Construire mon parcours" : "Compléter mon profil",
      lien: completude === 0 ? "/entretien" : "/profil",
    });
  }

  urgents.forEach((d) => {
    aFaire.push({
      cle: `urgent-${d._id}`,
      ton: "urgent",
      titre: d.avpIntitule,
      motif: `${d.avpDirection ? `${d.avpDirection} · ` : ""}${delaiEnMots(d.jours)} — ${d.piecesRemplies} pièce${d.piecesRemplies > 1 ? "s" : ""} sur ${d.piecesTotal} ${d.statut === "prete" ? "· prête à envoyer" : d.piecesRemplies > 1 ? "préparées" : "préparée"}.`,
      action: d.statut === "prete" ? "Envoyer" : "Finir ce dossier",
      lien: `/candidatures/${d._id}`,
    });
  });

  tranquilles.forEach((d) => {
    aFaire.push({
      cle: `dossier-${d._id}`,
      ton: "neutre",
      titre: d.avpIntitule,
      motif: `${d.avpDirection ? `${d.avpDirection} · ` : ""}${d.piecesRemplies} pièce${d.piecesRemplies > 1 ? "s" : ""} sur ${d.piecesTotal}${d.jours !== null ? ` · ${delaiEnMots(d.jours)}` : ""}.`,
      action: d.statut === "prete" ? "Envoyer" : "Reprendre",
      lien: `/candidatures/${d._id}`,
      secondaire: true,
    });
  });

  if (completude >= COMPLETUDE_MINIMALE && completude < 100) {
    aFaire.push({
      cle: "profil-completer",
      ton: "neutre",
      titre: `Votre profil est rempli à ${completude} %`,
      motif:
        "Chaque section en plus donne au moteur de quoi justifier un rapprochement, et à vos lettres de quoi citer.",
      action: "Compléter mon profil",
      lien: "/profil",
      secondaire: true,
    });
  }

  if (completude >= COMPLETUDE_MINIMALE && enPlan.length === 0) {
    aFaire.push({
      cle: "matchs",
      ton: "neutre",
      titre: "Voir les postes qui correspondent à votre parcours",
      motif:
        "Chaque poste est confronté à votre profil attendu par attendu : ce qui est couvert, par quoi, et ce qui manque. Y compris pour les postes écartés, avec le motif.",
      action: "Voir mes correspondances",
      lien: "/matchs",
    });
  }

  // La visibilité au vivier n'est pas une tâche, c'est un choix — d'où le ton
  // neutre, le bouton secondaire, et le fait qu'elle passe TOUJOURS en
  // dernier. Un service public n'a pas à pousser quelqu'un à se rendre
  // visible : il a à s'assurer qu'il sait que c'est possible.
  if (profil && !profil.visibleRecruteurs && completude >= COMPLETUDE_MINIMALE) {
    aFaire.push({
      cle: "vivier",
      ton: "neutre",
      titre: "Votre profil n'est visible d'aucun recruteur",
      motif:
        "C'est l'état par défaut. Si vous le souhaitez, les recruteurs vérifiés peuvent vous trouver — la liste exacte de ce qui serait partagé est affichée avant que vous décidiez quoi que ce soit.",
      action: "Voir ce que ça partage",
      lien: "/profil",
      secondaire: true,
    });
  }

  const enChargement = profilCharge || suiviCharge;

  // ⚠️ Le retour anticipé vient APRÈS tous les hooks. Placé en tête du
  // composant, il sauterait `useGetProfilQuery` et `useGetCandidaturesQuery`
  // au rendu suivant — React interdit un nombre de hooks variable d'un rendu
  // à l'autre. Les deux requêtes sont donc neutralisées par `skip`, pas par
  // un retour placé avant elles.
  if (ailleurs !== "/espace") return <Navigate to={ailleurs} replace />;

  return (
    <div className="conteneur espace">
      <header className="espace-entete">
        <p className="espace-salut">Bonjour {userInfo?.prenom}</p>
        <h1>Ce qui vous attend</h1>
      </header>

      {enChargement ? (
        <p className="espace-vide" role="status">
          Chargement de vos dossiers…
        </p>
      ) : aFaire.length > 0 ? (
        <ul className="faire">
          {aFaire.map(({ cle, ...entree }) => (
            <Entree key={cle} {...entree} />
          ))}
        </ul>
      ) : (
        <div className="espace-vide">
          <p className="espace-vide-titre">Rien ne vous attend.</p>
          <p>
            Votre profil est complet et aucun dossier n'est en attente. Les
            offres sont republiées en continu&nbsp;: les alertes vous
            préviendront, vous n'avez pas à revenir vérifier.
          </p>
        </div>
      )}

      {/* Les entrées ordinaires, hors de la file : ce ne sont pas des choses
          à faire, ce sont des endroits où aller. Les mélanger aux actions
          diluerait exactement ce que la file sert à distinguer. */}
      <nav className="espace-acces" aria-labelledby="titre-acces">
        <h2 id="titre-acces">Aller à</h2>
        <ul>
          <li>
            <Link to="/offres">Les offres</Link>
            {/* Aucun chiffre en dur ici : le corpus se renouvelle en quelques
                semaines, et un « 230 offres » écrit dans le JSX serait faux
                avant le rendu. La liste des offres, elle, compte ce qu'elle
                affiche. */}
            <span>Tous les avis de vacance de poste, republiés tels quels</span>
          </li>
          <li>
            <Link to="/matchs">Mes correspondances</Link>
            <span>Chaque poste confronté à votre parcours, avec les écarts</span>
          </li>
          <li>
            <Link to="/candidatures">Mes candidatures</Link>
            <span>
              {suivi?.total ?? 0} dossier{(suivi?.total ?? 0) > 1 ? "s" : ""} — pièces, statuts, envois
            </span>
          </li>
          <li>
            <Link to="/alertes">Mes alertes</Link>
            <span>Être prévenu quand un poste correspond, sans revenir</span>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default EspaceScreen;
