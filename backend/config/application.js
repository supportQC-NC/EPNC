// backend/config/application.js
//
// Le nom du service, côté serveur.
//
// Il existait déjà dans frontend/src/constants.js, mais les courriers de
// modération partent du BACKEND : y écrire « Emploi Public NC » en dur dans
// chaque message garantissait qu'un renommage en oublierait la moitié.
export const APP_NAME = process.env.APP_NAME || "Emploi Public NC";
export const APP_NAME_COURT = process.env.APP_NAME_COURT || "EPNC";
