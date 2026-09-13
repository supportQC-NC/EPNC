// src/screens/LegalScreen/MentionsLegalesScreen.jsx
//
// Mentions légales et conditions d'utilisation.
//
// ⚠️ LES CHAMPS À COMPLÉTER SONT VISIBLES, PAS INVENTÉS.
// Éditeur, hébergeur, contact : ces informations dépendent de qui exploite le
// service, et personne ne peut les deviner à sa place. Elles apparaissent donc
// en attente, signalées à l'écran. Un faux nom d'éditeur dans des mentions
// légales est pire qu'une mention manquante : il désigne un responsable qui
// n'existe pas.
import { Link } from "react-router-dom";
import { APP_NAME } from "../../constants";
import "./LegalScreen.css";

// Ce qui doit être renseigné avant toute mise en ligne réelle.
const AREMPLIR = "à compléter avant mise en ligne";

const MentionsLegalesScreen = () => (
  <div className="conteneur legal">
    <header className="legal-entete">
      <h1>Mentions légales</h1>
      <p className="legal-intro">
        Qui édite ce service, d'où viennent les offres, et ce que le service
        n'est pas.
      </p>
    </header>

    {/* ── Le point le plus important de cette page ──────────────────── */}
    <section className="legal-alerte" aria-labelledby="titre-independance">
      <h2 id="titre-independance">Un service indépendant</h2>
      <p>
        🔴 {APP_NAME} <strong>n'a aucun lien officiel</strong> avec l'OPT-NC, la
        Nouvelle-Calédonie, les provinces, les communes ni aucun des employeurs
        publics dont il republie les avis de vacance de poste.
      </p>
      <p>
        Il ne reçoit, n'instruit et ne transmet <strong>aucune
        candidature</strong> pour leur compte. Les documents produits ici vous
        sont rendus&nbsp;: c'est à vous de les envoyer, par les voies indiquées
        sur l'avis officiel.
      </p>
      <p>
        En cas de divergence entre ce qui est affiché ici et l'avis publié par
        l'employeur, <strong>c'est l'avis officiel qui fait foi</strong>. Chaque
        fiche renvoie à sa source.
      </p>
    </section>

    <section className="legal-bloc" aria-labelledby="titre-editeur">
      <h2 id="titre-editeur">Éditeur</h2>
      <dl className="legal-liste">
        <div>
          <dt>Responsable de la publication</dt>
          <dd className="legal-attente">{AREMPLIR}</dd>
        </div>
        <div>
          <dt>Contact</dt>
          <dd className="legal-attente">{AREMPLIR}</dd>
        </div>
        <div>
          <dt>Hébergement</dt>
          <dd className="legal-attente">{AREMPLIR}</dd>
        </div>
      </dl>
    </section>

    <section className="legal-bloc" aria-labelledby="titre-sources">
      <h2 id="titre-sources">D'où viennent les offres</h2>
      <p>
        Les avis de vacance de poste proviennent de jeux de données publics
        republiés en open data par les employeurs eux-mêmes. Ils sont normalisés
        au format{" "}
        <a href="https://schema.org/JobPosting" target="_blank" rel="noreferrer noopener">
          schema.org/JobPosting
        </a>{" "}
        et republiés tels quels&nbsp;: <strong>aucune saisie manuelle, aucune
        offre ajoutée, aucun contenu réécrit</strong>.
      </p>
      <p>
        Une traduction en français courant est proposée sur certains termes
        administratifs. Elle est toujours affichée <em>à côté</em> du libellé
        officiel, jamais à sa place.
      </p>
    </section>

    <section className="legal-bloc" aria-labelledby="titre-usage">
      <h2 id="titre-usage">Conditions d'utilisation</h2>
      <dl className="legal-liste">
        <div>
          <dt>Ce que vous publiez vous engage</dt>
          <dd>
            Les informations de votre profil doivent être exactes. Les documents
            produits portent votre nom&nbsp;: c'est vous qui les signez, et vous
            devez les relire avant de les transmettre.
          </dd>
        </div>
        <div>
          <dt>Les documents sont assistés, pas garantis</dt>
          <dd>
            Les lettres et CV sont produits automatiquement à partir de votre
            profil. Le procédé peut se tromper&nbsp;: mal comprendre une attente
            du poste, forcer une nuance, oublier un élément.{" "}
            <strong>Aucun résultat n'est promis</strong>, ni entretien, ni
            embauche.
          </dd>
        </div>
        <div>
          <dt>Accès recruteur</dt>
          <dd>
            Il donne accès aux parcours et aux coordonnées de personnes qui
            cherchent un emploi. Il est vérifié un par un, et s'utilise pour
            contacter quelqu'un à propos d'un poste — pour rien d'autre. Tout
            usage détourné entraîne le retrait de l'accès.
          </dd>
        </div>
        <div>
          <dt>Modération</dt>
          <dd>
            Un signalement n'entraîne aucune sanction automatique&nbsp;: il
            ouvre un dossier instruit par une personne. Toute mesure est
            motivée par écrit, notifiée, et peut faire l'objet d'un recours.
          </dd>
        </div>
      </dl>
    </section>

    <p className="legal-maj">
      Le traitement de vos données personnelles est décrit sur la page{" "}
      <Link to="/confidentialite">Vos données</Link>.
    </p>
  </div>
);

export default MentionsLegalesScreen;
