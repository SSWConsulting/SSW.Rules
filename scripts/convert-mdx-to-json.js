const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

function convertMDXFolderToJSON(inputDir, outputDir) {
  if (!fs.existsSync(inputDir)) {
    console.error(`Le dossier source "${inputDir}" n'existe pas.`);
    return;
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const files = fs.readdirSync(inputDir);

  const mdxFiles = files.filter((file) => path.extname(file) === '.mdx');

  mdxFiles.forEach((file) => {
    const inputFilePath = path.join(inputDir, file);
    const outputFileName = path.basename(file, '.mdx') + '.json';
    const outputFilePath = path.join(outputDir, outputFileName);

    try {
      const fileContent = fs.readFileSync(inputFilePath, 'utf-8');

      const { data: frontmatter, content } = matter(fileContent);

      const jsonData = {
        frontmatter,
        content,
      };

      fs.writeFileSync(outputFilePath, JSON.stringify(jsonData, null, 2), 'utf-8');
      console.log(`Fichier converti : ${outputFilePath}`);
    } catch (error) {
      console.error(`Erreur lors de la conversion du fichier "${file}":`, error);
    }
  });
}

// Exemple d'utilisation
const dossierSource = path.join(__dirname, '..', 'content', 'rule');
const dossierSortie = path.join(__dirname, 'conversion-outputs');

convertMDXFolderToJSON(dossierSource, dossierSortie);
