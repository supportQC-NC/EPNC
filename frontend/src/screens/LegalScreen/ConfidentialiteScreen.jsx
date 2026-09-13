// src/screens/LegalScreen/ConfidentialiteScreen.jsx
//
// Politique de confidentialité.
//
// ══════════════════════════════════════════════════════════════════════════
//  ÉCRITE À PARTIR DU CODE, PAS D'UN MODÈLE TYPE
// ══════════════════════════════════════════════════════════════════════════
// Chaque affirmation de cette page correspond à quelque chose de vérifiable
// dans le dépôt : les champs des modèles Mongoose, les appels sortants, les
// suppressions en cascade. Une politique de confidentialité copiée sur un
// générateur décrit un service imaginaire — et c'est exactement ce qui la rend
// inutile le jour où quelqu'un pose une vraie question.
//
// 🔴 LE POINT QUI COMPTE, ET QU'ON MET EN PREMIER : le contenu du profil est
// transmis à un prestataire tiers (OpenAI) pour produire la lettre et le CV.
// La plupart des outils de cette catégorie l'enterrent en bas de page. Ici
// c'est la première section, parce que c'est la seule information qui peut
// faire changer d'avis quelqu'un avant de saisir son parcours.
import { Link } from "react-router-dom";
import { APP_NAME } from "../../constants";
import "./LegalScreen.css";

const ConfidentialiteScreen = () => (
  <div className="conteneur legal">
    <header className="legal-entete">
      <h1>Vos données</h1>
      <p className="legal-intro">
        Ce que {APP_NAME} collecte, pourquoi, où cela va, combien de temps, et
        comment reprendre la main. Tout ce qui suit décrit le fonctionnement
        réel du service — pas un modèle type.
      </p>
    </header>

    {/* ── Le tiers, en premier ──────────────────────────────────────── */}
    <section className="legal-alerte" aria-labelledby="titre-tiers">
      <h2 id="titre-tiers">Ce qui sort de la plateforme</h2>
      <p>
        Pour rédiger votre lettre et votre CV, <strong>le contenu de votre
        profil et de l'offre visée est transmis à OpenAI</strong> (États-Unis),
        qui héberge le modèle de langue utilisé. Sont concernés : vos
        expériences, formations, compétences, votre présentation, votre nom et
        votre adresse électronique.
      </p>
      <p>
        Cette transmission n'a lieu <strong>qu'au moment où vous demandez la
        production d'une pièce</strong>. Consulter des offres, remplir son
        profil ou voir ses correspondances ne déclenche aucun envoi.
      </p>
      <p>
        Un avertissement vous est présenté avant la première utilisation de la
        rédaction assistée, et vous devez l'accepter. Si vous préférez ne rien
        transmettre, n'utilisez pas cette fonction : le reste de la plateforme
        — offres, rapprochement, alertes — fonctionne sans elle.
      </p>
      <p className="legal-secondaire">
        Vos courriels (réinitialisation de mot de passe, alertes, envoi de
        dossier) transitent par notre prestataire d'acheminement. Aucune autre
        donnée n'est transmise à un tiers : pas de régie publicitaire, pas
        d'outil de mesure d'audience, pas de revente.
      </p>
    </section>

    {/* ── Ce qui est collecté ───────────────────────────────────────── */}
    <section className="legal-bloc" aria-labelledby="titre-collecte">
      <h2 id="titre-collecte">Ce qui est collecté, et pourquoi</h2>

      <dl className="legal-liste">
        <div>
          <dt>Votre compte</dt>
          <dd>
            Nom, prénom, adresse électronique, mot de passe. Nécessaires pour
            vous identifier et vous écrire. Le mot de passe est stocké
            haché&nbsp;: il n'est lisible par personne, y compris nous.
          </dd>
        </div>
        <div>
          <dt>Votre profil</dt>
          <dd>
            Parcours, formations, compétences, langues, centres d'intérêt, et
            si vous les renseignez&nbsp;: photo, adresse postale, téléphone.
            C'est la matière du rapprochement et des documents produits.{" "}
            <strong>Tout y est facultatif</strong> sauf ce qui est marqué comme
            requis&nbsp;; une photo n'est jamais exigée.
          </dd>
        </div>
        <div>
          <dt>Vos candidatures</dt>
          <dd>
            Les offres visées et les pièces produites. Conservées pour que vous
            les retrouviez, les corrigiez et les rééditiez.
          </dd>
        </div>
        <div>
          <dt>Traces techniques</dt>
          <dd>
            Date de dernière connexion, et un cookie de session strictement
            nécessaire à votre authentification.{" "}
            <strong>Aucun cookie publicitaire, aucun traceur tiers</strong> —
            c'est pourquoi ce site ne vous demande pas de consentement aux
            cookies&nbsp;: il n'en dépose aucun qui l'exigerait.
          </dd>
        </div>
      </dl>
    </section>

    {/* ── Qui voit quoi ─────────────────────────────────────────────── */}
    <section className="legal-bloc" aria-labelledby="titre-visibilite">
      <h2 id="titre-visibilite">Qui peut voir votre profil</h2>
      <p>
        🔴 <strong>Par défaut, personne.</strong> Votre profil n'est visible
        d'aucun recruteur tant que vous ne l'avez pas décidé explicitement, dans
        votre espace. On crée un compte pour chercher un poste, pas pour figurer
        dans un annuaire.
      </p>
      <p>
        L'activer n'est pas une case à cocher en passant&nbsp;:{" "}
        <strong>la liste exacte de ce qui sera partagé vous est présentée
        avant</strong>, dans votre profil — ce qu'un recruteur voit dès la
        liste de recherche, ce qui n'apparaît qu'en ouvrant votre fiche (vos
        coordonnées, votre CV en PDF, votre profil exportable), ce qu'il peut
        en faire, et ce qui ne sort jamais. Vous ne validez qu'ensuite.
      </p>
      <p>
        <strong>Votre accord est daté</strong> et la date vous est affichée. Si
        la liste de ce qui est partagé change, votre profil n'est pas retiré
        d'office — nous ne décidons pas à votre place — mais l'écran vous le
        signale et vous demande de relire avant de confirmer.
      </p>
      <p>
        <strong>Vos coordonnées n'apparaissent que sur la fiche détaillée</strong>,
        jamais dans les listes&nbsp;: une liste qui les porterait se moissonne
        en une requête. Et vos candidatures, vos lettres et vos brouillons ne
        sont jamais visibles&nbsp;: ils ne sortent que si vous les envoyez
        vous-même.
      </p>
      <p>
        Vous pouvez retirer cette visibilité à tout moment, sans justification,
        et l'effet est immédiat. Le retrait est daté lui aussi.
      </p>
    </section>

    {/* ── Durées ────────────────────────────────────────────────────── */}
    <section className="legal-bloc" aria-labelledby="titre-durees">
      <h2 id="titre-durees">Combien de temps</h2>
      <p>
        Vos données sont conservées tant que votre compte existe.{" "}
        <strong>Supprimer votre compte efface votre profil et vos
        candidatures</strong>, sans délai et sans copie conservée.
      </p>
      <p className="legal-secondaire">
        Une exception, et elle est dite&nbsp;: si un compte est supprimé à
        l'issue d'une procédure de modération, la personne peut en recréer un
        avec la même adresse électronique, avec un dossier vierge. Une adresse
        n'est jamais bloquée.
      </p>
    </section>

    {/* ── Vos droits ────────────────────────────────────────────────── */}
    <section className="legal-bloc" aria-labelledby="titre-droits">
      <h2 id="titre-droits">Reprendre la main</h2>

      <dl className="legal-liste">
        <div>
          <dt>Voir et corriger</dt>
          <dd>
            Tout ce que nous détenons sur vous est affiché dans votre profil, et
            modifiable à tout moment. Il n'y a pas de données cachées à
            demander.
          </dd>
        </div>
        <div>
          <dt>Emporter</dt>
          <dd>
            Votre profil s'exporte au format{" "}
            <a href="https://jsonresume.org" target="_blank" rel="noreferrer noopener">
              JSON&nbsp;Resume
            </a>
            , un standard ouvert lisible par d'autres outils.{" "}
            <strong>Vos données vous appartiennent</strong>&nbsp;: une
            plateforme qui les retient par le format est une plateforme qu'on ne
            quitte pas.
          </dd>
        </div>
        <div>
          <dt>Effacer</dt>
          <dd>
            La suppression du compte est accessible depuis votre espace et
            s'applique immédiatement.
          </dd>
        </div>
        <div>
          <dt>Nous écrire</dt>
          <dd>
            Pour toute question sur vos données, ou si quelque chose vous paraît
            anormal, utilisez l'adresse indiquée dans les{" "}
            <Link to="/mentions-legales">mentions légales</Link>.
          </dd>
        </div>
      </dl>
    </section>

    <p className="legal-maj">
      Cette page décrit le service tel qu'il fonctionne aujourd'hui. Elle sera
      mise à jour si le traitement des données change.
    </p>
  </div>
);

export default ConfidentialiteScreen;
