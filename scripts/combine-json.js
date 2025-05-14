const fs = require('fs');
const path = require('path');

function combineJSONFiles(inputDir, outputFile) {
  if (!fs.existsSync(inputDir)) {
    console.error(`Le dossier "${inputDir}" n'existe pas.`);
    return;
  }

  const files = fs.readdirSync(inputDir).filter(file => file.endsWith('.json'));
  const combined = [];

  files.forEach(file => {
    const filePath = path.join(inputDir, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      combined.push(data);
    } catch (err) {
      console.error(`Erreur lors du parsing de "${file}":`, err);
    }
  });

  fs.writeFileSync(outputFile, JSON.stringify(combined, null, 2), 'utf-8');
  console.log(`Fichier combiné écrit dans : ${outputFile}`);
}

// Exemple d'utilisation
const dossierJson = path.join(__dirname, 'conversion-outputs');
const fichierIndex = path.join(__dirname, 'index-json');

combineJSONFiles(dossierJson, fichierIndex);
