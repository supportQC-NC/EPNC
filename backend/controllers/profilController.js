// backend/controllers/profilController.js
import asyncHandler from "../middleware/asyncHandler.js";
import Profil from "../models/ProfilModel.js";
import { depuisJsonResume } from "../services/jsonResumeService.js";

// Forme renvoyée au client : le document, plus la complétude calculée.
// Elle est calculée côté serveur pour que l'interface et un éventuel autre
// consommateur (application mobile, export) voient le même chiffre.
const sortie = (profil) => ({
  ...profil.toObject(),
  completude: profil.completude(),
});

// @desc    Mon profil (créé vide s'il n'existe pas encore)
// @route   GET /api/profil
// @access  Privé
//
// Création implicite à la première lecture : sans elle, le front devrait gérer
// un état « pas encore de profil » distinct d'un « profil vide », pour une
// différence qui n'a aucun sens côté utilisateur.
const getMonProfil = asyncHandler(async (req, res) => {
  let profil = await Profil.findOne({ user: req.user._id });

  if (!profil) {
    profil = await Profil.create({ user: req.user._id });
  }

  res.json(sortie(profil));
});

// @desc    Enregistrer mon profil
// @route   PUT /api/profil
// @access  Privé
//
// Enregistrement par section : le client envoie ce qu'il a modifié. Les
// sections absentes du corps ne sont pas touchées — deux onglets ouverts ne
// s'écrasent donc pas mutuellement sur des parties qu'ils n'ont pas éditées.
const updateMonProfil = asyncHandler(async (req, res) => {
  const profil =
    (await Profil.findOne({ user: req.user._id })) ||
    (await Profil.create({ user: req.user._id }));

  const sections = [
    "basics",
    "experiences",
    "formations",
    "competences",
    "langues",
    "interets",
    "aspirations",
    "contraintes",
  ];

  // Taille maximale de la photo, en caracteres de base64.
  //
  // Le navigateur redimensionne a 320 px avant l'envoi (voir ProfilScreen), ce
  // qui donne ~30 Ko. Ce plafond a 400 Ko laisse une marge confortable tout en
  // arretant net un envoi direct par l'API : sans lui, rien n'empecherait de
  // pousser une photo de 4 Mo dans un document Mongo, et chaque lecture du
  // profil la trainerait ensuite — y compris dans la liste des candidats vue
  // par un recruteur.
  const PHOTO_MAX = 400 * 1024;

  if (typeof req.body?.basics?.photo === "string") {
    const photo = req.body.basics.photo;

    if (photo && !/^data:image\/(png|jpeg|webp);base64,/.test(photo)) {
      res.status(400);
      throw new Error(
        "Format de photo non reconnu. Formats acceptes : PNG, JPEG, WebP.",
      );
    }

    if (photo.length > PHOTO_MAX) {
      res.status(413);
      throw new Error(
        "Photo trop lourde. Choisissez une image plus legere : elle est " +
          "redimensionnee automatiquement, mais le fichier d'origine reste trop gros.",
      );
    }
  }

  for (const section of sections) {
    if (req.body[section] !== undefined) {
      profil.set(section, req.body[section]);
    }
  }

  // La visibilite aupres des recruteurs est un booleen de premier niveau, et
  // un choix a part : on ne la range pas dans une section, pour qu'elle ne
  // puisse pas etre modifiee par inadvertance en enregistrant autre chose.
  if (typeof req.body.visibleRecruteurs === "boolean") {
    profil.visibleRecruteurs = req.body.visibleRecruteurs;
  }

  await profil.save();

  res.json(sortie(profil));
});

// @desc    Prévisualiser l'import d'un JSON Resume
// @route   POST /api/profil/import/apercu
// @access  Privé
//
// ══════════════════════════════════════════════════════════════════════════
//  ON PRÉVISUALISE AVANT D'ÉCRIRE, ET CE N'EST PAS UNE PRÉCAUTION DE STYLE
// ══════════════════════════════════════════════════════════════════════════
// Un import écrase un parcours que la personne a peut-être mis une heure à
// saisir. Deux raisons de ne jamais écrire directement :
//
//  1. `depuisJsonResume()` INTERPRÈTE certaines valeurs — une expérience sans
//     date de fin devient « en cours », « Advanced » devient « maîtrise », une
//     région inconnue est laissée vide. Ce sont des lectures raisonnables, pas
//     des certitudes : la personne doit les voir avant qu'elles deviennent son
//     CV.
//  2. Certaines sections du standard ne sont pas reprises. Les taire donnerait
//     l'impression d'un import complet ; les nommer laisse juger.
//
// Cette route n'écrit RIEN. C'est elle qui rend l'import réversible avant
// qu'il n'ait lieu.
const apercuImport = asyncHandler(async (req, res) => {
  let lecture;

  try {
    lecture = depuisJsonResume(req.body?.resume ?? req.body);
  } catch (erreur) {
    res.status(400);
    throw erreur;
  }

  const { profil, identite, ignores, avertissements } = lecture;

  const existant = await Profil.findOne({ user: req.user._id });

  res.json({
    // Un résumé chiffré : c'est ce qu'on lit en premier pour décider.
    resume: {
      experiences: profil.experiences.length,
      formations: profil.formations.length,
      competences: profil.competences.length,
      langues: profil.langues.length,
      interets: profil.interets.length,
      titre: profil.basics.titre || null,
    },
    // Ce qui existe DÉJÀ et sera remplacé. Annoncer « 3 expériences vont
    // disparaître » avant l'écrasement, et non après, est la seule façon de
    // rendre la décision éclairée.
    remplace: existant
      ? {
          experiences: existant.experiences?.length || 0,
          formations: existant.formations?.length || 0,
          competences: existant.competences?.length || 0,
          vide:
            !existant.experiences?.length &&
            !existant.formations?.length &&
            !existant.competences?.length,
        }
      : { experiences: 0, formations: 0, competences: 0, vide: true },
    identite,
    ignores,
    avertissements,
    profil,
  });
});

// @desc    Importer un JSON Resume dans mon profil
// @route   POST /api/profil/import
// @access  Privé
const importerProfil = asyncHandler(async (req, res) => {
  let lecture;

  try {
    lecture = depuisJsonResume(req.body?.resume ?? req.body);
  } catch (erreur) {
    res.status(400);
    throw erreur;
  }

  const { profil: importe, ignores, avertissements } = lecture;

  const profil =
    (await Profil.findOne({ user: req.user._id })) ||
    (await Profil.create({ user: req.user._id }));

  // ⚠️ La PHOTO et la VISIBILITÉ ne sont jamais touchées par un import.
  //
  // La photo parce qu'aucun JSON Resume ne la porte sous notre forme (voir
  // `depuisJsonResume`, qui refuse délibérément `basics.image`) : l'écraser
  // reviendrait à supprimer sans le dire une image que la personne a choisie.
  //
  // La visibilité auprès des recruteurs parce que c'est une décision, pas une
  // donnée de CV. Un fichier importé ne doit jamais pouvoir exposer quelqu'un
  // dans le vivier à son insu.
  const photo = profil.basics?.photo || "";
  const visible = profil.visibleRecruteurs;

  profil.basics = { ...importe.basics, photo };
  profil.experiences = importe.experiences;
  profil.formations = importe.formations;
  profil.competences = importe.competences;
  profil.langues = importe.langues;
  profil.interets = importe.interets;

  // Aspirations et contraintes : on ne remplace que si le document en porte.
  // Notre propre export les range dans `meta.recherche` ; un JSON Resume venu
  // d'ailleurs n'en a pas, et les effacer ferait perdre ce que la personne
  // avait renseigné à la main.
  if (importe.aspirations.projet || importe.aspirations.famillesVisees.length) {
    profil.aspirations = importe.aspirations;
  }
  if (importe.contraintes.disponibilite || importe.contraintes.mobilite) {
    profil.contraintes = importe.contraintes;
  }

  profil.visibleRecruteurs = visible;

  await profil.save();

  console.log(`📥 Profil importé (JSON Resume) pour ${req.user.email}`);

  res.json({
    message: `Parcours importé : ${importe.experiences.length} expérience(s), ${importe.formations.length} formation(s), ${importe.competences.length} compétence(s).`,
    ignores,
    avertissements,
    profil: sortie(profil),
  });
});

export { getMonProfil, updateMonProfil, apercuImport, importerProfil };
