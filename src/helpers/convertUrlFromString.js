// make links clickable in archived reason
const urlRegex =
  /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/g;

export function detectLinks(text) {
  const formatted = text.split(' ');
  formatted.forEach(checkIfLink);
  var newText = formatted.join(' ');
  return newText;
}

function checkIfLink(word, index, array) {
  if (word.match(urlRegex)) {
    array[index] = `<a href="${word}">${word}</a>`;
  }
}
