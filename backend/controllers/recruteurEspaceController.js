// backend/controllers/recruteurEspaceController.js
//
// L'espace de travail du recruteur : son profil, ses listes, ses suggestions,
// son tableau de bord.
//
// Séparé de `recruteurController.js`, qui expose le VIVIER (consultation des
// candidats). Ici, rien n'est public : tout appartient au recruteur connecté et
// n'est jamais visible d'un autre — pas même d'un collègue de la même
// organisation. Deux recruteurs qui partagent une boîte mail ne partagent pas
// leurs notes sur des personnes.

import asyncHandler from "../middleware/asyncHandler.js";
import Profil from "../models/ProfilModel.js";
import Avp from "../models/AvpModel.js";
import User from "../models/UserModel.js";
import { RecruteurProfil, ListeCandidats } from "../models/RecruteurModel.js";
import { profilDeRecherche, suggerer } from "../services/suggestionService.js";
import { EMPLOYEURS } from "../config/employeurs.js";

const COMPLETUDE_MINIMALE = 30;

// Carte de candidat, identique à celle du vivier : sans coordonnées.
// Dupliquée volontairement ? Non — importée, pour qu'une modification de la
// règle « pas de coordonnées en liste » s'applique partout d'un coup.
const carte = (profil) => ({
  id: profil._id,
  prenom: profil.user?.prenom || "",
  nom: profil.user?.nom || "",
  titre: profil.basics?.titre || "",
  photo: profil.basics?.photo || "",
  ville: profil.basics?.ville || "",
  province: profil.basics?.province || "",
  accroche: profil.basics?.accroche || "",
  competences: (profil.competences || []).map((c) => ({
    nom: c.nom,
    niveau: c.niveau,
  })),
  nbCompetences: (profil.competences || []).length,
  nbExperiences: (profil.experiences || []).length,
  disponibilite: profil.contraintes?.disponibilite || "",
  majLe: profil.updatedAt,
});

// Le profil recruteur, créé vide à la première lecture — même raison que côté
// candidat : distinguer « pas encore de profil » de « profil vide » n'a aucun
// sens pour l'utilisateur.
const chargerRecruteur = async (userId) =>
  (await RecruteurProfil.findOne({ user: userId })) ||
  (await RecruteurProfil.create({ user: userId }));

// Les listes avec leurs profils peuplés : nécessaire pour que les candidats
// enregistrés puissent « voter » dans les suggestions.
const chargerListes = (userId) =>
  ListeCandidats.find({ user: userId })
    .populate({
      path: "entrees.profil",
      select: "competences basics.titre basics.ville visibleRecruteurs",
    })
    .sort({ updatedAt: -1 });

// ── Profil recruteur ──────────────────────────────────────────────────────

// @desc    Mon profil recruteur
// @route   GET /api/recruteur/profil
const getProfilRecruteur = asyncHandler(async (req, res) => {
  const recruteur = await chargerRecruteur(req.user._id);

  // Le vocabulaire proposé vient des profils réellement présents dans le
  // vivier. Proposer des compétences dont aucune ne ramène personne est la
  // meilleure façon de faire croire que l'outil est vide.
  const profils = await Profil.find({ visibleRecruteurs: true }, "competences");
  const competencesDuVivier = [
    ...new Set(
      profils.flatMap((p) => (p.competences || []).map((c) => c.nom)).filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "fr"));

  res.json({
    ...recruteur.toObject(),
    completude: recruteur.completude(),
    employeurs: EMPLOYEURS.map((e) => ({ code: e.code, nom: e.nomComplet })),
    competencesDuVivier,
  });
});

// @desc    Enregistrer mon profil recruteur
// @route   PUT /api/recruteur/profil
const majProfilRecruteur = asyncHandler(async (req, res) => {
  const recruteur = await chargerRecruteur(req.user._id);

  for (const champ of ["organisation", "employeurCode", "fonction", "telephone"]) {
    if (req.body[champ] !== undefined) recruteur[champ] = req.body[champ];
  }

  // Logo : mêmes règles que la photo de profil (voir profilController). Le
  // navigateur redimensionne avant l'envoi ; ce plafond arrête un envoi direct
  // par l'API, qui pousserait une image de plusieurs mégaoctets dans un
  // document relu à chaque chargement.
  if (typeof req.body.logo === "string") {
    const LOGO_MAX = 400 * 1024;

    if (req.body.logo && !/^data:image\/(png|jpeg|webp);base64,/.test(req.body.logo)) {
      res.status(400);
      throw new Error("Format de logo non reconnu. Formats acceptés : PNG, JPEG, WebP.");
    }

    if (req.body.logo.length > LOGO_MAX) {
      res.status(413);
      throw new Error("Logo trop lourd. Choisissez une image plus légère.");
    }

    recruteur.logo = req.body.logo;
  }

  if (req.body.recherche !== undefined) recruteur.recherche = req.body.recherche;

  if (req.body.poidsHistorique !== undefined) {
    // Borné ici aussi, pas seulement dans le schéma : une valeur hors bornes
    // fausserait toute la pondération sans lever d'erreur visible.
    recruteur.poidsHistorique = Math.min(
      100,
      Math.max(0, Number(req.body.poidsHistorique) || 0),
    );
  }

  await recruteur.save();

  res.json({ ...recruteur.toObject(), completude: recruteur.completude() });
});

// ── Listes ────────────────────────────────────────────────────────────────

// @desc    Mes listes
// @route   GET /api/recruteur/listes
const listerListes = asyncHandler(async (req, res) => {
  const listes = await chargerListes(req.user._id);

  res.json(
    listes.map((l) => ({
      _id: l._id,
      nom: l.nom,
      description: l.description,
      avpSlug: l.avpSlug,
      avpIntitule: l.avpIntitule,
      nbEntrees: l.entrees.length,
      entrees: l.entrees.map((e) => ({
        profilId: e.profil?._id || e.profil,
        prenom: e.prenom,
        nom: e.nom,
        titre: e.titre,
        note: e.note,
        ajouteLe: e.ajouteLe,
        // Le candidat a pu retirer sa visibilité depuis l'ajout. On le dit
        // plutôt que d'afficher une ligne morte ou de rediriger vers un 404.
        consultable: Boolean(e.profil?.visibleRecruteurs),
      })),
      updatedAt: l.updatedAt,
    })),
  );
});

// @desc    Créer une liste
// @route   POST /api/recruteur/listes
const creerListe = asyncHandler(async (req, res) => {
  const nom = (req.body.nom || "").trim();

  if (!nom) {
    res.status(400);
    throw new Error("Donnez un nom à cette liste.");
  }

  const existante = await ListeCandidats.findOne({ user: req.user._id, nom });
  if (existante) {
    res.status(409);
    throw new Error(`Vous avez déjà une liste nommée « ${nom} ».`);
  }

  let avpIntitule = null;
  if (req.body.avpSlug) {
    const avp = await Avp.findOne({ slug: req.body.avpSlug }, "intitule");
    avpIntitule = avp?.intitule || null;
  }

  const liste = await ListeCandidats.create({
    user: req.user._id,
    nom,
    description: req.body.description || "",
    avpSlug: req.body.avpSlug || null,
    avpIntitule,
  });

  res.status(201).json(liste);
});

// @desc    Renommer / décrire une liste
// @route   PUT /api/recruteur/listes/:id
const majListe = asyncHandler(async (req, res) => {
  const liste = await ListeCandidats.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!liste) {
    res.status(404);
    throw new Error("Liste introuvable.");
  }

  if (req.body.nom !== undefined) liste.nom = req.body.nom.trim();
  if (req.body.description !== undefined) liste.description = req.body.description;

  await liste.save();
  res.json(liste);
});

// @desc    Supprimer une liste
// @route   DELETE /api/recruteur/listes/:id
const supprimerListe = asyncHandler(async (req, res) => {
  const liste = await ListeCandidats.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!liste) {
    res.status(404);
    throw new Error("Liste introuvable.");
  }

  res.json({ message: "Liste supprimée", _id: req.params.id });
});

// @desc    Ajouter un candidat à une liste
// @route   POST /api/recruteur/listes/:id/candidats
const ajouterCandidat = asyncHandler(async (req, res) => {
  const liste = await ListeCandidats.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!liste) {
    res.status(404);
    throw new Error("Liste introuvable.");
  }

  const profil = await Profil.findOne({
    _id: req.body.profilId,
    visibleRecruteurs: true,
  }).populate("user", "prenom nom isActive");

  if (!profil || !profil.user || profil.user.isActive === false) {
    res.status(404);
    throw new Error("Ce profil n'est pas consultable.");
  }

  const deja = liste.entrees.find(
    (e) => String(e.profil) === String(profil._id),
  );

  if (deja) {
    // On ne double pas l'entrée : on met la note à jour. Le geste de
    // l'utilisateur (« garder ce profil ici ») doit toujours aboutir au bon
    // état, qu'il l'ait déjà fait ou non.
    if (req.body.note !== undefined) deja.note = req.body.note;
    await liste.save();
    return res.json(liste);
  }

  liste.entrees.push({
    profil: profil._id,
    prenom: profil.user.prenom,
    nom: profil.user.nom,
    titre: profil.basics?.titre || "",
    note: req.body.note || "",
  });

  await liste.save();
  res.status(201).json(liste);
});

// @desc    Retirer un candidat d'une liste
// @route   DELETE /api/recruteur/listes/:id/candidats/:profilId
const retirerCandidat = asyncHandler(async (req, res) => {
  const liste = await ListeCandidats.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!liste) {
    res.status(404);
    throw new Error("Liste introuvable.");
  }

  liste.entrees = liste.entrees.filter(
    (e) => String(e.profil) !== String(req.params.profilId),
  );

  await liste.save();
  res.json(liste);
});

// ── Suggestions ───────────────────────────────────────────────────────────

// @desc    Les candidats les plus proches de ce que je cherche
// @route   GET /api/recruteur/suggestions
const getSuggestions = asyncHandler(async (req, res) => {
  const [recruteur, listes] = await Promise.all([
    chargerRecruteur(req.user._id),
    chargerListes(req.user._id),
  ]);

  const recherche = profilDeRecherche(recruteur, listes);

  const dejaEnregistres = new Set(
    listes.flatMap((l) => l.entrees.map((e) => String(e.profil?._id || e.profil))),
  );

  const profils = await Profil.find({ visibleRecruteurs: true }).populate(
    "user",
    "prenom nom isActive",
  );

  const candidats = profils
    .filter(
      (p) => p.user && p.user.isActive !== false && p.completude() >= COMPLETUDE_MINIMALE,
    )
    .map(carte);

  const suggestions = suggerer(candidats, recherche, dejaEnregistres);

  res.json({
    exploitable: recherche.exploitable,
    nbEnregistres: recherche.nbEnregistres,
    poidsHistorique: recruteur.poidsHistorique,
    // Ce sur quoi le classement s'appuie, en clair. C'est ce qui permet au
    // recruteur de corriger ses critères plutôt que de subir un classement.
    criteres: [...recherche.poids.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([libelle, poids]) => ({
        libelle,
        poids: Math.round(poids * 10) / 10,
        origines: [...(recherche.origines.get(libelle) || [])].slice(0, 3),
      })),
    total: suggestions.length,
    suggestions: suggestions.slice(0, 20),
  });
});

// ── Tableau de bord ───────────────────────────────────────────────────────

// @desc    Chiffres et raccourcis de l'espace recruteur
// @route   GET /api/recruteur/tableau-de-bord
const getTableauDeBord = asyncHandler(async (req, res) => {
  const maintenant = new Date();
  const ouvertes = {
    $or: [{ dateLimite: null }, { dateLimite: { $gte: maintenant } }],
  };

  const [recruteur, listes] = await Promise.all([
    chargerRecruteur(req.user._id),
    chargerListes(req.user._id),
  ]);

  const [profilsVisibles, offresOuvertes, mesOffres] = await Promise.all([
    Profil.countDocuments({ visibleRecruteurs: true }),
    Avp.countDocuments(ouvertes),
    // Les offres de SON organisation, quand elle est rattachée au registre.
    recruteur.employeurCode
      ? Avp.find(
          { ...ouvertes, "employeur.code": recruteur.employeurCode },
          "slug intitule direction lieu dateLimite",
        )
          .sort({ datePubliee: -1 })
          .limit(8)
          .lean()
      : [],
  ]);

  // Profils enregistrés distincts : la même personne peut figurer dans deux
  // listes, la compter deux fois donnerait un chiffre faux.
  const enregistres = new Set(
    listes.flatMap((l) => l.entrees.map((e) => String(e.profil?._id || e.profil))),
  );

  res.json({
    profil: {
      organisation: recruteur.organisation,
      employeurCode: recruteur.employeurCode,
      fonction: recruteur.fonction,
      logo: recruteur.logo,
      completude: recruteur.completude(),
    },
    chiffres: {
      profilsVisibles,
      offresOuvertes,
      listes: listes.length,
      candidatsEnregistres: enregistres.size,
    },
    mesOffres,
    listesRecentes: listes.slice(0, 4).map((l) => ({
      _id: l._id,
      nom: l.nom,
      nbEntrees: l.entrees.length,
      avpIntitule: l.avpIntitule,
      updatedAt: l.updatedAt,
    })),
  });
});

export {
  getProfilRecruteur,
  majProfilRecruteur,
  listerListes,
  creerListe,
  majListe,
  supprimerListe,
  ajouterCandidat,
  retirerCandidat,
  getSuggestions,
  getTableauDeBord,
};
